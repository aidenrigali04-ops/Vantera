import { beforeEach, describe, expect, it, vi } from "vitest";

// updateSendMode only: an RLS-refused write (non-admin) returns 0 rows, not an error — the
// action must treat that as a refusal so the Approvals switch snaps back.
let updated: unknown = [{ id: "c1" }];
let updateError: unknown = null;
const revalidated: string[] = [];
const filters: Array<[string, unknown]> = [];

vi.mock("next/cache", () => ({ revalidatePath: (p: string) => revalidated.push(p) }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@trigger.dev/sdk", () => ({ tasks: { trigger: vi.fn() } }));
vi.mock("@vantera/agent-brains", () => ({ deriveIntentWatchlist: vi.fn() }));
vi.mock("./scout/targeting/resolve-icp", () => ({ saveScoutIcp: vi.fn() }));
vi.mock("@/lib/validation/buyers", () => ({ parseBuyersForm: vi.fn() }));
vi.mock("@/lib/billing/entitlement", () => ({ gate: vi.fn(), loadBillingRow: vi.fn(), hasActivePlan: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: () => {
      const b: Record<string, unknown> = {
        update: () => b,
        eq: (col: string, val: unknown) => (filters.push([col, val]), b),
        select: () => Promise.resolve({ data: updated, error: updateError }),
      };
      return b;
    },
  }),
}));

const { updateSendMode } = await import("./actions");

function form(campaignId: string, sendMode: string) {
  const fd = new FormData();
  fd.set("campaignId", campaignId);
  fd.set("sendMode", sendMode);
  return fd;
}

beforeEach(() => {
  updated = [{ id: "c1" }];
  updateError = null;
  revalidated.length = 0;
  filters.length = 0;
});

describe("updateSendMode", () => {
  it("succeeds when the campaign row landed", async () => {
    expect(await updateSendMode({}, form("c1", "automatic"))).toEqual({});
    expect(filters).toContainEqual(["id", "c1"]);
    expect(revalidated).toEqual(expect.arrayContaining(["/playbook", "/approvals"]));
  });

  it("a non-admin (0 rows back) gets the admin-only error and nothing revalidates", async () => {
    updated = [];
    expect(await updateSendMode({}, form("c1", "automatic"))).toEqual({
      error: "Could not update send mode. Only workspace admins can do this.",
    });
    expect(revalidated).toEqual([]);
  });

  it("rejects an invalid mode", async () => {
    expect((await updateSendMode({}, form("c1", "manual"))).error).toBe("Invalid request.");
  });
});
