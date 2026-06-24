import type {
  EnrichedProspect,
  IcpCriteria,
  ProspectCandidate,
  ProspectDataSource,
} from "@vantera/prospect-data";
import type {
  IntentContext,
  IntentObservationInput,
  IntentVerdict,
  LeadInsights,
  LinkedInDraft,
  DraftInput,
  RankCandidate,
  RankContext,
  ReplyVerdict,
  RulesGateResult,
  StoredInsights,
  WebsiteScan,
} from "@vantera/agent-brains";
import type { OutreachCapacity } from "./capacity";
import type { SenderCandidate } from "./sender-assignment";
import type { LinkedInInfra } from "@vantera/linkedin-infra";

export interface ScoutConfig {
  prospectsPerRun: number;
  minScore: number;
  /** capacity-throttle tunables (per-agent override via agents.config jsonb) */
  bufferFactor: number;
  floor: number;
}

// Apify-era volume (2026-06-22): LinkedIn-search discovery is cheap to pull wide, so we source a
// larger pool ahead of send capacity and let the quality gate select the best — a bigger, fresher
// top-of-funnel without changing the account-safe send pace. computeRunTarget still clamps to
// capacity + backlog, so this raises the influx without ever sourcing past what can be worked.
// (Per-agent overridable via agents.config.)
export const SCOUT_DEFAULTS: ScoutConfig = {
  prospectsPerRun: 60,
  minScore: 70,
  bufferFactor: 2.0,
  floor: 5,
};

/**
 * Trial COGS cap: a trialing account sources at most this many leads total, so
 * enrichment spend (rule 05, on rules-gate survivors) is bounded until it converts.
 * Pairs with the free-trial policy in @vantera/billing (TRIAL_TIER/TRIAL_DAYS); this
 * is the prospecting-budget half and lives with the scout pipeline that enforces it.
 */
export const TRIAL_LEAD_CAP = 100;

/**
 * Worst-case prospect-data credits one discovered prospect can cost across the full waterfall:
 * 1 (discovery) + 5 (contacts: email+phone) + 1 (firmographics) + 2 (events) = 9. MEASURED live
 * 2026-06-18 (see project-explorium-enrichment). The credit pool is platform-wide (one provider
 * account serves every tenant), so the Scout multiplies this by a run's target to confirm the pool
 * can fully cover the run BEFORE spending — turning a mid-run insufficient-credit hard-stop into a
 * clean, observable skip. Worst case assumes every discovered prospect survives the gate; real runs
 * cost less, so this is a deliberately conservative floor.
 */
export const WORST_CASE_CREDITS_PER_PROSPECT = 9;

/**
 * Trial send cap: a trialing account dispatches at most this many outbound LinkedIn
 * sends total. Bounds per-send COGS and LinkedIn-account exposure until the account
 * converts. Enforced per-account at the send-dispatch boundary, alongside the LinkedIn
 * safety limits.
 */
export const TRIAL_SEND_CAP = 50;

export interface ScoutContext {
  agent: {
    id: string;
    accountId: string;
    status: string;
    cadence: "daily" | "weekly" | null;
    config: Partial<ScoutConfig>;
  };
  icps: { id: string; name: string; criteria: IcpCriteria }[];
  account: {
    industry: string | null;
    websiteUrl: string | null;
    websiteScan: (WebsiteScan & { url?: string }) | null;
    websiteScannedAt: Date | null;
    /** Drives the trial lead cap; 'trialing' accounts are bounded by TRIAL_LEAD_CAP. */
    subscriptionStatus: string;
  };
}

export interface FreshLead {
  leadId: string;
  icpId: string;
  candidate: ProspectCandidate;
}

