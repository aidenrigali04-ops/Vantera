import { beforeEach, describe, expect, it, vi } from "vitest";

// Minimal Supabase fake for setDealValue: the account select (maybeSingle) and the update
// (awaited after .select("id")). `updateRows` decides what the RLS-scoped update returns.
type Call = { table: string; op: "select" | "update"; values?: Record<string, unknown> };

const calls: Call[] = [];
const revalidated: string[] = [];
let user: { id: string } | null = { id: "user-1" };
let updateRows: unknown[] | null = [{ id: "acct-1" }];

function makeClient() {
  return {
    auth: { getUser: async () => ({ data: { user } }) },
    from(table: string) {
      const call: Call = { table, op: "select" };
      calls.push(call);
      const builder: Record<string, unknown> = {
        select: () => builder,
        update: (v: Record<string, unknown>) => {
          call.op = "update";
          call.values = v;
          return builder;
        },
        eq: () => builder,
        limit: () => builder,
        maybeSingle: async () => ({ data: { id: "acct-1" }, error: null }),
        then: (ok: (v: unknown) => unknown) => Promise.resolve({ data: updateRows, error: null }).then(ok),
      };
      return builder;
    },
  };
}

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => makeClient() }));
vi.mock("next/cache", () => ({ revalidatePath: (p: string) => revalidated.push(p) }));

const { setDealValue } = await import("./actions");

const form = (dealValue: string) => {
  const fd = new FormData();
  fd.set("dealValue", dealValue);
  return fd;
};

beforeEach(() => {
  calls.length = 0;
  revalidated.length = 0;
  user = { id: "user-1" };
  updateRows = [{ id: "acct-1" }];
});

describe("setDealValue", () => {
  it("saves cents and revalidates every surface that reads the deal size", async () => {
    expect(await setDealValue(form("$2,500"))).toEqual({ ok: true });
    expect(calls.find((c) => c.op === "update")).toMatchObject({ table: "accounts", values: { avg_deal_value_cents: 250_000 } });
    expect(revalidated.sort()).toEqual(["/dashboard", "/prospects", "/settings", "/today"]);
  });
  it("a non-admin's update matches zero rows", async () => {
    updateRows = [];
    expect(await setDealValue(form("2500"))).toEqual({ ok: false, message: "Only an admin can set this." });
    expect(revalidated).toEqual([]);
  });
  it("an expired session never writes", async () => {
    user = null;
    expect(await setDealValue(form("2500"))).toEqual({ ok: false, message: "Your session expired. Sign in again." });
    expect(calls.some((c) => c.op === "update")).toBe(false);
  });
  it("rejects a bad amount before touching the database", async () => {
    expect(await setDealValue(form("12.5"))).toEqual({ ok: false, message: "Enter a whole-dollar amount." });
    expect(calls).toEqual([]);
  });
});
