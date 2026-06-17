import { describe, expect, it } from "vitest";
import { InMemoryProspectData, makeCandidate } from "@vantera/prospect-data";
import type { LeadInsights } from "@vantera/agent-brains";
import { runScout } from "./scout";
import { TRIAL_LEAD_CAP } from "./types";
import type { CallBriefDraftPayload, CopyDraftPayload, FreshLead, ScoutContext, ScoutDeps, ScoutStore } from "./types";
import type { OutreachCapacity } from "./capacity";

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
  callerAgent: { id: string } | null = null;
  capacity: OutreachCapacity = {
    linkedinConnected: false,
    linkedinAccountAgeDays: null,
    linkedinEnabled: false,
    emailEnabled: true,
    mailboxes: [{ phase: "ready", dailyCap: 0 }, { phase: "ready", dailyCap: 0 }], // ample by default
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
  async getLiveCallerAgent() {
    return this.callerAgent;
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
      ...overrides,
    },
  };
}

function makeDeps(store: FakeScoutStore, pool: ReturnType<typeof makeCandidate>[], scores: Record<string, number>) {
  const prospectData = new InMemoryProspectData(pool);
  const ranked: string[][] = [];
  const chained: CopyDraftPayload[] = [];
  const callerChained: CallBriefDraftPayload[] = [];
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
    triggerCallBrief: async (p) => {
      callerChained.push(p);
    },
    now: () => new Date("2026-06-11T08:00:00Z"),
  };
  return { deps, prospectData, ranked, chained, callerChained };
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
    expect(prospectData.enrichCalls).toEqual([["good"]]);
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
    expect(prospectData.enrichCalls).toEqual([["fit"]]);
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

  it("chains the caller agent when one is live and leads qualified", async () => {
    const pool = [makeCandidate({ externalRef: "good", industry: "saas" })];
    const store = new FakeScoutStore(makeContext());
    store.callerAgent = { id: "caller1" };
    const { deps, callerChained } = makeDeps(store, pool, { good: 90 });

    await runScout("scout1", deps);

    expect(callerChained).toHaveLength(1);
    expect(callerChained[0]!.callerAgentId).toBe("caller1");
    expect(callerChained[0]!.accountId).toBe("acc1");
    expect(callerChained[0]!.leadIds).toHaveLength(1);
  });

  it("does not chain the caller when no live caller agent exists", async () => {
    const pool = [makeCandidate({ externalRef: "good", industry: "saas" })];
    const store = new FakeScoutStore(makeContext());
    // callerAgent is null by default — no override
    const { deps, callerChained } = makeDeps(store, pool, { good: 90 });

    await runScout("scout1", deps);

    expect(callerChained).toHaveLength(0);
  });

  it("trial cap: a trialing account at the lead ceiling skips before any enrichment", async () => {
    const pool = [makeCandidate({ externalRef: "good", industry: "saas" })];
    const store = new FakeScoutStore(makeContext({ subscriptionStatus: "trialing" }));
    store.leadCount = TRIAL_LEAD_CAP; // already at the ceiling
    const { deps, prospectData } = makeDeps(store, pool, { good: 90 });

    const summary = await runScout("scout1", deps);

    expect(summary.status).toBe("skipped");
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
  it("pulls a small trickle during warmup and bounds enrichment spend", async () => {
    // 25 saas candidates — more than the 7-lead warmup cap so the cap is what limits discovery
    const pool = Array.from({ length: 25 }, (_, i) =>
      makeCandidate({ externalRef: `c${i}`, industry: "saas" })
    );
    const store = new FakeScoutStore({
      agent: { id: "scout1", accountId: "acc1", status: "live", cadence: "daily", config: { prospectsPerRun: 25, minScore: 70 } },
      icps: [{ id: "icp1", name: "SaaS CTOs", criteria: { industries: ["saas"] } }],
      account: { industry: "devtools", websiteUrl: null, websiteScan: null, websiteScannedAt: null, subscriptionStatus: "active" },
    });
    store.capacity = {
      linkedinConnected: true,
      linkedinEnabled: true,
      linkedinAccountAgeDays: 3, // ramp: 5/day → projected round(5*1*1.3)=7
      emailEnabled: true,
      mailboxes: [{ phase: "warming", dailyCap: 0 }], // email adds nothing yet
    };
    // scores are high enough that everyone who passes the gate qualifies
    const scores: Record<string, number> = {};
    for (let i = 0; i < 25; i++) scores[`c${i}`] = 90;
    const { deps } = makeDeps(store, pool, scores);

    const summary = await runScout("scout1", deps);

    expect(summary.discovered).toBeLessThanOrEqual(7);
    expect(store.enriched.length).toBeLessThanOrEqual(7); // spend bounded by the pull
  });

  it("still sources a bounded preview when no channel is connected, so prospects land", async () => {
    // No active mailbox/LinkedIn → dead-zone. The Scout no longer no-ops; it sources a
    // small preview so prospects appear on the dashboard/pipeline while the user connects
    // a channel (outreach still waits). See capacity.ts NO_CHANNEL_PREVIEW_CAP.
    const pool = [makeCandidate({ externalRef: "good", industry: "saas" })];
    const store = new FakeScoutStore({
      agent: { id: "scout1", accountId: "acc1", status: "live", cadence: "daily", config: { prospectsPerRun: 25, minScore: 70 } },
      icps: [{ id: "icp1", name: "SaaS CTOs", criteria: { industries: ["saas"] } }],
      account: { industry: "devtools", websiteUrl: null, websiteScan: null, websiteScannedAt: null, subscriptionStatus: "active" },
    });
    store.capacity = {
      linkedinConnected: false,
      linkedinEnabled: false,
      linkedinAccountAgeDays: null,
      emailEnabled: true,
      mailboxes: [{ phase: "warming", dailyCap: 0 }],
    };
    const { deps } = makeDeps(store, pool, { good: 90 });

    const summary = await runScout("scout1", deps);

    expect(summary.status).toBe("completed");
    expect(summary.discovered).toBe(1); // the one pooled candidate was sourced despite no channel
    expect(store.enriched.length).toBe(1);
  });
});
