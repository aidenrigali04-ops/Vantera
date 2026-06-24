import { describe, expect, it } from "vitest";
import { InMemoryProspectData, makeCandidate } from "@vantera/prospect-data";
import type { LeadInsights } from "@vantera/agent-brains";
import { runScout, pickHotSignal } from "./scout";
import { TRIAL_LEAD_CAP } from "./types";
import type { CopyDraftPayload, FreshLead, ScoutContext, ScoutDeps, ScoutStore } from "./types";
import { QUALIFIED_POOL_TARGET, type OutreachCapacity } from "./capacity";

function insight(leadId: string, score: number): LeadInsights {
  return {
    lead_id: leadId,
    reasoning: "r",
    score,
    rationale: "rat",
    pain_points: ["p"],
    triggers: ["t"],
    motivations: ["m"],
    value_angle: "v",
    aha_moment: "a",
    summary: "s",
  };
}

class FakeScoutStore implements ScoutStore {
  context: ScoutContext | null;
  scans: { accountId: string; url: string }[] = [];
  upserted: { icpId: string; refs: string[] }[] = [];
  gates = new Map<string, boolean>();
  enriched: string[] = [];
  scores = new Map<string, { score: number; qualified: boolean }>();
  completedAt: Date | null = null;
  copyAgent: { id: string } | null = null;
  capacity: OutreachCapacity = {
    linkedinConnected: true,
    linkedinAccountAgeDays: 100, // steady state → ample capacity by default
    linkedinEnabled: true,
  };
  backlog = 0;
  leadCount = 0; // what countAccountLeads reports (trial-cap input)
  private leadSeq = 0;
  private seenRefs = new Set<string>();

  constructor(context: ScoutContext) {
    this.context = context;
  }
  async getScoutContext() {
    return this.context;
  }
  async countAccountLeads() {
    return this.leadCount;
  }
  async saveWebsiteScan(accountId: string, url: string) {
    this.scans.push({ accountId, url });
  }
  async upsertLeads(_accountId: string, icpId: string, candidates: ReturnType<typeof makeCandidate>[]) {
    const fresh: FreshLead[] = [];
    for (const candidate of candidates) {
      if (this.seenRefs.has(candidate.externalRef)) continue; // dedupe across runs
      this.seenRefs.add(candidate.externalRef);
      fresh.push({ leadId: `lead_${++this.leadSeq}_${candidate.externalRef}`, icpId, candidate });
    }
    this.upserted.push({ icpId, refs: fresh.map((f) => f.candidate.externalRef) });
    return fresh;
  }
  async markRulesGate(leadId: string, result: { passed: boolean }) {
    this.gates.set(leadId, result.passed);
  }
  async saveEnrichment(_leadId: string, _accountId: string, enriched: { externalRef: string }) {
    this.enriched.push(enriched.externalRef);
  }
  async saveScore(leadId: string, ins: LeadInsights, qualified: boolean) {
    this.scores.set(leadId, { score: ins.score, qualified });
  }
  hotSignals: { leadId: string; label: string }[] = [];
  async notifyHotSignals(_accountId: string, items: { leadId: string; label: string }[]) {
    this.hotSignals.push(...items);
  }
  async completeRun(_agentId: string, lastRunAt: Date) {
    this.completedAt = lastRunAt;
  }
  async getOutreachCapacity() {
    return this.capacity;
  }
  async countUncontactedLeads() {
    return this.backlog;
  }
  async getLiveCopyAgent() {
    return this.copyAgent;
  }
  qualifiedPoolOverride: number | null = null;
  async countQualifiedPool() {
    if (this.qualifiedPoolOverride !== null) return this.qualifiedPoolOverride;
    return [...this.scores.values()].filter((s) => s.qualified).length;
  }
  async getTopQualifiedLeadIds(_accountId: string, limit: number) {
    return [...this.scores.entries()]
      .filter(([, s]) => s.qualified)
      .sort((a, b) => b[1].score - a[1].score)
      .slice(0, limit)
      .map(([id]) => id);
  }
}

