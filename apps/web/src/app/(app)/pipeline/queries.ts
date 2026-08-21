import { computeRevenueSnapshot } from "@/lib/revenue";

export interface PipelineInput {
  /** rows from sequence_runs (only status is needed) */
  runs: { current_stage: string; status: string }[];
  /** non-cumulative lead-stage counts, same buckets the Overview snapshot uses */
  counts: { qualified: number; inOutreach: number; replied: number };
  convertedClients: number;
  /** sum of REAL per-deal values at close (avg fallback per deal) — actuals beat estimates */
  closedActualCents: number;
  avgDealValueCents: number | null;
  revenueGoalCents: number | null;
}

export interface PipelineViewModel {
  activeTotal: number;
  pausedTotal: number;
  convertedClients: number;
  /** closed-won revenue, actuals-first — the same "Closed" the Overview shows */
  closedCents: number;
  /** stage-weighted expected pipeline — the same "In pipeline" the Overview shows */
  expectedCents: number;
  /** closed revenue vs. the monthly goal (matches the Overview revenue card) */
  goalProgressPct: number | null;
}

/**
 * Shape raw sequence-run rows + lead-stage counts into the board's view model, using
 * the SAME revenue snapshot the Overview uses (T1 truth layer: one metric, one meaning —
 * "In pipeline" is always stage-weighted expected value, "Revenue progress" is always
 * closed-won). Pure so it is unit-testable without a DB.
 */
export function shapePipeline(input: PipelineInput): PipelineViewModel {
  let activeTotal = 0;
  let pausedTotal = 0;
  for (const r of input.runs) {
    if (r.status === "paused_reply") pausedTotal += 1;
    if (r.status === "active") activeTotal += 1;
  }

  const snapshot = computeRevenueSnapshot({
    convertedClients: input.convertedClients,
    pipeline: input.counts,
    avgDealValueCents: input.avgDealValueCents,
    goalCents: input.revenueGoalCents,
    closedActualCents: input.closedActualCents,
  });

  const goalProgressPct =
    input.revenueGoalCents && input.revenueGoalCents > 0
      ? Math.min(100, Math.round((snapshot.closedCents / input.revenueGoalCents) * 100))
      : null;

  return {
    activeTotal,
    pausedTotal,
    convertedClients: input.convertedClients,
    closedCents: snapshot.closedCents,
    expectedCents: snapshot.expectedCents,
    goalProgressPct,
  };
}
