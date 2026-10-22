import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((to: string) => {
    throw new Error(`REDIRECT:${to}`);
  }),
}));

type Call = { table: string; op: string; payload?: unknown; opts?: unknown; filters: Array<[string, string, unknown]> };

/** Records every write the action makes; reads come from `rows`. */
function fakeSupabase(rows: Record<string, Record<string, unknown>[]>) {
  const calls: Call[] = [];
  const from = (table: string) => {
    const call: Call = { table, op: "select", filters: [] };
    const b = {
      select: () => b,
      limit: () => b,
      upsert: (payload: unknown, opts?: unknown) => (Object.assign(call, { op: "upsert", payload, opts }), calls.push(call), b),
      update: (payload: unknown) => (Object.assign(call, { op: "update", payload }), calls.push(call), b),
      eq: (c: string, v: unknown) => (call.filters.push(["eq", c, v]), b),
      in: (c: string, v: unknown) => (call.filters.push(["in", c, v]), b),
      is: (c: string, v: unknown) => (call.filters.push(["is", c, v]), b),
      maybeSingle: async () => ({ data: rows[table]?.[0] ?? null, error: null }),
      then: (res: (v: { data: null; error: null }) => unknown) => res({ data: null, error: null }),
    };
    return b;
  };
  return {
    calls,
    client: { from, auth: { getUser: async () => ({ data: { user: { id: "user-1" } } }) } },
  };
}

let fake: ReturnType<typeof fakeSupabase>;
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => fake.client }));

import { rejectPreviewLead, confirmProspects } from "./preview-actions";

describe("preview actions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reject writes not_fit with reason onboarding_preview and cancels the lead's pending sends as wrong_person", async () => {
    fake = fakeSupabase({ accounts: [{ id: "acc-1" }] });
    const res = await rejectPreviewLead("lead-9");
    expect(res).toEqual({});

    const fb = fake.calls.find((c) => c.table === "lead_feedback");
    expect(fb).toMatchObject({
      op: "upsert",
      payload: { account_id: "acc-1", lead_id: "lead-9", verdict: "not_fit", reason: "onboarding_preview", created_by: "user-1" },
      opts: { onConflict: "lead_id" },
    });

    const sends = fake.calls.find((c) => c.table === "scheduled_sends");
    expect(sends?.op).toBe("update");
    expect(sends?.payload).toEqual({ status: "canceled", rejection_reason: "wrong_person" });
    expect(sends?.filters).toEqual(
      expect.arrayContaining([
        ["eq", "account_id", "acc-1"],
        ["eq", "lead_id", "lead-9"],
        ["in", "status", ["pending_review", "approved"]],
      ])
    );
  });

  it("confirmProspects stamps prospects_reviewed_at once and redirects even when the run is scanning", async () => {
    // the run is mid-scan — confirming never waits on it
    fake = fakeSupabase({ accounts: [{ id: "acc-1", prospects_reviewed_at: null }], reveal_runs: [{ status: "scanning" }] });
    await expect(confirmProspects()).rejects.toThrow("REDIRECT:/onboarding?done=prospects");
    const stamps = fake.calls.filter((c) => c.table === "accounts" && c.op === "update");
    expect(stamps).toHaveLength(1);
    expect(stamps[0].payload).toEqual({ prospects_reviewed_at: expect.any(String) });
    expect(stamps[0].filters).toEqual(expect.arrayContaining([["eq", "id", "acc-1"], ["is", "prospects_reviewed_at", null]]));

    // already reviewed → no second stamp, still redirects
    fake = fakeSupabase({ accounts: [{ id: "acc-1", prospects_reviewed_at: "2026-10-22T00:00:00Z" }] });
    await expect(confirmProspects()).rejects.toThrow("REDIRECT:/onboarding?done=prospects");
    expect(fake.calls.filter((c) => c.table === "accounts" && c.op === "update")).toHaveLength(0);
  });
});