function makeContext(overrides: Partial<ScoutContext["account"]> = {}): ScoutContext {
  return {
    agent: { id: "scout1", accountId: "acc1", status: "live", cadence: "daily", config: { prospectsPerRun: 10, minScore: 70 } },
    icps: [{ id: "icp1", name: "SaaS CTOs", criteria: { industries: ["saas"] } }],
    account: {
      industry: "devtools",
      websiteUrl: null,
      websiteScan: null,
      websiteScannedAt: null,
      subscriptionStatus: "active",
      intentEnabled: false,
      ...overrides,
    },
  };
}

function makeDeps(store: FakeScoutStore, pool: ReturnType<typeof makeCandidate>[], scores: Record<string, number>) {
  const prospectData = new InMemoryProspectData(pool);
  const ranked: string[][] = [];
  const chained: CopyDraftPayload[] = [];
  const deps: ScoutDeps = {
    store,
    prospectData,
    scanFn: async () => ({
      summary: "sells SDR agents",
      offerings: ["agents"],
      value_props: ["meetings"],
      scope_of_industry: "b2b sales",
    }),
    rankFn: async (candidates) => {
      ranked.push(candidates.map((c) => c.leadId));
      return candidates.map((c) => insight(c.leadId, scores[c.leadId.split("_").at(-1)!] ?? 50));
    },
    triggerCopyDraft: async (p) => {
      chained.push(p);
    },
    now: () => new Date("2026-06-11T08:00:00Z"),
  };
  return { deps, prospectData, ranked, chained };
}

