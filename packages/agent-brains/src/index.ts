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
export { leadBlock, type CopyLead, type CopyContext, type DraftInput } from "./copy/shared";
export { classifyReply, preClassify, replyVerdictSchema, type ReplyVerdict } from "./reply/classify";
export { adConceptSchema, adConceptBatchSchema, AD_CTAS, type AdConcept } from "./ads/schema";
export { generateAdConcepts, adContextBlock, type AdConceptInput, type AdConceptResult } from "./ads/generate";
