import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getDraftQueueSummary, getCampaignStatus, getGoalProgress, getLeadScoreRationale, getBillingStatus, getReturnOnSpend, getActivationChecklist } from "./read-tools";

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
        not: () => builder,
        or: () => builder,
        returns: () => builder,
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
        { channel: "linkedin" },
        { channel: "linkedin" },
        { channel: "linkedin" },
      ],
    });
    const dto = await getDraftQueueSummary(db, "acc1");
    expect(dto).toEqual({ pendingReview: 3, byChannel: { linkedin: 3 } });
  });

  it("returns zero counts when no rows", async () => {
    const db = fakeDb({ scheduled_sends: [] });
    const dto = await getDraftQueueSummary(db, "acc1");
    expect(dto).toEqual({ pendingReview: 0, byChannel: { linkedin: 0 } });
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
      fitVerdict: null,
      score: 87,
      rationale: "Strong ICP fit with recent funding signal.",
    });
    // No extra keys
    expect(Object.keys(dto).sort()).toEqual(["fitVerdict", "rationale", "score"]);
  });

  it("returns nulls when lead not found", async () => {
    const db = fakeDb({ leads: null });
    const dto = await getLeadScoreRationale(db, "Unknown");
    expect(dto).toEqual({ score: null, rationale: null, fitVerdict: null });
  });

  it("includes the user's own fit verdict (ML-4)", async () => {
    const db = fakeDb({
      leads: { id: "l1", ai_score: 72, ai_rationale: "ok", first_name: "Bo" },
      lead_feedback: { verdict: "not_fit" },
    });
    const dto = await getLeadScoreRationale(db, "Bo");
    expect(dto.fitVerdict).toBe("not_fit");
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

describe("getReturnOnSpend", () => {
  it("returns only the ROI DTO keys — no raw rows", async () => {
    // deal value set + a paid plan; no leads → all counts 0
    const db = fakeDb({
      accounts: { avg_deal_value_cents: 500_000, revenue_goal_cents: 2_000_000, plan: "growth" },
      leads: [],
    });
    const dto = await getReturnOnSpend(db);
    expect(Object.keys(dto).sort()).toEqual([
      "annualSpend",
      "clearsRenewalBar",
      "costPerClose",
      "costPerMeeting",
      "hasValue",
      "onPaidPlan",
      "pipelineToSpend",
    ]);
    // dollars, not cents (rule 09: the copilot speaks real numbers); Growth = $79/mo → $948/yr
    expect(dto.annualSpend).toBe(948);
    expect(dto.onPaidPlan).toBe(true);
    expect(dto.hasValue).toBe(true);
    // no meetings/closes yet → cost-per-* null, not a fabricated 0
    expect(dto.costPerMeeting).toBeNull();
    expect(dto.costPerClose).toBeNull();
  });

  it("nulls spend figures when not on a paid plan", async () => {
    const db = fakeDb({
      accounts: { avg_deal_value_cents: 500_000, revenue_goal_cents: null, plan: "none" },
      leads: [],
    });
    const dto = await getReturnOnSpend(db);
    expect(dto.onPaidPlan).toBe(false);
    expect(dto.annualSpend).toBeNull();
    expect(dto.pipelineToSpend).toBeNull();
    expect(dto.clearsRenewalBar).toBeNull();
  });
});

describe("getActivationChecklist", () => {
  // records every filter per table so the test can prove each read is pinned to the account
  function recordingDb(rows: Record<string, unknown[]>) {
    const filters: Record<string, Record<string, unknown>[]> = {};
    const db = {
      from(table: string) {
        const r = rows[table] ?? [];
        const f: Record<string, unknown> = {};
        (filters[table] ??= []).push(f);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- recursive self-referential builder
        const b: Record<string, any> = {
          select: () => b,
          match: (m: Record<string, unknown>) => (Object.assign(f, m), b),
          eq: (c: string, v: unknown) => ((f[c] = v), b),
          in: () => b,
          not: () => b,
          order: () => b,
          limit: () => b,
          maybeSingle: async () => ({ data: r[0] ?? null }),
          then: (resolve: (v: unknown) => unknown) => Promise.resolve({ data: r }).then(resolve),
        };
        return b;
      },
    } as unknown as SupabaseClient;
    return { db, filters };
  }

  it("derives the steps from the account's own rows, pinned to the session account", async () => {
    const { db, filters } = recordingDb({
      agents: [{ targeting: { titles: ["CFO"] } }],
      lead_feedback: [],
      scheduled_sends: [{ id: "x", created_at: "2026-10-20T10:00:00Z" }],
      meeting_connections: [],
      crm_connections: [],
      linkedin_accounts: [{ status: "active" }],
    });
    const dto = await getActivationChecklist(db, "acc1");
    expect(dto.done).toBe(4);
    expect(dto.steps).toEqual([
      { label: "Confirm your buyers", done: true },
      { label: "Review first prospects", done: true },
      { label: "Connect LinkedIn", done: true },
      { label: "Approve your first message", done: true },
      { label: "Connect calendar or CRM (optional)", done: false },
    ]);
    for (const [table, calls] of Object.entries(filters)) {
      for (const f of calls) expect(f.account_id, table).toBe("acc1");
    }
  });

  it("a fresh account has nothing done; null targeting is not confirmed", async () => {
    const { db } = recordingDb({ agents: [{ targeting: null }] });
    const dto = await getActivationChecklist(db, "acc1");
    expect(dto.done).toBe(0);
    expect(dto.steps.every((s) => !s.done)).toBe(true);
  });
});