export interface ScoutStore {
  getScoutContext(agentId: string): Promise<ScoutContext | null>;
  /** Total leads already sourced for the account — used to enforce TRIAL_LEAD_CAP. */
  countAccountLeads(accountId: string): Promise<number>;
  saveWebsiteScan(accountId: string, url: string, scan: WebsiteScan): Promise<void>;
  /** insert unseen candidates, return new-or-unscored leads only (dedupe by external_ref per account) */
  upsertLeads(accountId: string, icpId: string, candidates: ProspectCandidate[]): Promise<FreshLead[]>;
  markRulesGate(leadId: string, result: RulesGateResult): Promise<void>;
  saveEnrichment(leadId: string, accountId: string, enriched: EnrichedProspect): Promise<void>;
  saveScore(leadId: string, insights: LeadInsights, qualified: boolean): Promise<void>;
  /** Anticipation hook: drop a "hot signal" notification for qualified leads carrying a fresh,
   *  high-value buying signal (funding/intent/exec-hire/M&A). Best-effort; never blocks the run. */
  notifyHotSignals(accountId: string, items: { leadId: string; label: string }[]): Promise<void>;
  completeRun(agentId: string, lastRunAt: Date): Promise<void>;
  /** live outreach capacity for the account (LinkedIn connection state) */
  getOutreachCapacity(accountId: string): Promise<OutreachCapacity>;
  /** in-flight leads not yet contacted (pending_review/approved/scheduled sends, no send recorded) */
  countUncontactedLeads(accountId: string): Promise<number>;
  /** size of the qualified, not-yet-drafted pool (status 'qualified') — gates discovery overscan */
  countQualifiedPool(accountId: string): Promise<number>;
  /** top-N qualified, not-yet-drafted lead ids by score — best-first draft draining (overscan) */
  getTopQualifiedLeadIds(accountId: string, limit: number): Promise<string[]>;
  getLiveCopyAgent(accountId: string): Promise<{ id: string } | null>;
}

export interface ScoutDeps {
  store: ScoutStore;
  prospectData: ProspectDataSource;
  scanFn: (url: string) => Promise<WebsiteScan>;
  rankFn: (candidates: RankCandidate[], ctx: RankContext) => Promise<LeadInsights[]>;
  triggerCopyDraft: (payload: CopyDraftPayload) => Promise<void>;
  now?: () => Date;
}

export interface ScoutRunSummary {
  status: "completed" | "skipped";
  /** present only on a "skipped" run when the shared credit pool can't cover this run's worst case */
  reason?: "low_credits";
  discovered: number;
  gatePassed: number;
  qualified: number;
  chained: boolean;
}

export interface CopyDraftPayload {
  copyAgentId: string;
  accountId: string;
  leadIds: string[];
}

// ── Intent Agent (Phase 13) ──────────────────────────────────────────────────

/** Per-run read ceilings — account-safety (rule 04). LinkedIn reads run through the user's
 *  own connected account, so the scheduler caps reads per run; not configurable upward. */
export const INTENT_POSTS_PER_RUN = 20;
export const INTENT_ENGAGERS_PER_POST = 25;

export interface IntentConfig {
  watch: { creators: string[]; competitors: string[]; keywords: string[]; hashtags: string[] };
  signals: { engagement: boolean; content: boolean };
  /** qualification threshold (the same bar the Scout uses, rule 06) */
  minScore: number;
}

export const INTENT_DEFAULTS: IntentConfig = {
  watch: { creators: [], competitors: [], keywords: [], hashtags: [] },
  signals: { engagement: true, content: true },
  minScore: 70,
};

export interface IntentScanContext {
  agent: { id: string; accountId: string; status: string; config: Partial<IntentConfig> };
  /** the LinkedIn account to read through (the account's active connection); null = can't read */
  connectedAccountId: string | null;
  /** qualification ICP — inherited from the account's Scout (intent qualifies against the same bar) */
  icps: { id: string; name: string; criteria: IcpCriteria }[];
  account: { industry: string | null; valueProp: string | null; subscriptionStatus: string };
}

/** A persisted observation row — the dedupe ledger + audit trail. */
export interface IntentObservationRow {
  profileUrl: string;
  postRef: string;
  signalKind: "engagement" | "content";
  watchTarget: string | null;
  headline: string | null;
  detail: string | null;
  outcome: "observed" | "qualified" | "rejected" | "suppressed" | "enrolled";
  leadId: string | null;
}

export interface IntentScanStore {
  getIntentContext(agentId: string): Promise<IntentScanContext | null>;
  /** dedupe: return the `${profileUrl}|${postRef}` keys already recorded for the account */
  seenObservationKeys(accountId: string, refs: { profileUrl: string; postRef: string }[]): Promise<Set<string>>;
  /** persist the observation ledger (service-role insert; the unique index is the backstop) */
  recordObservations(accountId: string, agentId: string, rows: IntentObservationRow[]): Promise<void>;
  /** upsert an intent-sourced lead (source 'intent'), deduped by profile url; returns its id */
  upsertIntentLead(accountId: string, candidate: ProspectCandidate): Promise<{ leadId: string }>;
  markRulesGate(leadId: string, result: RulesGateResult): Promise<void>;
  saveScore(leadId: string, insights: LeadInsights, qualified: boolean): Promise<void>;
  /** capture the "why now" intent signal on the lead — feeds Surface A's why-now chip */
  saveIntentSignal(leadId: string, accountId: string, signal: { label: string; detail: string }): Promise<void>;
  /** the rule-11 gate: account + lowercased LinkedIn URL lookup against suppression_entries */
  isSuppressed(accountId: string, kind: "linkedin", value: string): Promise<boolean>;
  getLiveCopyAgent(accountId: string): Promise<{ id: string } | null>;
  completeRun(agentId: string, lastRunAt: Date): Promise<void>;
}

