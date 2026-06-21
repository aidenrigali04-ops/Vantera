import type { SequenceConfig, SequenceStage, StageConfig } from "./types";

export const SEQUENCE_DEFAULTS: SequenceConfig = {
  order: ["linkedin"],
  stages: {
    linkedin: { enabled: true, touches: 2, touchGapDays: 2, waitDays: 3 },
  },
};

type PartialConfig = {
  order?: SequenceStage[];
  stages?: Partial<Record<SequenceStage, Partial<StageConfig>>>;
};

/** Merge a (possibly null) stored jsonb config over the code defaults. */
export function resolveSequenceConfig(stored: PartialConfig | null): SequenceConfig {
  if (!stored) return SEQUENCE_DEFAULTS;
  const stages = {} as Record<SequenceStage, StageConfig>;
  for (const stage of Object.keys(SEQUENCE_DEFAULTS.stages) as SequenceStage[]) {
    stages[stage] = { ...SEQUENCE_DEFAULTS.stages[stage], ...(stored.stages?.[stage] ?? {}) };
  }
  return { order: stored.order ?? SEQUENCE_DEFAULTS.order, stages };
}
