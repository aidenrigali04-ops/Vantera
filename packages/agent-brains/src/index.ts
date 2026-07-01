export { stripLoneSurrogates } from "./text";
export { applyRulesGate, type RulesGateResult } from "./prospect/rules-gate";
export {
  compactLead,
  rankLeads,
  RANK_BATCH_SIZE,
  type RankCandidate,
  type RankContext,
} from "./prospect/rank";
export {
  leadInsightsSchema,
  rankBatchSchema,
  toStoredInsights,
  type LeadInsights,
  type StoredInsights,
} from "./prospect/schema";
export {
  isScanStale,
  scanWebsite,
  websiteScanSchema,
  SCAN_STALE_AFTER_DAYS,
  type WebsiteScan,
} from "./prospect/website-scan";
export { validateHumanity, describeViolations, type Violation } from "./copy/humanizer";
export {
  draftLinkedIn,
  validateLinkedInDraft,
  CONNECTION_NOTE_MAX_CHARS,
  FOLLOWUP_MAX_CHARS,
  type LinkedInDraft,
} from "./copy/linkedin";
export {
  leadBlock,
  strategyDirectives,
  type CopyLead,
  type CopyContext,
  type DraftInput,
  type CopyStrategy,
} from "./copy/shared";
export { classifyReply, preClassify, replyVerdictSchema, type ReplyVerdict } from "./reply/classify";
export {
  draftConversationMessage,
  conversationReplySchema,
  CONVERSATION_REPLY_MAX_CHARS,
  type ConversationDraft,
  type ConversationMessageInput,
  type ConversationTurn,
} from "./reply/respond";
export {
  classifyIntent,
  normalizeVerdict,
  intentVerdictSchema,
  intentBatchSchema,
  INTENT_BATCH_SIZE,
  type IntentVerdict,
  type IntentObservationInput,
  type IntentContext,
} from "./intent/classify";
export {
  deriveIntentWatchlist,
  watchlistSchema,
  type IntentWatchlist,
  type WatchlistContext,
} from "./intent/watchlist";
export {
  computeOutreachFunnel,
  wilsonInterval,
  MIN_STAGE_SAMPLE,
  STRONG_STAGE_SAMPLE,
  type OutreachFunnelInput,
  type OutreachFunnelStage,
  type FunnelStageKey,
  type StageBand,
  type StageStatus,
  type WilsonInterval,
} from "./optimize/funnel";
export {
  diagnoseOutreach,
  type OutreachDiagnosis,
  type DiagnosisStatus,
} from "./optimize/diagnose";
export {
  recommendForDiagnosis,
  type OutreachRecommendation,
  type RecommendationLever,
  type RecommendationAction,
} from "./optimize/recommend";
export {
  assignVariant,
  leadBucket,
  type Variant,
  type ExperimentAllocation,
} from "./optimize/allocate";
export {
  decideExperiment,
  DECIDE_DEFAULTS,
  type VariantOutcome,
  type ExperimentVerdict,
  type ExperimentDecision,
  type DecideOptions,
} from "./optimize/decide";
export {
  proposeChallengerStrategy,
  describeStrategy,
  isTerminalStatus,
  type ExperimentStatus,
} from "./optimize/experiment";
export { aggregateArm, type LeadOutcomeFlags } from "./optimize/outcomes";