export interface IntentScanDeps {
  store: IntentScanStore;
  linkedin: Pick<LinkedInInfra, "searchPosts" | "listProfilePosts" | "listPostEngagers" | "getProfile">;
  classifyFn: (observations: IntentObservationInput[], ctx: IntentContext) => Promise<IntentVerdict[]>;
  rankFn: (candidates: RankCandidate[], ctx: RankContext) => Promise<LeadInsights[]>;
  triggerCopyDraft: (payload: CopyDraftPayload) => Promise<void>;
  now?: () => Date;
}

export interface IntentScanSummary {
  status: "completed" | "skipped";
  reason?: "no_connection" | "empty_watchlist";
  observed: number;
  intent: number;
  qualified: number;
  chained: boolean;
}

export interface CopyConfig {
  cta: string;
  /** LinkedIn is the only channel; retained as an object for back-compat with stored agent configs. */
  channels: { linkedin: boolean };
}

export interface CopyContext {
  agent: { id: string; accountId: string; status: string; campaignId: string | null; config: CopyConfig; sendMode: "review" | "automatic" };
  assets: { kind: string; url: string | null; filename: string | null }[];
  account: { industry: string | null; websiteScan: (WebsiteScan & { url?: string }) | null };
}

export interface DraftableLead {
  id: string;
  firstName: string | null;
  lastName: string | null;
  title: string | null;
  companyName: string | null;
  industry: string | null;
  email: string | null;
  linkedinUrl: string | null;
  phone: string | null;
  aiInsights: StoredInsights | null;
  /** when the lead was last AI-ranked; drives refresh-on-release before a delayed email touch */
  scoredAt: Date | null;
}

export interface NewScheduledSend {
  accountId: string;
  campaignId: string;
  leadId: string;
  channel: "linkedin";
  subject: string | null;
  body: string;
  /** automatic mode inserts clean drafts as 'approved'; style-flagged drafts always review */
  status: "pending_review" | "approved";
  /** invite/message pair for LinkedIn (0009) */
  linkedinStage: "invite" | "message" | null;
  styleFlags: string | null;
}

export interface CopyDraftStore {
  getCopyContext(copyAgentId: string): Promise<CopyContext | null>;
  getDraftableLeads(accountId: string, leadIds: string[]): Promise<DraftableLead[]>;
  /** the rule-11 gate: account + lowercased LinkedIn URL lookup against suppression_entries */
  isSuppressed(accountId: string, kind: "linkedin", value: string): Promise<boolean>;
  ensureCampaignLead(campaignId: string, leadId: string, accountId: string): Promise<void>;
  setCampaignLeadStatus(
    campaignId: string,
    leadId: string,
    status: "queued" | "suppressed" | "skipped" | "sent"
  ): Promise<void>;
  insertScheduledSend(send: NewScheduledSend): Promise<void>;
  /** Both rows or neither — the dispatch core assumes complete pairs. */
  insertLinkedInSendPair(invite: NewScheduledSend, message: NewScheduledSend): Promise<void>;
  setLeadStatus(leadId: string, status: "in_campaign"): Promise<void>;
}

export interface CopyDraftDeps {
  store: CopyDraftStore;
  draftLinkedInFn: (input: DraftInput) => Promise<LinkedInDraft>;
}

export interface CopyDraftSummary {
  status: "completed" | "skipped";
  drafted: number;
  suppressed: number;
  skipped: number;
}

export interface SendContext {
  id: string;
  accountId: string;
  campaignId: string;
  leadId: string;
  channel: "linkedin";
  linkedinStage: "invite" | "message" | null;
  status: string;
  subject: string | null;
  body: string | null;
  campaignStatus: string;
  accountPaused: boolean;
  lead: { linkedinUrl: string | null };
}

