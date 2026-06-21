import type { SequenceStage } from "@vantera/jobs/pipeline/types";

export type { SequenceStage };

const STAGE_LABELS: Record<SequenceStage, string> = {
  linkedin: "LinkedIn",
};
const STAGE_ORDER: SequenceStage[] = ["linkedin"];

export interface PipelineInput {
  /** rows from sequence_runs (only current_stage + status are needed) */
  runs: { current_stage: string; status: string }[];
  convertedClients: number;
  avgDealValueCents: number | null;
  revenueGoalCents: number | null;
}

export interface PipelineStage {
  stage: SequenceStage;
  label: string;
  count: number;
}

export interface PipelineViewModel {
  stages: PipelineStage[];
  activeTotal: number;
  pausedTotal: number;
  convertedClients: number;
  pipelineValueCents: number;
  goalProgressPct: number | null;
}

/**
 * Shape raw sequence-run rows + the account's revenue numbers into the board's
 * view model. Pure so it is unit-testable without a DB. Goal progress is the
 * stage-weighted win value (converted × avg deal value) against the MRR goal.
 */
export function shapePipeline(input: PipelineInput): PipelineViewModel {
  const counts = new Map<SequenceStage, number>(STAGE_ORDER.map((s) => [s, 0]));
  let pausedTotal = 0;
  for (const r of input.runs) {
    if (r.status === "paused_reply") pausedTotal += 1;
    if (r.status === "active" && (STAGE_ORDER as string[]).includes(r.current_stage)) {
      const s = r.current_stage as SequenceStage;
      counts.set(s, (counts.get(s) ?? 0) + 1);
    }
  }
  const stages = STAGE_ORDER.map((stage) => ({
    stage,
    label: STAGE_LABELS[stage],
    count: counts.get(stage) ?? 0,
  }));
  const activeTotal = stages.reduce((n, s) => n + s.count, 0);
  const pipelineValueCents = input.convertedClients * (input.avgDealValueCents ?? 0);
  const goalProgressPct = input.revenueGoalCents
    ? Math.min(100, Math.round((pipelineValueCents / input.revenueGoalCents) * 100))
    : null;
  return {
    stages,
    activeTotal,
    pausedTotal,
    convertedClients: input.convertedClients,
    pipelineValueCents,
    goalProgressPct,
  };
}
