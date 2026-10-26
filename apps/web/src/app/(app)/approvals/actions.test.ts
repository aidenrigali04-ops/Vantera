import { beforeEach, describe, expect, it, vi } from "vitest";

// Recording fake for the saveDraftEdit update path: update(...).eq().eq().select("id").
type Call = { table: string; op: string; values?: Record<string, unknown>; filters: [string, unknown][] };
const calls: Call[] = [];
let updatedRows: { id: string }[] = [];
const revalidated: string[] = [];

function makeClient() {
  return {
    auth: { getUser: async () => ({ data: { user: { id: "user-1" } } }) },
    from(table: string) {
      const call: Call = { table, op: "select", filters: [] };
      const settle = () => {
        calls.push(call);
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

const { saveDraftEdit } = await import("./actions");

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  calls.length = 0;
  revalidated.length = 0;
  updatedRows = [{ id: "s1" }];
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