export interface OutreachSendStore {
  getSendContext(sendId: string): Promise<SendContext | null>;
  isKillSwitchOn(): Promise<boolean>;
  isSuppressed(accountId: string, kind: "linkedin", value: string): Promise<boolean>;
  /** optimistic claim: scheduled → sending; false means another run owns it */
  claimSending(sendId: string): Promise<boolean>;
  revertToApproved(sendId: string): Promise<void>;
  markSent(sendId: string): Promise<void>;
  markFailed(sendId: string, error: string): Promise<void>;
  markSuppressed(sendId: string): Promise<void>;
  /** The sticky sender assigned to this lead (multi-sender, rule 04/13). Null = unassigned
   *  (the dispatcher assigns at invite time) → the send parks until the next dispatch cycle. */
  getLeadAssignedIdentity(leadId: string): Promise<{ id: string; providerRef: string; status: string } | null>;
  recordOutreachSend(rec: {
    accountId: string;
    campaignId: string;
    leadId: string;
    scheduledSendId: string;
    channel: "linkedin";
    linkedinAccountId?: string;
    messageRef: string | null;
  }): Promise<void>;
  setLeadInvited(leadId: string, at: Date): Promise<void>;
  setCampaignLeadStatus(campaignId: string, leadId: string, status: "queued" | "suppressed" | "skipped" | "sent"): Promise<void>;
}

export interface OutreachSendDeps {
  store: OutreachSendStore;
  linkedinInfra: LinkedInInfra;
  now?: () => Date;
}

export type OutreachSendOutcome = "sent" | "suppressed" | "parked" | "failed" | "skipped";

export interface DispatchableSend {
  id: string;
  accountId: string;
  campaignId: string;
  leadId: string;
  channel: "linkedin";
  linkedinStage: "invite" | "message" | null;
  status: "approved" | "scheduled";
  accountPaused: boolean;
  campaignStatus: string;
  leadInvitedAt: Date | null;
  leadConnectedAt: Date | null;
  /** Multi-sender: the LinkedIn account already assigned to this lead (rule 04/13).
   *  Null until first invite — invites without one are assigned here; a connected
   *  lead's messages are LOCKED to this account (can't message from another). */
  leadAssignedSenderId: string | null;
  /** Drives the trial send cap; 'trialing' accounts are bounded by TRIAL_SEND_CAP. */
  subscriptionStatus: string;
}

/** One of a tenant's connected LinkedIn sender accounts, with its current safety state.
 *  Extends the invite-selector's SenderCandidate with today's message count so the
 *  dispatcher can budget invites and messages per account independently (rule 04). */
export interface DispatchSender extends SenderCandidate {
  /** Messages this account has already sent today (its own message cap is independent). */
  sentTodayMessages: number;
}

export interface SendDispatchStore {
  isKillSwitchOn(): Promise<boolean>;
  /** approved rows + scheduled rows whose scheduled_for is older than staleCutoff (lost-task recovery) */
  getDispatchableSends(staleCutoff: Date): Promise<DispatchableSend[]>;
  /** Total sends recorded for the account (outreach_sends) — enforces TRIAL_SEND_CAP. */
  countAccountSends(accountId: string): Promise<number>;
  /** Every active LinkedIn sender for the tenant with its current safety state
   *  (age, invites today, invites last 7d, messages today, last-assigned, health).
   *  Empty array = no connected identity. Per-sender caps replace the old per-tenant counts. */
  listSenderCandidates(accountId: string, now: Date): Promise<DispatchSender[]>;
  /** Persist the sticky sender choice on the lead (set once at first invite). */
  assignLeadSender(leadId: string, linkedinAccountId: string): Promise<void>;
  markScheduled(sendId: string, scheduledFor: Date): Promise<void>;
  cancelSend(sendId: string, error: string): Promise<void>;
}

export interface SendDispatchDeps {
  store: SendDispatchStore;
  /** wrapper triggers the outreach-send task with a delay */
  enqueue: (sendId: string, runAt: Date) => Promise<void>;
  now?: () => Date;
}

export interface SendDispatchSummary {
  status: "halted" | "completed";
  scheduled: number;
  canceled: number;
  skipped: number;
}

export interface PurgeCandidate {
  id: string;
  status: string;
  rulesGatePassed: boolean | null;
  scoredAt: Date | null;
}

