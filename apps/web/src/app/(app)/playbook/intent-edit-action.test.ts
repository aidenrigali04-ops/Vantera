import { beforeEach, describe, expect, it, vi } from "vitest";

// updateIntentAgent: RLS-scoped update of the account's one intent row. An RLS-refused write
// (non-admin) returns 0 rows, not an error — that must surface as the admin-only message.
let updated: unknown = [{ id: "a1" }];
const revalidated: string[] = [];
const filters: Array<[string, unknown]> = [];
const payloads: Record<string, unknown>[] = [];
const redirectMock = vi.fn();

vi.mock("next/cache", () => ({ revalidatePath: (p: string) => revalidated.push(p) }));
vi.mock("next/navigation", () => ({ redirect: (p: string) => redirectMock(p) }));
vi.mock("@trigger.dev/sdk", () => ({ tasks: { trigger: vi.fn() } }));
vi.mock("@vantera/agent-brains", () => ({ deriveIntentWatchlist: vi.fn() }));
vi.mock("./scout/targeting/resolve-icp", () => ({ saveScoutIcp: vi.fn() }));
vi.mock("@/lib/validation/buyers", () => ({ parseBuyersForm: vi.fn() }));
vi.mock("@/lib/billing/entitlement", () => ({ gate: vi.fn(), loadBillingRow: vi.fn(), hasActivePlan: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
    from: (table: string) => {
      const b: Record<string, unknown> = {
        select: () => (table === "agents" ? Promise.resolve({ data: updated, error: null }) : b),
        limit: () => b,
        maybeSingle: async () => ({ data: { id: "acct1", onboarding_icp: null } }),
        update: (payload: Record<string, unknown>) => (payloads.push(payload), b),
        eq: (col: string, val: unknown) => (filters.push([col, val]), b),
      };
      return b;
    },
  }),
}));

const { updateIntentAgent } = await import("./actions");

function form(overrides: Record<string, string> = {}) {
  const fd = new FormData();
  fd.set("name", "Radar");
  fd.set("creators", "[]");
  fd.set("competitors", JSON.stringify(["Gainsight"]));
  fd.set("keywords", JSON.stringify(["churn"]));
  fd.set("hashtags", JSON.stringify(["cs"]));
  fd.set("signalContent", "on");
  fd.set("runAtTime", "10:00");
  fd.set("cadence", "weekly");
  fd.set("timezone", "America/Chicago");
  for (const [k, v] of Object.entries(overrides)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  updated = [{ id: "a1" }];
  revalidated.length = 0;
  filters.length = 0;
  payloads.length = 0;
  redirectMock.mockReset();
});

describe("updateIntentAgent", () => {
  it("writes the new config on the intent row, revalidates, and redirects", async () => {
    await updateIntentAgent({}, form());
    expect(filters).toContainEqual(["kind", "intent"]);
    expect(filters).toContainEqual(["account_id", "acct1"]);
    expect(payloads).toHaveLength(1);
    expect(payloads[0]).toEqual({
      name: "Radar",
      config: {
        watch: { creators: [], competitors: ["Gainsight"], keywords: ["churn"], hashtags: ["#cs"] },
        signals: { engagement: false, content: true, follows: false },
        min_score: 70,
      },
      run_at_time: "10:00",
      cadence: "weekly",
      timezone: "America/Chicago",
      next_run_at: null,
    });
    // status and deployed_at are never touched by an edit
    expect(payloads[0]).not.toHaveProperty("status");
    expect(payloads[0]).not.toHaveProperty("deployed_at");
    expect(revalidated).toEqual(expect.arrayContaining(["/playbook", "/playbook/intent"]));
    expect(redirectMock).toHaveBeenCalledWith("/playbook/intent");
  });

  it("a non-admin (0 rows back) gets the admin-only error and nothing revalidates", async () => {
    updated = [];
    expect(await updateIntentAgent({}, form())).toEqual({ error: "Only an admin can change this agent." });
    expect(revalidated).toEqual([]);
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid form before touching the database", async () => {
    const r = await updateIntentAgent({}, form({ name: "" }));
    expect(r.error).toMatch(/name/i);
    expect(payloads).toHaveLength(0);
  });
});