describe("runScout", () => {
  it("gates before AI: only rules-gate survivors are enriched and ranked", async () => {
    const pool = [
      makeCandidate({ externalRef: "good", industry: "saas" }),
      makeCandidate({ externalRef: "bad", industry: "logistics" }),
    ];
    const store = new FakeScoutStore(makeContext());
    const { deps, prospectData, ranked } = makeDeps(store, pool, { good: 90 });

    const summary = await runScout("scout1", deps);

    // the fake source only returns saas matches for the saas filter, so discovery
    // already excludes "bad"; assert the gate result and enrichment spend
    expect(summary.gatePassed).toBe(1);
    expect(prospectData.enrichCalls).toEqual([[{ externalRef: "good" }]]);
    expect(ranked.flat().join()).toContain("good");
    expect(store.enriched).toEqual(["good"]);
  });

  it("rejects gate failures with reasons and never enriches them", async () => {
    // both candidates match the discovery filter loosely, but the gate criteria are stricter
    const pool = [
      makeCandidate({ externalRef: "fit", industry: "saas", title: "CTO" }),
      makeCandidate({ externalRef: "nofit", industry: "saas", title: "Intern" }),
    ];
    const context = makeContext();
    // seniorities is gate-only (the in-memory source doesn't filter on it), so
    // both candidates survive discovery and the gate decides
    context.icps = [
      { id: "icp1", name: "CTOs", criteria: { industries: ["saas"], seniorities: ["cto"] } },
    ];
    const store = new FakeScoutStore(context);
    const { deps, prospectData } = makeDeps(store, pool, { fit: 80 });

    const summary = await runScout("scout1", deps);

    expect(summary.gatePassed).toBe(1);
    expect(prospectData.enrichCalls).toEqual([[{ externalRef: "fit" }]]);
    expect([...store.gates.values()].sort()).toEqual([false, true]);
  });

  it("marks leads qualified only at or above min_score", async () => {
    const pool = [
      makeCandidate({ externalRef: "hi", industry: "saas" }),
      makeCandidate({ externalRef: "lo", industry: "saas" }),
    ];
    const store = new FakeScoutStore(makeContext());
    const { deps } = makeDeps(store, pool, { hi: 85, lo: 55 });

    const summary = await runScout("scout1", deps);

    expect(summary.qualified).toBe(1);
    const results = [...store.scores.values()];
    expect(results.find((r) => r.score === 85)?.qualified).toBe(true);
    expect(results.find((r) => r.score === 55)?.qualified).toBe(false);
  });

  it("dedupes: a second run with the same candidates ranks nothing new", async () => {
    const pool = [makeCandidate({ externalRef: "dup", industry: "saas" })];
    const store = new FakeScoutStore(makeContext());
    const { deps, ranked } = makeDeps(store, pool, { dup: 90 });

    await runScout("scout1", deps);
    const second = await runScout("scout1", deps);

    expect(ranked).toHaveLength(1);
    expect(second.qualified).toBe(0);
  });

  it("chains the copy agent only when one is live and leads qualified", async () => {
    const pool = [makeCandidate({ externalRef: "good", industry: "saas" })];
    const store = new FakeScoutStore(makeContext());
    store.copyAgent = { id: "copy1" };
    const { deps, chained } = makeDeps(store, pool, { good: 90 });

    await runScout("scout1", deps);

    expect(chained).toHaveLength(1);
    expect(chained[0]!.copyAgentId).toBe("copy1");
    expect(chained[0]!.leadIds).toHaveLength(1);
  });

  it("does not chain when no copy agent is live", async () => {
    const pool = [makeCandidate({ externalRef: "good", industry: "saas" })];
    const store = new FakeScoutStore(makeContext());
    const { deps, chained } = makeDeps(store, pool, { good: 90 });

    await runScout("scout1", deps);

    expect(chained).toHaveLength(0);
  });

  it("scans the website when set and stale, and survives scan failure", async () => {
    const pool = [makeCandidate({ externalRef: "good", industry: "saas" })];
    const store = new FakeScoutStore(makeContext({ websiteUrl: "https://acme.com" }));
    const { deps } = makeDeps(store, pool, { good: 90 });

    await runScout("scout1", deps);
    expect(store.scans).toEqual([{ accountId: "acc1", url: "https://acme.com" }]);

    // failing scan never blocks the run
    const store2 = new FakeScoutStore(makeContext({ websiteUrl: "https://acme.com" }));
    const broken = makeDeps(store2, pool, { good: 90 });
    broken.deps.scanFn = async () => {
      throw new Error("boom");
    };
    const summary = await runScout("scout1", broken.deps);
    expect(summary.status).toBe("completed");
  });

  it("skips paused or icp-less agents", async () => {
    const context = makeContext();
    context.agent.status = "paused";
    const store = new FakeScoutStore(context);
    const { deps } = makeDeps(store, [], {});

    expect((await runScout("scout1", deps)).status).toBe("skipped");
  });

  it("trial cap: a trialing account at the lead ceiling sources nothing new (no discovery spend)", async () => {
    const pool = [makeCandidate({ externalRef: "good", industry: "saas" })];
    const store = new FakeScoutStore(makeContext({ subscriptionStatus: "trialing" }));
    store.leadCount = TRIAL_LEAD_CAP; // already at the ceiling
    const { deps, prospectData } = makeDeps(store, pool, { good: 90 });

    const summary = await runScout("scout1", deps);

    // discovery is clamped to 0 by the trial cap → no discovery/enrichment spend; the run still
    // completes (the draft phase may drain any existing qualified pool — none here, no copy agent).
    expect(summary.status).toBe("completed");
    expect(summary.discovered).toBe(0);
    expect(store.enriched).toEqual([]);
    expect(prospectData.enrichCalls).toEqual([]);
  });

  it("trial cap: a trialing account under the ceiling still prospects", async () => {
    const pool = [makeCandidate({ externalRef: "good", industry: "saas" })];
    const store = new FakeScoutStore(makeContext({ subscriptionStatus: "trialing" }));
    store.leadCount = 0;
    const { deps } = makeDeps(store, pool, { good: 90 });

    const summary = await runScout("scout1", deps);

    expect(summary.status).toBe("completed");
    expect(store.enriched).toEqual(["good"]);
  });

  it("trial cap does not apply to a paid account past the ceiling", async () => {
    const pool = [makeCandidate({ externalRef: "good", industry: "saas" })];
    const store = new FakeScoutStore(makeContext({ subscriptionStatus: "active" }));
    store.leadCount = TRIAL_LEAD_CAP * 10; // way over — but not on trial
    const { deps } = makeDeps(store, pool, { good: 90 });

    const summary = await runScout("scout1", deps);

    expect(summary.status).toBe("completed");
    expect(store.enriched).toEqual(["good"]);
  });
});