export interface RetentionStore {
  /** leads with created_at < cutoff and status in ('sourced','rejected') — pre-filter only, isPurgeable decides */
  getPurgeCandidates(cutoff: Date): Promise<PurgeCandidate[]>;
  deleteLeads(ids: string[]): Promise<number>;
  /** webhook_events rows with received_at < cutoff — debugging/idempotency data, purged after 30 days (rule 11) */
  purgeWebhookEvents(cutoff: Date): Promise<number>;
  /** copilot_conversations rows with updated_at < cutoff — cascades copilot_messages via FK on delete cascade (0011) */
  purgeOldCopilotConversations(cutoff: Date): Promise<number>;
}

export interface RetentionDeps {
  store: RetentionStore;
  now?: () => Date;
}

export interface RetentionSummary {
  status: "completed";
  purged: number;
  cutoff: string;
  webhookEventsPurged: number;
  copilotConversationsPurged: number;
}

export interface ExpiredTrialAccount {
  id: string;
}

export interface TrialStore {
  /** accounts still on a no-card trial (status='trialing', no Stripe sub) past trial_ends_at */
  getExpiredTrialAccounts(now: Date): Promise<ExpiredTrialAccount[]>;
  /** flip lapsed trials to plan='none', status='none', outreach paused — returns rows changed */
  expireTrials(ids: string[]): Promise<number>;
}

export interface TrialExpiryDeps {
  store: TrialStore;
  now?: () => Date;
}

export interface TrialExpirySummary {
  status: "completed";
  expired: number;
}

export interface InboundPayload {
  source: "linkedin";
  payload: unknown;
  accountId?: string;
}

export interface InboundStore {
  findLinkedInAccountByProviderRef(ref: string): Promise<{ id: string; accountId: string } | null>;
  /**
   * insert-or-update by (accountId, providerRef); sets connected_at when turning active.
   * 'restricted' is written as-is to linkedin_accounts.status (enum already includes the value);
   * connectedAt is preserved on restrict — only reset on reconnect (active).
   */
  upsertLinkedInAccountStatus(e: {
    vanteraAccountId: string;
    providerRef: string;
    status: "active" | "restricted" | "disconnected";
    profileUrl: string | null;
    displayName: string | null;
  }): Promise<void>;
  findLeadByLinkedInUrl(accountId: string, normalizedUrl: string): Promise<{ id: string; campaignId: string | null } | null>;
  insertReply(r: {
    accountId: string;
    leadId: string;
    campaignId: string | null;
    channel: "linkedin";
    providerMessageRef: string | null;
    body: string;
    receivedAt: Date;
  }): Promise<string>;
  setReplyClassification(replyId: string, verdict: ReplyVerdict): Promise<void>;
  addSuppression(
    accountId: string,
    kind: "linkedin",
    value: string,
    source: "unsubscribe" | "not_interested",
    leadId?: string
  ): Promise<void>;
  setLeadConnected(leadId: string, at: Date): Promise<void>;
  setLeadReplied(leadId: string, campaignId: string | null): Promise<void>;
  /** Stamp meeting_booked_at when a reply confirms a scheduled meeting (first booking wins). */
  markMeetingBooked(leadId: string, at: Date): Promise<void>;
  /** pending_review/approved/scheduled drafts for the lead → canceled; returns count */
  cancelPendingSends(leadId: string): Promise<number>;
  /**
   * Stop the lead's active sequence run → 'stopped'. Called ONLY for hard-negative replies
   * (not_interested / unsubscribe). A plain reply no longer stops outbound: the sequence keeps
   * nurturing until the lead converts (conversion gate) or is exhausted.
   */
  stopSequenceForReply(leadId: string): Promise<void>;
  insertLeadNotification(n: { accountId: string; leadId: string; kind: "reply"; body: string }): Promise<void>;
}

export interface InboundDeps {
  store: InboundStore;
  linkedinInfra: Pick<LinkedInInfra, "parseEventWebhook">;
  classifyFn: (body: string) => Promise<ReplyVerdict>;
  now?: () => Date;
}

export interface InboundSummary {
  handled: boolean;
  action: string;
}

// --- sequence orchestrator ---
export type SequenceStage = "linkedin";
export type SequenceCursor = SequenceStage | "done";
export type SequenceStatus = "active" | "paused_reply" | "converted" | "exhausted" | "stopped";

export interface StageConfig {
  enabled: boolean;
  touches: number;       // touches before the wait window
  touchGapDays: number;  // spacing between touches within the stage
  waitDays: number;      // conversion window held after the last touch
}

export interface SequenceConfig {
  order: SequenceStage[];
  stages: Record<SequenceStage, StageConfig>;
}

