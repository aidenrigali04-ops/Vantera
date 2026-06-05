// Public AI surface — outreach agent layer.
//
// Every module imports from `@/lib/ai` rather than reaching into subpaths so
// the internals can be refactored freely.

export { callModel, isAiEnabled, parseJsonResponse } from './client'
export type { CallModelArgs, CallModelResult } from './client'

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

export { generateSignals } from './tools/generate-signals'
export type { GeneratedSignal, SignalSeverity } from './tools/generate-signals'