describe("runScout — capacity throttle", () => {
  it("decouples discovery from send capacity; drafting stays send-paced + best-first", async () => {
    const pool = Array.from({ length: 25 }, (_, i) =>
      makeCandidate({ externalRef: `c${i}`, industry: "saas" })
    );
    const store = new FakeScoutStore({
      agent: { id: "scout1", accountId: "acc1", status: "live", cadence: "daily", config: { prospectsPerRun: 10, minScore: 70 } },
      icps: [{ id: "icp1", name: "SaaS CTOs", criteria: { industries: ["saas"] } }],
      account: { industry: "devtools", websiteUrl: null, websiteScan: null, websiteScannedAt: null, subscriptionStatus: "active", intentEnabled: false },
    });
    store.copyAgent = { id: "copy1" };
    store.capacity = {
      linkedinConnected: true,
      linkedinEnabled: true,
      linkedinAccountAgeDays: 3, // warmup ~5/day send capacity
    };
    const scores: Record<string, number> = {};
    for (let i = 0; i < 25; i++) scores[`c${i}`] = 90;
    const { deps, chained } = makeDeps(store, pool, scores);

    const summary = await runScout("scout1", deps);

    // overscan: the whole 25-candidate pool is sourced + qualified, regardless of low send capacity
    expect(summary.discovered).toBe(25);
    expect(summary.qualified).toBe(25);
    // but drafting is send-paced + best-first — only a warmup-sized batch is chained (far below 25)
    expect(chained).toHaveLength(1);
    expect(chained[0]!.leadIds.length).toBeGreaterThan(0);
    expect(chained[0]!.leadIds.length).toBeLessThanOrEqual(10);
  });

  it("idles discovery once the qualified pool is full, but the run still completes", async () => {
    const pool = Array.from({ length: 20 }, (_, i) => makeCandidate({ externalRef: `c${i}`, industry: "saas" }));
    const store = new FakeScoutStore(makeContext());
    store.qualifiedPoolOverride = QUALIFIED_POOL_TARGET; // pool already at target
    const { deps } = makeDeps(store, pool, {});

    const summary = await runScout("scout1", deps);

    expect(summary.discovered).toBe(0); // no discovery spend while the pool is full
    expect(store.enriched).toEqual([]);
    expect(store.completedAt).not.toBeNull();
  });

  it("still sources a bounded preview when no channel is connected, so prospects land", async () => {
    // No active mailbox/LinkedIn → dead-zone. The Scout no longer no-ops; it sources a
    // small preview so prospects appear on the dashboard/pipeline while the user connects
    // a channel (outreach still waits). See capacity.ts NO_CHANNEL_PREVIEW_CAP.
    const pool = [makeCandidate({ externalRef: "good", industry: "saas" })];
    const store = new FakeScoutStore({
      agent: { id: "scout1", accountId: "acc1", status: "live", cadence: "daily", config: { prospectsPerRun: 25, minScore: 70 } },
      icps: [{ id: "icp1", name: "SaaS CTOs", criteria: { industries: ["saas"] } }],
      account: { industry: "devtools", websiteUrl: null, websiteScan: null, websiteScannedAt: null, subscriptionStatus: "active", intentEnabled: false },
    });
    store.capacity = {
      linkedinConnected: false,
      linkedinEnabled: false,
      linkedinAccountAgeDays: null,
    };
    const { deps } = makeDeps(store, pool, { good: 90 });

    const summary = await runScout("scout1", deps);

    expect(summary.status).toBe("completed");
    expect(summary.discovered).toBe(1); // the one pooled candidate was sourced despite no channel
    expect(store.enriched.length).toBe(1);
  });
});