export interface SequenceRun {
  id: string;
  accountId: string;
  campaignId: string;
  leadId: string;
  status: SequenceStatus;
  currentStage: SequenceCursor;
  touchesDone: number;
  nextActionAt: Date;
  enteredStageAt: Date;
}

export interface LeadChannels {
  linkedinUrl: string | null;
}

export interface SequenceTickContext {
  run: SequenceRun;
  config: SequenceConfig;
  channels: LeadChannels;
  suppressed: { linkedin: boolean };
  accountPaused: boolean;
  killSwitch: boolean;
  now: Date;
}

export interface SequenceRunPatch {
  status?: SequenceStatus;
  currentStage?: SequenceCursor;
  touchesDone?: number;
  nextActionAt?: Date;
  enteredStageAt?: Date;
  lastTouchAt?: Date;
}

export type SequenceDecision =
  | { kind: "hold" }
  | { kind: "dispatch"; stage: SequenceStage; touchNo: number; patch: SequenceRunPatch }
  | { kind: "advance"; patch: SequenceRunPatch }
  | { kind: "exhaust"; patch: SequenceRunPatch };

export interface SequenceTouchDispatch {
  runId: string;
  accountId: string;
  campaignId: string;
  leadId: string;
  stage: SequenceStage;
  touchNo: number;
}

export interface DueSequenceRun {
  run: SequenceRun;
  channels: LeadChannels;
  config: SequenceConfig;
  accountPaused: boolean;
}

export interface SequenceStore {
  /** active runs with next_action_at <= now, joined to lead channels + campaign config */
  getDueSequenceRuns(now: Date, limit: number): Promise<DueSequenceRun[]>;
  isKillSwitchOn(): Promise<boolean>;
  suppressionFlags(
    accountId: string,
    ch: LeadChannels
  ): Promise<{ linkedin: boolean }>;
  /** optimistic claim: only updates if status still 'active' AND next_action_at unchanged */
  applyRunPatch(runId: string, expectNextActionAt: Date, patch: SequenceRunPatch): Promise<boolean>;
  /** terminal archive used by the exhaust decision */
  archiveLead(leadId: string, campaignId: string): Promise<void>;
  /** enrol qualified in_campaign leads lacking an active run; returns count created */
  enrollPendingLeads(now: Date): Promise<number>;
}

export interface SequenceTouchStore {
  getDraftableLead(accountId: string, leadId: string): Promise<DraftableLead | null>;
  getCampaignCta(campaignId: string): Promise<string>;
  isSuppressed(accountId: string, kind: "linkedin", value: string): Promise<boolean>;
  insertScheduledSend(send: NewScheduledSend): Promise<void>;
  /** stop a sequence run (lead exits the sequence — e.g. dropped below min_score on refresh) */
  stopSequenceRun(runId: string): Promise<void>;
}

export interface SequenceTouchDeps {
  store: SequenceTouchStore;
  draftLinkedInFn: (input: DraftInput) => Promise<LinkedInDraft>;
  /** current time (injectable for tests); used by the freshness check before a touch */
  now: () => Date;
  /**
   * Re-enrich + re-rank one aged lead before a touch. Returns "ok" (still
   * qualified — draft with current insights) or "dropped" (fell below min_score →
   * the caller exits the sequence; NOT suppression).
   */
  refreshLead: (accountId: string, leadId: string) => Promise<"ok" | "dropped">;
}

export type SequenceTouchOutcome = "drafted" | "suppressed" | "skipped" | "dropped";

// ── Conversion gate (tracked-CTA redirect) ────────────────────────────────────

export interface ConversionStore {
  /** resolve a tracked CTA token to its lead/campaign/account; null if unknown/expired */
  resolveConversionToken(token: string): Promise<{ accountId: string; leadId: string; campaignId: string; targetUrl: string } | null>;
  setLeadConverted(leadId: string): Promise<void>;
  closeSequenceRun(campaignId: string, leadId: string): Promise<void>;
  cancelPendingSends(leadId: string): Promise<number>;
  setCampaignLeadStatus(campaignId: string, leadId: string, status: "completed"): Promise<void>;
  insertLeadNotification(n: { accountId: string; leadId: string; kind: "converted"; body: string }): Promise<void>;
}

export interface ConversionDeps {
  store: ConversionStore;
}

export interface ConversionResult {
  converted: boolean;
  redirectUrl: string | null;
}
