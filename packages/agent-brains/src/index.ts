export { stripLoneSurrogates } from "./text";
export { applyRulesGate, type RulesGateResult } from "./prospect/rules-gate";
export { deriveIcpCriteria, type DeriveCriteriaContext } from "./prospect/derive-criteria";
export {
  compactLead,
  rankLeads,
  RANK_BATCH_SIZE,
  rankMissInsights,
  completeRankResults,
  RANK_MISS_RATIONALE,
  RANK_FEEDBACK_MAX,
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
  findUngroundedEntities,
  findActionClaims,
  findUnapprovedLinks,
  normalizeDashes,
  findTemplateOpener,
  type Violation,
} from "./copy/humanizer";
export {
  openerSkeleton,
  openerSkeletons,
  findRepeatedOpener,
  stripIdentity,
  OPENER_SKELETON_WORDS,
} from "./copy/opener";
export {
  draftLinkedIn,
  regenerateLinkedInStage,
  validateLinkedInDraft,
  leadIdentity,
  linkedinDraftSchema,
  LINKEDIN_SYSTEM,
  CONNECTION_NOTE_MAX_CHARS,
  FOLLOWUP_MAX_CHARS,
  FOLLOWUP_MAX_WORDS,
  type LinkedInDraft,
  type LinkedInStage,
} from "./copy/linkedin";
export {
  leadBlock,
  strategyDirectives,
  proofSection,
  avoidBlock,
  exemplarBlock,
  steerBlock,
  STEER_MAX_CHARS,
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
  LINKEDIN_PAIR_MESSAGE_TYPE,
  linkedinJudgeText,
  type JudgeVerdict,
  type JudgeContext,
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
  decideExperiment,
  checkCircuitBreaker,
  DECIDE_DEFAULTS,
  type VariantOutcome,
  type ExperimentVerdict,
  type ExperimentDecision,
  type DecideOptions,
  type BreakerOptions,
} from "./optimize/decide";
export { aggregateArm, type LeadOutcomeFlags } from "./optimize/outcomes";
export { describeStrategy } from "./copy/describe";
export {
  asStrategyGenome,
  genomeSignature,
  replyPolarity,
  rollupArms,
  rollupCohort,
  type CohortLead,
  type StampArm,
  type StrategyGenome,
  type StrategySource,
} from "./optimize/cohort";
export type { FunnelCohort } from "./research/calibrate";
export { buildSendRecipe, type SendRecipe, type RecipeBrain } from "./optimize/recipe";
export { validateRecipeAngle } from "./optimize/angle";
export { strategySignature, aggregateBySignature, chooseChallenger } from "./optimize/bandit";
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
export {
  countRows,
  featureKeys,
  fitLearner,
  isInformative,
  predictLead,
  rankByLearned,
  signalReport,
  buildLeadOrdering,
  orderLeads,
  LEARN_MIN_N,
  buildReadout,
  explainLead,
  featureLabel,
  type LearnedReadout,
  type ReadoutFeature,
  type LeadReason,
  type LearnerFeatures,
  type LearnerRow,
  type CountTable,
  type LearnedModel,
  type LeadOrdering,
  type SignalReportRow,
} from "./targeting/learn";
export { STARTER_PLAYS, SOURCE_LABEL, matchStarterPlays, type StarterPlay } from "./plays/starter";
export { pickWhyNow, findMissingWhyNow, WHY_NOW_MAX_AGE_DAYS, type WhyNow, type SignalLike } from "./copy/why-now";
export { applyExclusions, normalizeTargetingRules, EMPTY_TARGETING, TARGETING_LIST_MAX, TARGETING_ENTRY_MAX, TARGETING_GUIDANCE_MAX, type TargetingRules } from "./prospect/exclusions";
export { profileText, lookalikeCutpoints, lookalikeBucket, LOOKALIKE_MIN_POSITIVES, type LookalikeCutpoints, type ProfileFields } from "./targeting/lookalike";

// Conversation intelligence (state, moves, rules, read, priors, learn, policy, compose, lint).
export * from "./conversation/state";
export * from "./conversation/moves";
export * from "./conversation/rules";
export {
  readoutSchema,
  READ_SYSTEM,
  isSellerTurn,
  readTurn,
  applyReadout,
  type Readout,
  type LinkKind as ReadLinkKind,
} from "./conversation/read";
export * from "./conversation/priors";
export * from "./conversation/learn";
export * from "./conversation/policy";
export * from "./conversation/compose";
export * from "./conversation/lint";
export { BUMP_PHRASES } from "./copy/humanizer";
