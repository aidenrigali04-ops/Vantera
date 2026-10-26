import { beforeEach, describe, expect, it, vi } from "vitest";

// Recording Supabase fake — the builder surface setLeadFit uses.
type Call = { table: string; op: string; values?: Record<string, unknown>; opts?: Record<string, unknown> };
const calls: Call[] = [];

function makeClient() {
  return {
    auth: { getUser: async () => ({ data: { user: { id: "user-1" } } }) },
    from(table: string) {
      const call: Call = { table, op: "select" };
      const settle = () => {
        calls.push(call);
        if (table === "accounts") return Promise.resolve({ data: { id: "acc1" }, error: null });
        return Promise.resolve({ data: null, error: null });
      };
      const builder: Record<string, unknown> = {
        select: () => builder,
        limit: () => builder,
        eq: () => builder,
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
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const { setLeadFit } = await import("./fit-actions");

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}
const upsert = () => calls.find((c) => c.table === "lead_feedback" && c.op === "upsert");

beforeEach(() => {
  calls.length = 0;
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
