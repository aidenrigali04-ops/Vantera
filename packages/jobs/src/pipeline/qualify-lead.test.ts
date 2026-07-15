import { describe, expect, it, vi } from "vitest";
import type { LeadInsights, RulesGateResult } from "@vantera/agent-brains";
import { runQualifyLead, type QualifyLeadLoad } from "./qualify-lead";

const insight = (score: number): LeadInsights => ({
  lead_id: "l1",
  reasoning: "r",
  score,
  rationale: "fits the ICP",
  pain_points: [],
  triggers: [],
  motivations: [],
  prospect_offering: "runs an agency",
  value_angle: "v",
  aha_moment: "a",
  summary: "s",
});

function makeDeps(load: QualifyLeadLoad | null, score = 85) {
  const gates: RulesGateResult[] = [];
  const scores: { insights: LeadInsights; qualified: boolean }[] = [];
  const rankFn = vi.fn(async () => [insight(score)]);
  return {
    deps: {
      store: {
        loadLeadForQualify: vi.fn(async () => load),
        markRulesGate: vi.fn(async (_id: string, result: RulesGateResult) => {
          gates.push(result);
        }),
        saveScore: vi.fn(async (_id: string, insights: LeadInsights, qualified: boolean) => {
          scores.push({ insights, qualified });
        }),
      },
      rankFn,
    },
    gates,
    scores,
    rankFn,
  };
}

const baseLoad: QualifyLeadLoad = {
  alreadyScored: false,
  minScore: 70,
  accountIndustry: "SaaS",
  icpDescription: "Founders: {}",
  icpCriteria: {},
  candidate: {
    companyName: "Amplify",
    companySize: null,
    industry: null,
    location: null,
    title: "CEO",
  },
};

describe("runQualifyLead", () => {
  it("skips a lead that no longer exists — no gate write, no rank spend", async () => {
    const { deps, gates, rankFn } = makeDeps(null);
    expect(await runQualifyLead("a1", "l1", deps)).toBe("skipped");
    expect(gates).toHaveLength(0);
    expect(rankFn).not.toHaveBeenCalled();
  });

  it("never re-scores an already-scored lead (Vera's verdict is not overwritten)", async () => {
    const { deps, rankFn } = makeDeps({ ...baseLoad, alreadyScored: true });
    expect(await runQualifyLead("a1", "l1", deps)).toBe("skipped");
    expect(rankFn).not.toHaveBeenCalled();
  });

  it("gate failure marks the lead and stops before any AI spend (rule 06)", async () => {
    const { deps, gates, rankFn } = makeDeps({
      ...baseLoad,
      icpCriteria: { titles: ["CTO"] }, // candidate title CEO → positive mismatch
    });
    expect(await runQualifyLead("a1", "l1", deps)).toBe("gated");
    expect(gates[0]?.passed).toBe(false);
    expect(rankFn).not.toHaveBeenCalled();
  });

  it("gate pass + score at/above min_score qualifies the lead", async () => {
    const { deps, gates, scores } = makeDeps(baseLoad, 85);
    expect(await runQualifyLead("a1", "l1", deps)).toBe("qualified");
    expect(gates[0]?.passed).toBe(true);
    expect(scores).toEqual([{ insights: insight(85), qualified: true }]);
  });

  it("a below-threshold score persists as rejected — manual entry is never a bypass", async () => {
    const { deps, scores } = makeDeps(baseLoad, 40);
    expect(await runQualifyLead("a1", "l1", deps)).toBe("rejected");
    expect(scores).toEqual([{ insights: insight(40), qualified: false }]);
  });
});
