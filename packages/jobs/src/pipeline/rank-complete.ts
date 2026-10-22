import {
  completeRankResults,
  RANK_MISS_RATIONALE,
  rankMissInsights,
  type LeadInsights,
  type RankCandidate,
  type RankContext,
} from "@vantera/agent-brains";

export type RankFn = (candidates: RankCandidate[], ctx: RankContext) => Promise<LeadInsights[]>;

export interface RankCompleteResult {
  insights: LeadInsights[];
  /** candidates that still had no model row after one retry */
  rankMissed: number;
  /** candidates miss-scored because rankFn threw */
  rankErrors: number;
}

/**
 * Rank every candidate, retry omitted ids once, then fill remaining holes with score-0 miss rows.
 * A throw miss-scores the whole set so Scout/Intent can still completeRun after discovery spend.
 */
export async function rankWithCompleteness(
  rankFn: RankFn,
  candidates: RankCandidate[],
  ctx: RankContext
): Promise<RankCompleteResult> {
  if (candidates.length === 0) return { insights: [], rankMissed: 0, rankErrors: 0 };

  try {
    let insights = await rankFn(candidates, ctx);
    const have = new Set(insights.map((i) => i.lead_id));
    const missing = candidates.filter((c) => !have.has(c.leadId));
    let rankErrors = 0;
    if (missing.length > 0) {
      try {
        const retry = await rankFn(missing, ctx);
        insights = [...insights, ...retry];
      } catch {
        rankErrors = missing.length;
      }
    }
    const complete = completeRankResults(candidates, insights);
    const rankMissed = complete.filter((i) => i.rationale === RANK_MISS_RATIONALE).length;
    return { insights: complete, rankMissed, rankErrors };
  } catch {
    return {
      insights: candidates.map((c) => rankMissInsights(c.leadId)),
      rankMissed: candidates.length,
      rankErrors: candidates.length,
    };
  }
}
