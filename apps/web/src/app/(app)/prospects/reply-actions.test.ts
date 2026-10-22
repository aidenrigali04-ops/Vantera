import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Chainable Supabase fake ──────────────────────────────────────────────────
// Every query is recorded as { client, table, op, values, filters }; `respond` decides what it
// resolves to. Covers the builder surface reply-actions uses (select/insert/update/upsert +
// eq/neq/in/order/limit/maybeSingle/returns), awaited directly or via maybeSingle().

type Op = "select" | "insert" | "update" | "upsert";
type Call = {
  client: "session" | "admin";
  table: string;
  op: Op;
  values?: Record<string, unknown>;
  opts?: Record<string, unknown>;
  filters: Array<[string, string, unknown]>;
};
type Result = { data?: unknown; error?: unknown };

const calls: Call[] = [];
let respond: (c: Call) => Result = () => ({ data: null, error: null });

function makeClient(client: Call["client"]) {
  return {
    auth: { getUser: async () => ({ data: { user: { id: "user-1" } } }) },
    from(table: string) {
      const call: Call = { client, table, op: "select", filters: [] };
      let opSet = false;
      const setOp = (op: Op, values?: Record<string, unknown>, opts?: Record<string, unknown>) => {
        call.op = op;
        call.values = values;
        call.opts = opts;
        opSet = true;
        return builder;
      };
      const settle = () => {
        if (!calls.includes(call)) calls.push(call);
        return Promise.resolve({ data: null, error: null, ...respond(call) });
      };
      const filter = (kind: string) => (col: string, val: unknown) => {
        call.filters.push([kind, col, val]);
        return builder;
      };
      const builder: Record<string, unknown> = {
        select: () => (opSet ? builder : setOp("select")),
        insert: (v: Record<string, unknown>) => setOp("insert", v),
        update: (v: Record<string, unknown>) => setOp("update", v),
        upsert: (v: Record<string, unknown>, o?: Record<string, unknown>) => setOp("upsert", v, o),
        eq: filter("eq"),
        neq: filter("neq"),
        in: filter("in"),
        order: () => builder,
        limit: () => builder,
        returns: () => builder,
        maybeSingle: () => settle(),
        then: (ok: (v: Result) => unknown, bad?: (e: unknown) => unknown) => settle().then(ok, bad),
      };
      return builder;
    },
  };
}

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => makeClient("session") }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: () => makeClient("admin") }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/conversations", () => ({
  loadThread: async () => [{ role: "lead", text: "Tell me more", at: new Date() }],
}));
const draftConversationMessage = vi.fn(async () => ({ message: "Happy to — quick look Tuesday?", violations: [] }));
vi.mock("@vantera/agent-brains", () => ({
  draftConversationMessage: (...args: unknown[]) => draftConversationMessage(...(args as [])),
}));

const { delegateToAgent, sendManualReply, resumeAutomation } = await import("./reply-actions");

// ── World fixture ────────────────────────────────────────────────────────────

type World = {
  priorSend: { account_id: string; campaign_id: string | null } | null;
  agent: { account_id: string; campaign_id: string | null; config?: unknown } | null;
  suppressed: boolean;
  inFlight: boolean;
  duplicate: { id: string; status: string; origin: string | null } | null;
  pausedRuns: Array<{ id: string }>;
  booked: boolean;
  failAdminWrites: boolean;
};
let world: World;

const has = (c: Call, kind: string, col: string, val?: unknown) =>
  c.filters.some(([k, f, v]) => k === kind && f === col && (val === undefined || JSON.stringify(v) === JSON.stringify(val)));

beforeEach(() => {
  calls.length = 0;
  draftConversationMessage.mockClear();
  world = {
    priorSend: { account_id: "acc1", campaign_id: "camp-prior" },
    agent: { account_id: "acc1", campaign_id: "camp-agent", config: { cta: "a quick call" } },
    suppressed: false,
    inFlight: false,
    duplicate: null,
    pausedRuns: [],
    booked: false,
    failAdminWrites: false,
  };
  respond = (c) => {
    if (c.client === "admin" && c.op !== "select" && world.failAdminWrites) return { error: { message: "boom" } };
    if (c.table === "scheduled_sends" && c.op === "select") {
      if (has(c, "eq", "origin", "reply_response")) return { data: world.inFlight ? { id: "rr1" } : null };
      if (has(c, "eq", "body")) return { data: world.duplicate };
      return { data: world.priorSend };
    }
    if (c.table === "agents") return { data: world.agent };
    if (c.table === "leads" && c.op === "select") {
      return {
        data: {
          id: "lead1",
          linkedin_url: "https://www.linkedin.com/in/Prospect/",
          meeting_booked_at: world.booked ? "2026-10-01T00:00:00Z" : null,
          ai_insights: { summary: "fit" },
        },
      };
    }
    if (c.table === "suppression_entries") return { data: world.suppressed ? { id: "s1" } : null };
    if (c.table === "campaigns") return { data: { send_mode: "review" } };
    if (c.table === "sequence_runs" && c.op === "update" && has(c, "in", "status")) return { data: world.pausedRuns };
    return { data: null, error: null };
  };
});

const inserts = (table: string) => calls.filter((c) => c.table === table && c.op === "insert");

// ── delegateToAgent guards ───────────────────────────────────────────────────

