import { describe, expect, it } from "vitest";
import type { LeadInsights, RulesGateResult, WebsiteScan } from "@vantera/agent-brains";
import { InMemoryProspectData, makeCandidate, type ProspectCandidate } from "@vantera/prospect-data";
import { FAST_PASS_DEFAULTS, runFastPass, type FastPassDeps, type FastPassStore, type RevealRunPatch } from "./fast-pass";
import { TRIAL_LEAD_CAP } from "./types";
import type { CopyDraftPayload } from "./types";

/** Candidates that pass the rules gate against `{}` criteria (no positive mismatch). */
function pool(n: number): ProspectCandidate[] {
  return Array.from({ length: n }, (_, i) =>
    makeCandidate({
      externalRef: `fp_${i}`,
      companyName: `Fastco ${i}`,
      industry: "saas",
      title: "VP Sales",
      companySize: "11-50",
      location: "united states",
    })
  );
}

function insightsFor(leadIds: string[], score: (i: number) => number): LeadInsights[] {
  return leadIds.map((id, i) => ({
    lead_id: id,
    score: score(i),
    rationale: "fits the profile",
    insights: {
      pain_points: ["pipeline"],
      triggers: [],
      motivations: [],
      value_angle: "angle",
      aha_moment: "aha",
      summary: "in-market for outreach automation",
    },
  })) as unknown as LeadInsights[];
}

function makeStore(over: Partial<FastPassStore> = {}) {
  const patches: RevealRunPatch[] = [];
  const scores = new Map<string, { score: number; qualified: boolean }>();
  const store: FastPassStore & { patches: RevealRunPatch[]; scores: typeof scores } = {
    patches,
    scores,
    async getFastPassContext() {
      return {
        icps: [{ id: "icp1", name: "Founders", criteria: {} }],
        account: {
          industry: "saas",
          websiteUrl: null,
          websiteScan: null,
          websiteScannedAt: null,
          subscriptionStatus: "trialing",
          intentEnabled: false,
        },
      };
    },
    async countAccountLeads() {
      return 0;
    },
    async saveWebsiteScan() {},
    async upsertLeads(_a, icpId, candidates) {
      return candidates.map((c, i) => ({ leadId: `lead_${c.externalRef}`, icpId, candidate: c }));
    },
    async markRulesGate(_l: string, _r: RulesGateResult) {},
    async saveEnrichment() {},
    async saveScore(leadId, insight, qualified) {
      scores.set(leadId, { score: (insight as { score: number }).score, qualified });
    },
    async getLiveCopyAgent() {
      return { id: "copy1" };
    },
    async updateRevealRun(_id, patch) {
      patches.push(patch);
    },
    ...over,
  };
  return store;
}

function makeDeps(
  store: FastPassStore,
  over: Partial<FastPassDeps> = {},
  candidates: ProspectCandidate[] = pool(20)
): FastPassDeps & { draftedPayloads: CopyDraftPayload[] } {
  const draftedPayloads: CopyDraftPayload[] = [];
  return {
    draftedPayloads,
    store,
    prospectData: new InMemoryProspectData(candidates),
    scanFn: async () => ({ summary: "", offerings: [], value_props: [] }) as unknown as WebsiteScan,
    rankFn: async (cands) => insightsFor(cands.map((c) => c.leadId), (i) => 90 - i),
    runDrafts: async (p) => {
      draftedPayloads.push(p);
      return { status: "completed", drafted: p.leadIds.length, suppressed: 0, skipped: 0 };
    },
    ...over,
  };
}

const payload = { accountId: "acc1", revealRunId: "run1" };

