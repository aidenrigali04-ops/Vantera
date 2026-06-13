import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getDraftQueueSummary, getCampaignStatus, getGoalProgress, getLeadScoreRationale, getBillingStatus } from "./read-tools";

// fake supabase: each query resolves to the canned result for its table
function fakeDb(rows: Record<string, unknown>) {
  return {
    from(table: string) {
      const r = rows[table];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- recursive self-referential builder; no practical typed alternative
      const builder: Record<string, any> = {
        select: () => builder,
        eq: () => builder,
        in: () => builder,
        limit: () => builder,
        order: () => builder,
        ilike: () => builder,
        maybeSingle: async () => ({ data: Array.isArray(r) ? r[0] : r }),
        then: (resolve: (v: unknown) => unknown) =>
          Promise.resolve({ data: r, count: Array.isArray(r) ? r.length : null }).then(resolve),
      };
      return builder;
    },
  } as unknown as SupabaseClient;
}

describe("getDraftQueueSummary", () => {
  it("returns only {pendingReview, byChannel} — no raw rows", async () => {
    const db = fakeDb({
      scheduled_sends: [
        { channel: "email" },
        { channel: "email" },
        { channel: "linkedin" },
      ],
    });
    const dto = await getDraftQueueSummary(db, "acc1");
    expect(dto).toEqual({ pendingReview: 3, byChannel: { email: 2, linkedin: 1 } });
  });

  it("returns zero counts when no rows", async () => {
    const db = fakeDb({ scheduled_sends: [] });
    const dto = await getDraftQueueSummary(db, "acc1");
    expect(dto).toEqual({ pendingReview: 0, byChannel: { email: 0, linkedin: 0 } });
  });
});

describe("getCampaignStatus", () => {
  it("returns only agentName/live/sendMode", async () => {
    const db = fakeDb({
      agents: { name: "Penn", status: "live", campaigns: { send_mode: "review" } },
    });
    expect(await getCampaignStatus(db, "acc1")).toEqual({
      agentName: "Penn",
      live: true,
      sendMode: "review",
    });
  });

  it("returns nulls when no agent found", async () => {
    const db = fakeDb({ agents: null });
    const dto = await getCampaignStatus(db, "acc1");
    expect(dto).toEqual({ agentName: null, live: false, sendMode: null });
  });

  it("does not include account_id or raw row fields", async () => {
    const db = fakeDb({
      agents: { name: "Apex", status: "paused", campaigns: { send_mode: "automatic" } },
    });
    const dto = await getCampaignStatus(db, "acc1");
    expect(Object.keys(dto).sort()).toEqual(["agentName", "live", "sendMode"]);
  });
});

describe("getGoalProgress", () => {
  it("returns the correct DTO shape with expected keys", async () => {
    // For getGoalProgress with multi-count queries, the fake's `then` returns the same
    // count for every call. We test shape/keys and goalRevenue mapping.
    const db = fakeDb({
      accounts: { revenue_goal_cents: 5000000 },
      leads: null,
    });
    const dto = await getGoalProgress(db, "acc1");
    // Assert shape — exact keys, no account_id or raw rows
    expect(Object.keys(dto).sort()).toEqual([
      "goalRevenue",
      "inOutreach",
      "qualifiedLeads",
      "replied",
    ]);
    // goalRevenue maps from revenue_goal_cents, converted to dollars (rule 09: real numbers)
    expect(dto.goalRevenue).toBe(50000);
    // count fields are numbers
    expect(typeof dto.qualifiedLeads).toBe("number");
    expect(typeof dto.inOutreach).toBe("number");
    expect(typeof dto.replied).toBe("number");
  });

  it("returns null goalRevenue when account has no goal set", async () => {
    const db = fakeDb({ accounts: { revenue_goal_cents: null }, leads: [] });
    const dto = await getGoalProgress(db, "acc1");
    expect(dto.goalRevenue).toBeNull();
  });
});

describe("getLeadScoreRationale", () => {
  it("returns score and rationale from lead", async () => {
    const db = fakeDb({
      leads: {
        ai_score: 87,
        ai_rationale: "Strong ICP fit with recent funding signal.",
        first_name: "Alice",
        last_name: "Smith",
      },
    });
    const dto = await getLeadScoreRationale(db, "Alice");
    expect(dto).toEqual({
      score: 87,
      rationale: "Strong ICP fit with recent funding signal.",
    });
    // No extra keys
    expect(Object.keys(dto).sort()).toEqual(["rationale", "score"]);
  });

  it("returns nulls when lead not found", async () => {
    const db = fakeDb({ leads: null });
    const dto = await getLeadScoreRationale(db, "Unknown");
    expect(dto).toEqual({ score: null, rationale: null });
  });
});

describe("getBillingStatus", () => {
  it("returns plan + usage, never raw billing columns", async () => {
    // accounts -> maybeSingle: growth plan, active, 0 extra seats/linkedin
    // account_members -> array of 2 (count = 2 via then)
    // campaigns -> array of 1 (count = 1 via then)
    const db = fakeDb({
      accounts: {
        plan: "growth",
        subscription_status: "active",
        seats_purchased: 0,
        linkedin_accounts_purchased: 0,
        current_period_end: null,
      },
      account_members: [{}, {}],
      campaigns: [{}],
    });
    const dto = await getBillingStatus(db, "acc_1");
    expect(dto.plan).toBe("growth");
    expect(dto.status).toBe("active");
    expect(dto.seats.used).toBe(2);
    expect(dto.campaigns.used).toBe(1);
    expect(typeof dto.seats.max).toBe("number");
    expect(typeof dto.campaigns.max).toBe("number");
    // Must not expose raw billing columns
    expect(dto).not.toHaveProperty("stripe_customer_id");
    expect(dto).not.toHaveProperty("subscription_status");
    expect(dto).not.toHaveProperty("seats_purchased");
    // Shape: exactly plan, status, seats, campaigns
    expect(Object.keys(dto).sort()).toEqual(["campaigns", "plan", "seats", "status"]);
  });

  it("returns zero seats/campaigns and empty limits when plan is none", async () => {
    const db = fakeDb({
      accounts: {
        plan: "none",
        subscription_status: "none",
        seats_purchased: 0,
        linkedin_accounts_purchased: 0,
        current_period_end: null,
      },
      account_members: [],
      campaigns: [],
    });
    const dto = await getBillingStatus(db, "acc_1");
    expect(dto.plan).toBe("none");
    expect(dto.status).toBe("none");
    expect(dto.seats.used).toBe(0);
    expect(dto.campaigns.used).toBe(0);
    expect(dto.seats.max).toBe(0);
    expect(dto.campaigns.max).toBe(0);
  });
});
