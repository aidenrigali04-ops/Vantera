import { beforeEach, describe, expect, it, vi } from "vitest";

// Recording fake for the saveDraftEdit update path: update(...).eq().eq().select("id").
type Call = { table: string; op: string; values?: Record<string, unknown>; filters: [string, unknown][] };
const calls: Call[] = [];
let updatedRows: { id: string }[] = [];
const revalidated: string[] = [];
let sendRow: Record<string, unknown> | null = null;

function makeClient() {
  return {
    auth: { getUser: async () => ({ data: { user: { id: "user-1" } } }) },
    from(table: string) {
      const call: Call = { table, op: "select", filters: [] };
      const settle = () => {
        calls.push(call);
        if (table === "scheduled_sends" && call.op === "select") return Promise.resolve({ data: sendRow, error: null });
        if (table === "accounts") return Promise.resolve({ data: { id: "acc1" }, error: null });
        if (call.op === "update") return Promise.resolve({ data: updatedRows, error: null });
        return Promise.resolve({ data: null, error: null });
      };
      const builder: Record<string, unknown> = {
        select: () => builder,
        limit: () => builder,
        update: (v: Record<string, unknown>) => {
          call.op = "update";
          call.values = v;
          return builder;
        },
        eq: (col: string, val: unknown) => {
          call.filters.push([col, val]);
          return builder;
        },
        maybeSingle: () => settle(),
        then: (ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => settle().then(ok, bad),
      };
      return builder;
    },
  };
}

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => makeClient() }));
vi.mock("next/cache", () => ({ revalidatePath: (p: string) => revalidated.push(p) }));

const regen = vi.fn();
vi.mock("@vantera/agent-brains", () => ({
  CONNECTION_NOTE_MAX_CHARS: 300,
  FOLLOWUP_MAX_CHARS: 500,
  FOLLOWUP_MAX_WORDS: 80,
  STEER_MAX_CHARS: 10,
  describeViolations: (v: unknown[]) => (v.length ? "flagged" : null),
  fixDraftText: async () => ({ text: "Fixed", violations: [] }),
  validateHumanity: () => [],
  regenerateLinkedInStage: (...a: unknown[]) => regen(...a),
}));
vi.mock("@vantera/ai", () => ({ getModel: () => "model" }));
const buildInput = vi.fn();
vi.mock("@/lib/copy/first-touch-input", () => ({ buildFirstTouchDraftInput: (...a: unknown[]) => buildInput(...a) }));

const { saveDraftEdit, approveDraft, fixDraft, regenerateDraft } = await import("./actions");

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  calls.length = 0;
  revalidated.length = 0;
  updatedRows = [{ id: "s1" }];
  sendRow = { id: "s1", lead_id: "l1", linkedin_stage: "invite", origin: "sequence", status: "pending_review" };
  regen.mockReset();
  buildInput.mockReset();
  buildInput.mockResolvedValue({ lead: {}, insights: {}, context: {} });
  regen.mockResolvedValue({ text: "New note", violations: [] });
});

describe("saveDraftEdit", () => {
  it("returns the saved body and the re-linted flags, and revalidates both queues", async () => {
    const res = await saveDraftEdit({}, form({ sendId: "s1", channel: "linkedin", body: "  Hi Sam, saw the post.  " }));
    expect(res.error).toBeUndefined();
    expect(res.body).toBe("Hi Sam, saw the post.");
    expect(res).toHaveProperty("styleFlags");
    const upd = calls.find((c) => c.op === "update");
    expect(upd?.filters).toEqual(expect.arrayContaining([["id", "s1"], ["status", "pending_review"]]));
    expect(revalidated).toEqual(expect.arrayContaining(["/approvals", "/prospects"]));
  });

  it("reports an error when no row was updated (not pending anymore, or not allowed)", async () => {
    updatedRows = [];
    const res = await saveDraftEdit({}, form({ sendId: "s1", channel: "linkedin", body: "Hi Sam" }));
    expect(res).toEqual({ error: "That draft was already handled." });
    expect(revalidated).toEqual([]);
  });
});

describe("approveDraft", () => {
  it("errors when no row was approved", async () => {
    updatedRows = [];
    const res = await approveDraft({}, form({ sendId: "s1" }));
    expect(res).toEqual({ error: "That draft was already handled." });
    expect(revalidated).toEqual([]);
  });
  it("succeeds when the row landed", async () => {
    expect(await approveDraft({}, form({ sendId: "s1" }))).toEqual({});
  });
});

describe("regenerateDraft", () => {
  it("refuses non-first-touch drafts", async () => {
    sendRow = { ...sendRow!, origin: "reply_response" };
    expect(await regenerateDraft("s1", "")).toEqual({ error: "Regenerate works on first-touch drafts only." });
    expect(regen).not.toHaveBeenCalled();
  });
  it("errors when the draft is not pending", async () => {
    sendRow = null;
    expect((await regenerateDraft("s1", "")).error).toBeDefined();
  });
  it("errors when context can't be built", async () => {
    buildInput.mockResolvedValue(null);
    expect(await regenerateDraft("s1", "")).toEqual({ error: "Couldn't load this prospect's context." });
  });
  it("errors when the write lands on 0 rows", async () => {
    updatedRows = [];
    expect(await regenerateDraft("s1", "")).toEqual({ error: "That draft was already handled." });
  });
  it("returns a friendly error when the brain throws", async () => {
    regen.mockRejectedValue(new Error("boom"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await regenerateDraft("s1", "")).toEqual({ error: "Couldn't regenerate right now. Try again." });
    spy.mockRestore();
  });
  it("writes body + flags, clamps the steer, revalidates, and returns them", async () => {
    regen.mockResolvedValue({ text: "New note", violations: [{ rule: "x" }] });
    const res = await regenerateDraft("s1", "  mention the podcast episode please ");
    expect(res).toEqual({ body: "New note", styleFlags: "flagged" });
    expect(regen.mock.calls[0]![1]).toBe("invite");
    expect((regen.mock.calls[0]![2] as string).length).toBeLessThanOrEqual(10);
    const upd = calls.find((c) => c.op === "update");
    expect(upd?.values).toEqual({ body: "New note", style_flags: "flagged" });
    expect(upd?.filters).toEqual(expect.arrayContaining([["id", "s1"], ["status", "pending_review"]]));
    expect(revalidated).toEqual(expect.arrayContaining(["/approvals", "/today", "/prospects"]));
  });
  it("passes a null steer when blank", async () => {
    await regenerateDraft("s1", "   ");
    expect(regen.mock.calls[0]![2]).toBeNull();
  });
});

describe("fixDraft", () => {
  it("errors when the fixed body lands on 0 rows", async () => {
    sendRow = { id: "s1", body: "x", style_flags: "too long", linkedin_stage: "invite" };
    updatedRows = [];
    expect(await fixDraft({}, form({ sendId: "s1" }))).toEqual({ error: "That draft was already handled." });
  });
  it("returns the fixed body on success", async () => {
    sendRow = { id: "s1", body: "x", style_flags: "too long", linkedin_stage: "invite" };
    expect(await fixDraft({}, form({ sendId: "s1" }))).toEqual({ body: "Fixed", styleFlags: null });
  });
});
