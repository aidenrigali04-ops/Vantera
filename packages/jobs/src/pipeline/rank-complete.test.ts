import { describe, expect, it } from "vitest";
import { RANK_MISS_RATIONALE, type LeadInsights, type RankCandidate } from "@vantera/agent-brains";
import { rankWithCompleteness } from "./rank-complete";

const insight = (lead_id: string, score = 80): LeadInsights => ({
  lead_id,
  reasoning: "r",
  score,
  rationale: "rat",
  pain_points: [],
  triggers: [],
  motivations: [],
  prospect_offering: "o",
  value_angle: "v",
  aha_moment: "a",
  summary: "s",
});

const cand = (leadId: string): RankCandidate => ({ leadId });

describe("rankWithCompleteness", () => {
  it("retries omitted ids once, then miss-fills anything still missing", async () => {
    const calls: string[][] = [];
    const result = await rankWithCompleteness(
      async (candidates) => {
        calls.push(candidates.map((c) => c.leadId));
        if (calls.length === 1) return [insight("a")]; // omit b and c
        return [insight("b")]; // retry returns b, c still missing
      },
      [cand("a"), cand("b"), cand("c")],
      {}
    );

    expect(calls).toEqual([["a", "b", "c"], ["b", "c"]]);
    expect(result.insights.map((i) => [i.lead_id, i.score, i.rationale])).toEqual([
      ["a", 80, "rat"],
      ["b", 80, "rat"],
      ["c", 0, RANK_MISS_RATIONALE],
    ]);
    expect(result.rankMissed).toBe(1);
    expect(result.rankErrors).toBe(0);
  });

  it("miss-scores every candidate when rankFn throws and does not rethrow", async () => {
    const result = await rankWithCompleteness(
      async () => {
        throw new Error("model 400");
      },
      [cand("a"), cand("b")],
      {}
    );
    expect(result.rankErrors).toBe(2);
    expect(result.rankMissed).toBe(2);
    expect(result.insights.every((i) => i.score === 0 && i.rationale === RANK_MISS_RATIONALE)).toBe(true);
  });
});
