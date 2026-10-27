import { beforeEach, describe, expect, it, vi } from "vitest";

// Recording Supabase fake — the builder surface setLeadFit uses.
type Call = {
  table: string;
  op: string;
  values?: Record<string, unknown>;
  opts?: Record<string, unknown>;
  filters: Array<[string, unknown]>;
};
const calls: Call[] = [];
const revalidated: string[] = [];
let canceledRows: unknown = [{ id: "s1" }];
let cancelError: unknown = null;

function makeClient() {
  return {
    auth: { getUser: async () => ({ data: { user: { id: "user-1" } } }) },
    from(table: string) {
      const call: Call = { table, op: "select", filters: [] };
      const settle = () => {
        calls.push(call);
        if (table === "accounts") return Promise.resolve({ data: { id: "acc1" }, error: null });
        if (table === "scheduled_sends") return Promise.resolve({ data: canceledRows, error: cancelError });
        return Promise.resolve({ data: null, error: null });
      };
      const builder: Record<string, unknown> = {
        select: () => builder,
        limit: () => builder,
        eq: (col: string, val: unknown) => {
          call.filters.push([col, val]);
          return builder;
        },
        update: (v: Record<string, unknown>) => {
          call.op = "update";
          call.values = v;
          return builder;
        },
        delete: () => {
          call.op = "delete";
          return builder;
        },
        upsert: (v: Record<string, unknown>, o?: Record<string, unknown>) => {
          call.op = "upsert";
          call.values = v;
          call.opts = o;
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

const { setLeadFit } = await import("./fit-actions");

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}
const upsert = () => calls.find((c) => c.table === "lead_feedback" && c.op === "upsert");

const cancel = () => calls.find((c) => c.table === "scheduled_sends" && c.op === "update");

beforeEach(() => {
  calls.length = 0;
  revalidated.length = 0;
  canceledRows = [{ id: "s1" }];
  cancelError = null;
});

describe("setLeadFit reason", () => {
  it("writes the trimmed reason when present", async () => {
    const res = await setLeadFit({}, form({ leadId: "l1", verdict: "not_fit", reason: "  Too small a team  " }));
    expect(res).toEqual({ verdict: "not_fit" });
    expect(upsert()?.values).toMatchObject({ lead_id: "l1", verdict: "not_fit", reason: "Too small a team" });
  });

  it("omits the reason when blank", async () => {
    await setLeadFit({}, form({ leadId: "l1", verdict: "not_fit", reason: "   " }));
    expect(upsert()?.values).toBeDefined();
    expect(upsert()?.values).not.toHaveProperty("reason");
  });

  it("omits the reason when the field is absent", async () => {
    await setLeadFit({}, form({ leadId: "l1", verdict: "good_fit" }));
    expect(upsert()?.values).not.toHaveProperty("reason");
  });

  it("rejects a reason over 200 characters without writing", async () => {
    const res = await setLeadFit({}, form({ leadId: "l1", verdict: "not_fit", reason: "x".repeat(201) }));
    expect(res.error).toBeTruthy();
    expect(upsert()).toBeUndefined();
  });

  it("clear is unchanged — deletes the verdict", async () => {
    const res = await setLeadFit({}, form({ leadId: "l1", verdict: "clear" }));
    expect(res).toEqual({ verdict: null });
    expect(calls.some((c) => c.table === "lead_feedback" && c.op === "delete")).toBe(true);
  });
});

describe("setLeadFit not_fit withdraws a queued draft", () => {
  it("cancels this lead's pending_review drafts and revalidates the queues", async () => {
    const res = await setLeadFit({}, form({ leadId: "l1", verdict: "not_fit" }));
    expect(res).toEqual({ verdict: "not_fit" });
    expect(cancel()?.values).toEqual({ status: "canceled" });
    expect(cancel()?.filters).toEqual(expect.arrayContaining([["lead_id", "l1"], ["status", "pending_review"]]));
    expect(revalidated).toEqual(expect.arrayContaining(["/prospects", "/approvals", "/today"]));
  });

  it("0 rows canceled (nothing queued, or a non-admin member) is normal — the verdict still saves", async () => {
    canceledRows = [];
    expect(await setLeadFit({}, form({ leadId: "l1", verdict: "not_fit" }))).toEqual({ verdict: "not_fit" });
  });

  it("good_fit and clear never touch the queue", async () => {
    await setLeadFit({}, form({ leadId: "l1", verdict: "good_fit" }));
    await setLeadFit({}, form({ leadId: "l1", verdict: "clear" }));
    expect(cancel()).toBeUndefined();
  });
});
