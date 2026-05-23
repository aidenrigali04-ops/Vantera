// Public AI brain surface.
//
// Everything in @/lib/ai is internal except what's re-exported here. Other
// modules should import from `@/lib/ai` rather than reaching into subpaths so
// we can refactor the internals freely.

export { callModel, isAiEnabled, parseJsonResponse } from './client'
export type { CallModelArgs, CallModelResult } from './client'

export { loadBusinessContext, toPromptContext } from './context'
export type { BusinessContext, BusinessMetrics, StoredMemoryRow } from './context'

export {
  getMemory,
  listMemory,
  recordObservation,
  upsertMemory,
} from './memory'
export type {
  MemoryKind,
  MemoryRow,
  ObservationKind,
  SubjectType,
  UpsertMemoryArgs,
  RecordObservationArgs,
} from './memory'

export { summarizeBusinessContext } from './tools/summarize-business-context'
export type { SummarizeOutput } from './tools/summarize-business-context'

export { draftMessage } from './tools/draft-message'
export type { DraftMessageInput, DraftMessageOutput } from './tools/draft-message'

export { classifyMessageIntent, INTENT_VALUES } from './tools/classify-intent'
export type {
  ClassifyIntentInput,
  ClassifyIntentOutput,
  Intent,
  Urgency,
  RecommendedAction,
} from './tools/classify-intent'

export { scoreRecord } from './tools/score-record'
export type { ScoreRecordInput, ScoreRecordOutput } from './tools/score-record'

export { generateSignals } from './tools/generate-signals'
export type { GeneratedSignal, SignalSeverity } from './tools/generate-signals'

export { bootstrapBusinessContext } from './workflows/bootstrap-business-context'
export type { BootstrapResult } from './workflows/bootstrap-business-context'

export { dailyIntelligenceSweep } from './workflows/daily-intelligence-sweep'
export type { DailySweepResult } from './workflows/daily-intelligence-sweep'

export { onRecordStageChange } from './workflows/on-record-stage-change'
export type { StageChangeResult } from './workflows/on-record-stage-change'