describe("delegateToAgent", () => {
  it("refuses a suppressed lead — error, nothing drafted, nothing queued (rule 11)", async () => {
    world.suppressed = true;
    const res = await delegateToAgent("lead1");
    expect(res.error).toMatch(/opted out/);
    expect(draftConversationMessage).not.toHaveBeenCalled();
    expect(inserts("scheduled_sends")).toHaveLength(0);
  });

  it("checks suppression against the lead's normalized stored url", async () => {
    world.suppressed = true;
    await delegateToAgent("lead1");
    const check = calls.find((c) => c.table === "suppression_entries")!;
    expect(has(check, "eq", "value", "https://www.linkedin.com/in/prospect")).toBe(true);
  });

  it("with a reply_response already in flight, hands back without drafting a duplicate", async () => {
    world.inFlight = true;
    const res = await delegateToAgent("lead1");
    expect(res).toMatchObject({ sent: true, notice: expect.stringMatching(/already has a reply queued/) });
    expect(draftConversationMessage).not.toHaveBeenCalled();
    expect(inserts("scheduled_sends")).toHaveLength(0);
  });

  it("with no prior send, queues on the live Outreach agent's campaign", async () => {
    world.priorSend = null;
    const res = await delegateToAgent("lead1");
    expect(res).toEqual({ sent: true });
    const [queued] = inserts("scheduled_sends");
    expect(queued!.values).toMatchObject({
      account_id: "acc1",
      campaign_id: "camp-agent",
      lead_id: "lead1",
      origin: "reply_response",
      status: "pending_review", // review-mode campaign
    });
  });

  it("with neither a prior send nor a live Outreach agent, asks to deploy one", async () => {
    world.priorSend = null;
    world.agent = null;
    const res = await delegateToAgent("lead1");
    expect(res.error).toMatch(/Deploy your Outreach agent/);
    expect(inserts("scheduled_sends")).toHaveLength(0);
  });
});

// ── sendManualReply: human takeover always holds ─────────────────────────────

describe("sendManualReply — human takeover", () => {
  it("pauses the lead's runs — stopped ones included — so the responder can't answer on top", async () => {
    world.pausedRuns = [{ id: "run1" }];
    const res = await sendManualReply("lead1", "linkedin", "I'll take it from here");
    expect(res).toEqual({ sent: true });
    const pause = calls.find((c) => c.table === "sequence_runs" && c.op === "update")!;
    expect(pause.values).toMatchObject({ status: "paused_reply" });
    expect(has(pause, "in", "status", ["active", "exhausted", "stopped", "paused_reply"])).toBe(true);
    expect(calls.some((c) => c.table === "sequence_runs" && c.op === "upsert")).toBe(false);
  });

  it("a lead with NO run gets a paused marker run on the send's campaign", async () => {
    world.pausedRuns = [];
    await sendManualReply("lead1", "linkedin", "Hi Sam — personally following up");
    const marker = calls.find((c) => c.table === "sequence_runs" && c.op === "upsert")!;
    expect(marker.values).toEqual({ account_id: "acc1", campaign_id: "camp-prior", lead_id: "lead1", status: "paused_reply" });
    expect(marker.opts).toMatchObject({ onConflict: "campaign_id,lead_id", ignoreDuplicates: true });
  });

  it("reports (never silently swallows) a failed takeover write", async () => {
    world.failAdminWrites = true;
    const res = await sendManualReply("lead1", "linkedin", "Hi Sam");
    expect(res.sent).toBe(true); // the message itself is queued
    expect(res.notice).toMatch(/couldn't pause Vera/i);
  });

  it("sending Vera's pre-filled pending draft unedited APPROVES that draft (the Approvals transition)", async () => {
    world.duplicate = { id: "draft-1", status: "pending_review", origin: "reply_response" };
    const res = await sendManualReply("lead1", "linkedin", "Happy to — quick look Tuesday?");
    expect(res).toEqual({ sent: true });
    const approve = calls.find((c) => c.table === "scheduled_sends" && c.op === "update" && c.client === "session")!;
    expect(approve.values).toMatchObject({ status: "approved", approved_by: "user-1" });
    expect(has(approve, "eq", "id", "draft-1")).toBe(true);
    expect(has(approve, "eq", "status", "pending_review")).toBe(true);
    expect(inserts("scheduled_sends")).toHaveLength(0);
    // approving Vera's own words is not a takeover — the draft must not be canceled or the run paused
    expect(calls.some((c) => c.client === "admin")).toBe(false);
  });

  it("a duplicate of an already-queued manual message is not re-queued", async () => {
    world.duplicate = { id: "m1", status: "approved", origin: "manual" };
    const res = await sendManualReply("lead1", "linkedin", "Hi Sam");
    expect(res).toEqual({ sent: true });
    expect(inserts("scheduled_sends")).toHaveLength(0);
  });
});

describe("resumeAutomation", () => {
  it("hands a booked lead back in reply-only mode (stopped), never re-arming scripted nudges", async () => {
    world.booked = true;
    await resumeAutomation("lead1");
    const flip = calls.find((c) => c.table === "sequence_runs" && c.op === "update")!;
    expect(flip.values).toMatchObject({ status: "stopped" });
  });

  it("hands an unbooked lead back to the active sequence", async () => {
    await resumeAutomation("lead1");
    const flip = calls.find((c) => c.table === "sequence_runs" && c.op === "update")!;
    expect(flip.values).toMatchObject({ status: "active" });
  });
});