describe("runFastPass — caps and flow", () => {
  it("completes end-to-end and drafts exactly the top-5 by score", async () => {
    const store = makeStore();
    const deps = makeDeps(store);
    const summary = await runFastPass(payload, deps);
    expect(summary.status).toBe("completed");
    expect(summary.scanned).toBe(20);
    expect(summary.matched).toBeGreaterThan(0);
    expect(deps.draftedPayloads).toHaveLength(1);
    expect(deps.draftedPayloads[0]!.leadIds).toHaveLength(FAST_PASS_DEFAULTS.draftCap);
    // top-5 by descending score: rank scores are 90 - i in candidate order
    expect(deps.draftedPayloads[0]!.leadIds).toEqual(
      ["fp_0", "fp_1", "fp_2", "fp_3", "fp_4"].map((r) => `lead_${r}`)
    );
  });

  it("clamps discovery to the trial headroom (TRIAL_LEAD_CAP)", async () => {
    const store = makeStore({ async countAccountLeads() { return TRIAL_LEAD_CAP - 10; } });
    const deps = makeDeps(store, {}, pool(50));
    const summary = await runFastPass(payload, deps);
    // headroom 10 < discoveryCap 50 → at most 10 pulled
    expect(summary.scanned).toBeLessThanOrEqual(10);
  });

  it("completes empty (not failed) when the trial cap is exhausted", async () => {
    const store = makeStore({ async countAccountLeads() { return TRIAL_LEAD_CAP; } });
    const deps = makeDeps(store);
    const summary = await runFastPass(payload, deps);
    expect(summary).toMatchObject({ status: "completed", scanned: 0, drafted: 0 });
    expect(deps.draftedPayloads).toHaveLength(0);
  });

  it("fails with no_icp when no onboarding ICP exists", async () => {
    const store = makeStore({
      async getFastPassContext() {
        return { icps: [], account: { industry: null, websiteUrl: null, websiteScan: null, websiteScannedAt: null, subscriptionStatus: "trialing", intentEnabled: false } };
      },
    });
    const deps = makeDeps(store);
    const summary = await runFastPass(payload, deps);
    expect(summary).toMatchObject({ status: "failed", reason: "no_icp" });
    expect(store.patches.at(-1)).toMatchObject({ status: "failed", error: "no_icp" });
  });

  it("fails loudly with low_credits BEFORE any spend", async () => {
    const store = makeStore();
    let discovered = false;
    const prospectData = new InMemoryProspectData(pool(20));
    const origDiscover = prospectData.discoverProspects.bind(prospectData);
    prospectData.discoverProspects = async (...args) => {
      discovered = true;
      return origDiscover(...args);
    };
    prospectData.getCreditBalance = async () => ({ remaining: 1, allocated: 100 });
    const deps = makeDeps(store, { prospectData });
    const summary = await runFastPass(payload, deps);
    expect(summary).toMatchObject({ status: "failed", reason: "low_credits" });
    expect(discovered).toBe(false);
  });

  it("does not draft when nothing qualifies, and still completes", async () => {
    const store = makeStore();
    const deps = makeDeps(store, {
      rankFn: async (cands) => insightsFor(cands.map((c) => c.leadId), () => 40),
    });
    const summary = await runFastPass(payload, deps);
    expect(summary.matched).toBe(0);
    expect(summary.drafted).toBe(0);
    expect(deps.draftedPayloads).toHaveLength(0);
    expect(store.patches.at(-1)).toMatchObject({ status: "done" });
  });

  it("does not draft when no live copy agent exists", async () => {
    const store = makeStore({ async getLiveCopyAgent() { return null; } });
    const deps = makeDeps(store);
    const summary = await runFastPass(payload, deps);
    expect(summary.drafted).toBe(0);
    expect(deps.draftedPayloads).toHaveLength(0);
  });

  it("emits stage patches in order and stamps the aha SLOs", async () => {
    const store = makeStore();
    const deps = makeDeps(store);
    await runFastPass(payload, deps);
    const statuses = store.patches.map((p) => p.status).filter(Boolean);
    expect(statuses).toEqual(["scanning", "ranking", "drafting", "done"]);
    const matchedPatch = store.patches.find((p) => p.status === "drafting");
    expect(matchedPatch?.firstMatchAt).toBeInstanceOf(Date);
    const donePatch = store.patches.find((p) => p.status === "done");
    expect(donePatch?.fullDraftAt).toBeInstanceOf(Date);
  });

  it("website scan failure never blocks the run", async () => {
    const store = makeStore({
      async getFastPassContext() {
        return {
          icps: [{ id: "icp1", name: "Founders", criteria: {} }],
          account: { industry: "saas", websiteUrl: "https://broken.example", websiteScan: null, websiteScannedAt: null, subscriptionStatus: "trialing", intentEnabled: false },
        };
      },
    });
    const deps = makeDeps(store, { scanFn: async () => { throw new Error("boom"); } });
    const summary = await runFastPass(payload, deps);
    expect(summary.status).toBe("completed");
  });
});
