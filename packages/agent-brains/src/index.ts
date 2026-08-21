export { stripLoneSurrogates } from "./text";
export { applyRulesGate, type RulesGateResult } from "./prospect/rules-gate";
export { deriveIcpCriteria, type DeriveCriteriaContext } from "./prospect/derive-criteria";
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
  extractFaviconUrl,
  isScanStale,
  peekFavicon,
  scanWebsite,
  websiteScanSchema,
  SCAN_STALE_AFTER_DAYS,
  type WebsiteScan,
} from "./prospect/website-scan";
export {
  draftIcp,
  icpDraftSchema,
  icpDraftIsEmpty,
  EMPTY_ICP_DRAFT,
  ICP_SIZE_BUCKETS,
  type IcpDraft,
  type IcpDraftContext,
} from "./prospect/icp-draft";
export {
  validateHumanity,
  describeViolations,
  findRestartPhrases,
  findUngroundedClaims,
  findActionClaims,
  findUnapprovedLinks,
  normalizeDashes,
  type Violation,
} from "./copy/humanizer";
export {
  draftLinkedIn,
  validateLinkedInDraft,
  linkedinDraftSchema,
  LINKEDIN_SYSTEM,
  CONNECTION_NOTE_MAX_CHARS,
  FOLLOWUP_MAX_CHARS,
  FOLLOWUP_MAX_WORDS,
  type LinkedInDraft,
} from "./copy/linkedin";
export {
  leadBlock,
  strategyDirectives,
  proofSection,
  avoidBlock,
  exemplarBlock,
  type CopyLead,
  type CopyContext,
  type DraftInput,
  type CopyStrategy,
  type ProofPoint,
} from "./copy/shared";
export {
  MESSAGE_SHAPES,
  SAFE_SHAPES,
  BOLD_SHAPES,
  FACT_ASSERTING_SHAPES,
  SHAPE_DIRECTIVE,
  SHAPE_BUDGET,
  shapeBudget,
  isMessageShape,
  selectMessageShape,
  groundingHasShapeSignal,
  validateProposedShape,
  type MessageShape,
} from "./copy/shape";
export {
  deriveAccountProfile,
  SAFE_PROFILE,
  type AccountConfigProfile,
  type AccountProfileConfig,
  type ConversionStyle,
  type Trust,
  type ProofDepth,
} from "./copy/profile";
export {
  fixConversationMessage,
  fixDraftText,
  fixLinkedInDraft,
  type DraftTextFix,
} from "./copy/fix";
export {
  judgeCopy,
  JUDGE_MODEL_ID,
  JUDGE_PROMPT,
  type JudgeVerdict,
} from "./copy/judge";
export { bestOfN, type JudgeFn } from "./copy/best-of-n";
export { classifyReply, preClassify, replyVerdictSchema, type ReplyVerdict } from "./reply/classify";
export {
  draftConversationMessage,
  conversationReplySchema,
  renderThread,
  RESPOND_SYSTEM,
  CONVERSATION_REPLY_MAX_CHARS,
  CONVERSATION_REPLY_MAX_WORDS,
  type ConversationDraft,
  type ConversationMessageInput,
  type ConversationTurn,
} from "./reply/respond";
export { validateConversationMessage, allowedConversationLinks } from "./reply/respond";
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
  checkCircuitBreaker,
  DECIDE_DEFAULTS,
  type VariantOutcome,
  type ExperimentVerdict,
  type ExperimentDecision,
  type DecideOptions,
  type BreakerOptions,
} from "./optimize/decide";
export {
  decideExperimentV2,
  clampDecideV2Options,
  DECIDE_V2_DEFAULTS,
  type DecideV2Options,
} from "./optimize/decide-v2";
export {
  ALPHA_WEALTH_START,
  ALPHA_WEALTH_CAP,
  ALPHA_EARN_ON_CONCLUSION,
  ALPHA_MIN_SPEND,
  nextAlphaSpend,
  wealthAfterLaunch,
  wealthAfterConclusion,
} from "./optimize/alpha";
export {
  proposeChallengerStrategy,
  proposeNextChallenger,
  nextExperimentStage,
  describeStrategy,
  isTerminalStatus,
  type ExperimentStatus,
} from "./optimize/experiment";
export { aggregateArm, type LeadOutcomeFlags } from "./optimize/outcomes";
export { buildSendRecipe, type SendRecipe, type RecipeBrain } from "./optimize/recipe";
export { validateRecipeAngle } from "./optimize/angle";
export { strategySignature, aggregateBySignature, chooseChallenger } from "./optimize/bandit";
export { proposeRecipeCandidates, type GenerateRecipesInput } from "./optimize/generate";
export {
  seniorityBucket,
  buildTargetingProfile,
  targetingTilt,
  rankByTilt,
  topTiltSegment,
  SEGMENT_FLOOR,
  type TargetingRow,
  type TargetingProfile,
  type SegmentStat,
} from "./targeting/tilt";
export { allocateDiscovery } from "./targeting/allocate";
export { STARTER_PLAYS, SOURCE_LABEL, matchStarterPlays, type StarterPlay } from "./plays/starter";