describe("cadence-scaled discovery (overscan)", () => {
  // Discovery overscan scales with cadence (DISCOVERY_PER_RUN_CAP × cadenceDays): a weekly run
  // sources a full week's pool in one batch. A pool larger than the daily cap shows the difference.
  const pool = Array.from({ length: 300 }, (_, i) =>
    makeCandidate({ externalRef: `p${i}`, industry: "saas" })
  );

  it("weekly overscans more than daily", async () => {
    const dailyStore = new FakeScoutStore(makeContext()); // cadence defaults to "daily"
    const daily = await runScout("scout1", makeDeps(dailyStore, pool, {}).deps);

    const weeklyCtx = makeContext();
    weeklyCtx.agent.cadence = "weekly";
    const weeklyStore = new FakeScoutStore(weeklyCtx);
    const weekly = await runScout("scout1", makeDeps(weeklyStore, pool, {}).deps);

    expect(daily.discovered).toBeGreaterThan(0);
    expect(weekly.discovered).toBeGreaterThan(daily.discovered);
  });
});

describe("runScout — credit guard", () => {
  // The prospect-data credit pool is platform-wide (shared across tenants). The Scout confirms the
  // pool can cover a run's worst case BEFORE spending; a null/unknown balance fails open.
  it("skips before any spend when the shared pool can't cover the run", async () => {
    const pool = [makeCandidate({ externalRef: "good", industry: "saas" })];
    const store = new FakeScoutStore(makeContext());
    const { deps, prospectData } = makeDeps(store, pool, { good: 90 });
    prospectData.creditBalance = { remaining: 10, allocated: 2600 }; // < runTarget * 9 for any runTarget >= floor

    const summary = await runScout("scout1", deps);

    expect(summary.status).toBe("skipped");
    expect(summary.reason).toBe("low_credits");
    expect(prospectData.discoverCalls).toEqual([]); // discovery never ran
    expect(prospectData.enrichCalls).toEqual([]); // enrichment never ran
    expect(store.upserted).toEqual([]);
    expect(store.enriched).toEqual([]);
  });

  it("proceeds normally when the pool comfortably covers the run", async () => {
    const pool = [makeCandidate({ externalRef: "good", industry: "saas" })];
    const store = new FakeScoutStore(makeContext());
    const { deps, prospectData } = makeDeps(store, pool, { good: 90 });
    prospectData.creditBalance = { remaining: 100_000, allocated: 200_000 };

    const summary = await runScout("scout1", deps);

    expect(summary.status).toBe("completed");
    expect(summary.reason).toBeUndefined();
    expect(store.enriched).toEqual(["good"]);
  });

  it("fails open when the balance is unknown (null) — prospecting continues", async () => {
    const pool = [makeCandidate({ externalRef: "good", industry: "saas" })];
    const store = new FakeScoutStore(makeContext());
    const { deps, prospectData } = makeDeps(store, pool, { good: 90 });
    expect(prospectData.creditBalance).toBeNull(); // default

    const summary = await runScout("scout1", deps);

    expect(summary.status).toBe("completed");
    expect(store.enriched).toEqual(["good"]);
  });
});

describe("pickHotSignal", () => {
  it("returns the label of a high-value 'strike now' signal", () => {
    expect(
      pickHotSignal([
        { kind: "hiring", detail: "3 open roles" },
        { kind: "funding", label: "Raised a Series B", detail: "Series B, $40M" },
      ])
    ).toBe("Raised a Series B");
    expect(pickHotSignal([{ kind: "intent", detail: "Researching Sales Automation" }])).toBe(
      "Researching Sales Automation"
    );
  });

  it("ignores low-value signals and empty input (no notification noise)", () => {
    expect(pickHotSignal([{ kind: "hiring", detail: "3 open roles" }])).toBeNull();
    expect(pickHotSignal([{ kind: "award", detail: "Won an award" }])).toBeNull();
    expect(pickHotSignal(undefined)).toBeNull();
    expect(pickHotSignal([])).toBeNull();
  });
});
