import { describe, expect, it, vi } from "vitest";
import { runRefreshLead } from "./refresh-lead";
import type { RefreshLeadDeps, RefreshLeadLoad, RefreshLeadStore } from "./refresh-lead";
import type { LeadInsights, RankCandidate, RankContext } from "@vantera/agent-brains";
import type { EnrichedProspect } from "@vantera/prospect-data";

/** Minimal insight factory — only fields the core uses (score + lead_id + required shape). */
function makeInsight(leadId: string, score: number): LeadInsights {
  return {
    lead_id: leadId,
    reasoning: "test reasoning",
    score,
    rationale: "test rationale",
    pain_points: [],
    triggers: [],
    motivations: [],
    value_angle: "value",
    aha_moment: "aha",
    summary: "summary",
  };
}

const LEAD_ID = "lead-abc";
const ACCOUNT_ID = "acct-xyz";

const baseLoad: RefreshLeadLoad = {
  externalRef: "ext-ref-001",
  minScore: 70,
  accountIndustry: "saas",
  icpDescription: 'Mid-market SaaS: {"headcount":"51-200"}',
  candidate: {
    companyName: "Acme",
    companySize: "51-200",
    industry: "saas",
    location: "San Francisco, CA",
    title: "VP Sales",
  },
};

const fakeEnriched: EnrichedProspect = {
  externalRef: "ext-ref-001",
  companyName: "Acme",
  email: "acme@test.com",
  emailStatus: "valid",
  technographics: ["Salesforce"],
  signals: [],
};

function makeStore(
  load: RefreshLeadLoad | null,
  saveScoreFn: RefreshLeadStore["saveScore"] = async () => {},
  saveEnrichmentFn: RefreshLeadStore["saveEnrichment"] = async () => {}
): RefreshLeadStore {
  return {
    loadLeadForRefresh: async () => load,
    saveEnrichment: saveEnrichmentFn,
    saveScore: saveScoreFn,
  };
}

describe("runRefreshLead", () => {
  it("returns 'ok' and saves score with qualified=true when re-ranked score >= minScore", async () => {
    const scoreArgs: Array<Parameters<RefreshLeadStore["saveScore"]>> = [];
    const store = makeStore(baseLoad, async (...args) => { scoreArgs.push(args); });

    const deps: RefreshLeadDeps = {
      store,
      prospectData: { enrichProspects: async () => [fakeEnriched] },
      rankFn: async (candidates: RankCandidate[], _ctx: RankContext): Promise<LeadInsights[]> =>
        candidates.map((c) => makeInsight(c.leadId, 85)),
    };

    const result = await runRefreshLead(ACCOUNT_ID, LEAD_ID, deps);

    expect(result).toBe("ok");
    expect(scoreArgs).toHaveLength(1);
    expect(scoreArgs[0]![0]).toBe(LEAD_ID);
    expect(scoreArgs[0]![1].score).toBe(85);
    expect(scoreArgs[0]![2]).toBe(true); // qualified
  });

  it("returns 'dropped' and saves score with qualified=false when re-ranked score < minScore", async () => {
    const scoreArgs: Array<Parameters<RefreshLeadStore["saveScore"]>> = [];
    const store = makeStore(baseLoad, async (...args) => { scoreArgs.push(args); });

    const deps: RefreshLeadDeps = {
      store,
      prospectData: { enrichProspects: async () => [fakeEnriched] },
      rankFn: async (candidates: RankCandidate[], _ctx: RankContext): Promise<LeadInsights[]> =>
        candidates.map((c) => makeInsight(c.leadId, 50)), // 50 < minScore 70
    };

    const result = await runRefreshLead(ACCOUNT_ID, LEAD_ID, deps);

    expect(result).toBe("dropped");
    expect(scoreArgs).toHaveLength(1);
    expect(scoreArgs[0]![1].score).toBe(50);
    expect(scoreArgs[0]![2]).toBe(false); // not qualified
  });

  it("returns 'ok' immediately when loadLeadForRefresh returns null — no enrich/rank/save", async () => {
    let enrichCalled = false;
    let rankCalled = false;
    let saveCalled = false;

    const deps: RefreshLeadDeps = {
      store: {
        loadLeadForRefresh: async () => null,
        saveEnrichment: async () => { saveCalled = true; },
        saveScore: async () => { saveCalled = true; },
      },
      prospectData: {
        enrichProspects: async () => {
          enrichCalled = true;
          return [];
        },
      },
      rankFn: async () => {
        rankCalled = true;
        return [];
      },
    };

    const result = await runRefreshLead(ACCOUNT_ID, LEAD_ID, deps);

    expect(result).toBe("ok");
    expect(enrichCalled).toBe(false);
    expect(rankCalled).toBe(false);
    expect(saveCalled).toBe(false);
  });
});
