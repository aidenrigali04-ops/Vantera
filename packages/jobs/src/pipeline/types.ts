import type {
  EnrichedProspect,
  IcpCriteria,
  ProspectCandidate,
  ProspectDataSource,
} from "@vantera/prospect-data";
import type {
  CallBrief,
  CallBriefRequest,
  CallOutcome,
  EmailDraft,
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
import type { VoiceInfra } from "@vantera/voice-infra";
import type { SenderAddress } from "./email-footer";
import type { OutreachCapacity } from "./capacity";
import type { EmailInfra, ProvisionedMailbox, SmtpCredentials } from "@vantera/email-infra";
import type { LinkedInInfra } from "@vantera/linkedin-infra";

export interface ScoutConfig {
  prospectsPerRun: number;
  minScore: number;
  /** capacity-throttle tunables (per-agent override via agents.config jsonb) */
  bufferFactor: number;
  floor: number;
}

export const SCOUT_DEFAULTS: ScoutConfig = {
  prospectsPerRun: 25,
  minScore: 70,
  bufferFactor: 1.3,
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
 * Trial send cap: a trialing account dispatches at most this many outbound sends
 * total (across email + LinkedIn). Bounds deliverability exposure on our provisioned
 * mailboxes and per-send COGS until the account converts. Enforced per-account at the
 * send-dispatch boundary, alongside the channel safety limits.
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
  completeRun(agentId: string, lastRunAt: Date): Promise<void>;
  /** live outreach capacity for the account (warmup state + LinkedIn connection + channel toggles) */
  getOutreachCapacity(accountId: string): Promise<OutreachCapacity>;
  /** in-flight leads not yet contacted (pending_review/approved/scheduled sends, no send recorded) */
  countUncontactedLeads(accountId: string): Promise<number>;
  getLiveCopyAgent(accountId: string): Promise<{ id: string } | null>;
  getLiveCallerAgent(accountId: string): Promise<{ id: string } | null>;
}

export interface ScoutDeps {
  store: ScoutStore;
  prospectData: ProspectDataSource;
  scanFn: (url: string) => Promise<WebsiteScan>;
  rankFn: (candidates: RankCandidate[], ctx: RankContext) => Promise<LeadInsights[]>;
  triggerCopyDraft: (payload: CopyDraftPayload) => Promise<void>;
  triggerCallBrief: (payload: CallBriefDraftPayload) => Promise<void>;
  now?: () => Date;
}

export interface ScoutRunSummary {
  status: "completed" | "skipped";
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

export interface CopyConfig {
  cta: string;
  channels: { linkedin: boolean; email: boolean };
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
  channel: "email" | "linkedin" | "call" | "imessage";
  subject: string | null;
  body: string;
  /** automatic mode inserts clean drafts as 'approved'; style-flagged drafts always review */
  status: "pending_review" | "approved";
  /** invite/message pair for LinkedIn (0009); null for email */
  linkedinStage: "invite" | "message" | null;
  styleFlags: string | null;
  /** structured call brief (channel 'call' only); null otherwise */
  brief?: CallBrief | null;
}

export interface CopyDraftStore {
  getCopyContext(copyAgentId: string): Promise<CopyContext | null>;
  getDraftableLeads(accountId: string, leadIds: string[]): Promise<DraftableLead[]>;
  /** the rule-11 gate: account + kind + lowercased value lookup against suppression_entries */
  isSuppressed(accountId: string, kind: "email" | "linkedin", value: string): Promise<boolean>;
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
  draftEmailFn: (input: DraftInput) => Promise<EmailDraft>;
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
  channel: "email" | "linkedin";
  linkedinStage: "invite" | "message" | null;
  status: string;
  subject: string | null;
  body: string | null;
  campaignStatus: string;
  accountPaused: boolean;
  senderAddress: SenderAddress | null;
  /** resolved human sender name for the {{sender_name}} email sign-off placeholder */
  senderName: string;
  lead: { email: string | null; linkedinUrl: string | null };
}

export interface OutreachSendStore {
  getSendContext(sendId: string): Promise<SendContext | null>;
  isKillSwitchOn(): Promise<boolean>;
  isSuppressed(accountId: string, kind: "email" | "linkedin", value: string): Promise<boolean>;
  /** optimistic claim: scheduled → sending; false means another run owns it */
  claimSending(sendId: string): Promise<boolean>;
  revertToApproved(sendId: string): Promise<void>;
  markSent(sendId: string): Promise<void>;
  markFailed(sendId: string, error: string): Promise<void>;
  markSuppressed(sendId: string): Promise<void>;
  pickActiveMailbox(accountId: string): Promise<{ id: string; providerRef: string | null; status: string } | null>;
  getActiveLinkedInIdentity(accountId: string): Promise<{ id: string; providerRef: string; status: string } | null>;
  createUnsubscribeToken(accountId: string, leadId: string, email: string): Promise<string>;
  recordOutreachSend(rec: {
    accountId: string;
    campaignId: string;
    leadId: string;
    scheduledSendId: string;
    channel: "email" | "linkedin";
    mailboxId?: string;
    linkedinAccountId?: string;
    messageRef: string | null;
  }): Promise<void>;
  setLeadInvited(leadId: string, at: Date): Promise<void>;
  setCampaignLeadStatus(campaignId: string, leadId: string, status: "queued" | "suppressed" | "skipped" | "sent"): Promise<void>;
}

export interface OutreachSendDeps {
  store: OutreachSendStore;
  emailInfra: EmailInfra;
  linkedinInfra: LinkedInInfra;
  appUrl: string;
  now?: () => Date;
}

export type OutreachSendOutcome = "sent" | "suppressed" | "parked" | "failed" | "skipped";

export interface DispatchableSend {
  id: string;
  accountId: string;
  campaignId: string;
  leadId: string;
  channel: "email" | "linkedin";
  linkedinStage: "invite" | "message" | null;
  status: "approved" | "scheduled";
  accountPaused: boolean;
  hasSenderAddress: boolean;
  campaignStatus: string;
  leadInvitedAt: Date | null;
  leadConnectedAt: Date | null;
  /** Drives the trial send cap; 'trialing' accounts are bounded by TRIAL_SEND_CAP. */
  subscriptionStatus: string;
}

export interface SendDispatchStore {
  isKillSwitchOn(): Promise<boolean>;
  /** approved rows + scheduled rows whose scheduled_for is older than staleCutoff (lost-task recovery) */
  getDispatchableSends(staleCutoff: Date): Promise<DispatchableSend[]>;
  /** Total sends recorded for the account (outreach_sends) — enforces TRIAL_SEND_CAP. */
  countAccountSends(accountId: string): Promise<number>;
  /** Σ over ACTIVE mailboxes of min(daily_send_limit ?? cap, cap) − sends recorded today */
  getEmailCapacity(accountId: string, dayStart: Date): Promise<number>;
  /** null = no active LinkedIn identity */
  getLinkedInAccountAgeDays(accountId: string, now: Date): Promise<number | null>;
  countLinkedInSentToday(accountId: string, kind: "invite" | "message", dayStart: Date): Promise<number>;
  /** Rolling 7-day (168h) count of LinkedIn invites actually sent for the account. */
  countLinkedInInvitesLast7Days(accountId: string, now: Date): Promise<number>;
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
  source: "email" | "linkedin";
  payload: unknown;
}

export interface InboundStore {
  findMailboxByProviderRef(ref: string): Promise<{ id: string; accountId: string } | null>;
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
  findLeadByEmail(accountId: string, email: string): Promise<{ id: string; campaignId: string | null } | null>;
  findLeadByLinkedInUrl(accountId: string, normalizedUrl: string): Promise<{ id: string; campaignId: string | null } | null>;
  insertReply(r: {
    accountId: string;
    leadId: string;
    campaignId: string | null;
    channel: "email" | "linkedin";
    providerMessageRef: string | null;
    body: string;
    receivedAt: Date;
  }): Promise<string>;
  setReplyClassification(replyId: string, verdict: ReplyVerdict): Promise<void>;
  addSuppression(
    accountId: string,
    kind: "email" | "linkedin",
    value: string,
    source: "unsubscribe" | "bounce" | "complaint" | "not_interested",
    leadId?: string
  ): Promise<void>;
  pauseMailbox(mailboxId: string): Promise<void>;
  updateMailboxWarmup(mailboxId: string, status: "warming" | "active", dailyCap: number): Promise<void>;
  setLeadConnected(leadId: string, at: Date): Promise<void>;
  setLeadReplied(leadId: string, campaignId: string | null): Promise<void>;
  /** pending_review/approved/scheduled drafts for the lead → canceled; returns count */
  cancelPendingSends(leadId: string): Promise<number>;
  /** pause the lead's active sequence run on a genuine reply; stop=true → 'stopped', else 'paused_reply' */
  pauseSequenceForReply(leadId: string, stop: boolean): Promise<void>;
  insertLeadNotification(n: { accountId: string; leadId: string; kind: "reply"; body: string }): Promise<void>;
}

export interface InboundDeps {
  store: InboundStore;
  emailInfra: Pick<EmailInfra, "parseEventWebhook">;
  linkedinInfra: Pick<LinkedInInfra, "parseEventWebhook">;
  classifyFn: (body: string) => Promise<ReplyVerdict>;
  now?: () => Date;
}

export interface InboundSummary {
  handled: boolean;
  action: string;
}

export interface CallerConfig {
  cta: string;
  bookingLink: string;
  voice: { voiceId: string; personaName: string; language: string };
  recordingConsentMode: "one_party" | "two_party";
  callingWindow: { days: string[]; startLocal: string; endLocal: string };
  maxAttempts: number;
}

export const CALLER_DEFAULTS = {
  maxAttempts: 3,
  callingWindow: { days: ["mon", "tue", "wed", "thu", "fri"], startLocal: "09:00", endLocal: "17:00" },
} as const;

export interface CallerContext {
  agent: { id: string; accountId: string; status: string; campaignId: string | null; config: CallerConfig };
  assets: { kind: string; url: string | null; filename: string | null }[];
  account: { industry: string | null; websiteScan: { summary?: string } | null };
}

export interface CallableLead {
  id: string;
  firstName: string | null;
  lastName: string | null;
  title: string | null;
  companyName: string | null;
  industry: string | null;
  phone: string | null;
  phoneStatus: "unvalidated" | "valid" | "invalid";
  aiInsights: StoredInsights | null;
}

export interface CallBriefDraftPayload {
  callerAgentId: string;
  accountId: string;
  leadIds: string[];
}

export interface CallBriefStore {
  getCallerContext(callerAgentId: string): Promise<CallerContext | null>;
  getCallableLeads(accountId: string, leadIds: string[]): Promise<CallableLead[]>;
  /** rule-11 gate: phone normalized to E.164 lower-case before lookup */
  isSuppressed(accountId: string, kind: "phone", value: string): Promise<boolean>;
  ensureCampaignLead(campaignId: string, leadId: string, accountId: string): Promise<void>;
  setCampaignLeadStatus(campaignId: string, leadId: string, status: "queued" | "suppressed" | "skipped"): Promise<void>;
  insertScheduledSend(send: NewScheduledSend): Promise<void>;
  setLeadStatus(leadId: string, status: "in_campaign"): Promise<void>;
}

export interface CallBriefDeps {
  store: CallBriefStore;
  draftBriefFn: (req: CallBriefRequest) => Promise<CallBrief>;
}

export interface CallBriefSummary {
  status: "completed" | "skipped";
  drafted: number;
  suppressed: number;
  skipped: number;
}

// --- dispatch (send boundary) ---
export interface DispatchableCall {
  id: string;
  accountId: string;
  campaignId: string;
  agentId: string;
  leadId: string;
  brief: CallBrief;
  phone: string;
  config: CallerConfig;
  attemptsSoFar: number;
  leadTimezone: string | null;
}

export interface CallDispatchStore {
  getApprovedCalls(): Promise<DispatchableCall[]>;
  isKillSwitchOn(): Promise<boolean>;
  isSuppressed(accountId: string, kind: "phone", value: string): Promise<boolean>;
  claimSending(sendId: string): Promise<boolean>;
  revertToApproved(sendId: string): Promise<void>;
  markSuppressed(sendId: string): Promise<void>;
  insertCall(c: {
    accountId: string; leadId: string; agentId: string; campaignId: string;
    scheduledSendId: string; providerCallId: string; attemptNo: number;
  }): Promise<void>;
  markSendSent(sendId: string): Promise<void>;
}

export interface CallDispatchDeps {
  store: CallDispatchStore;
  voiceInfra: VoiceInfra;
  fromNumber: string;
  now?: () => Date;
}

export type CallDispatchOutcome = "dialing" | "suppressed" | "outside_window" | "skipped" | "halted" | "no_caller_number" | "failed";

export interface VoiceInboundStore {
  recordWebhookEvent(source: "voice", providerEventId: string, payload: unknown): Promise<boolean>;
  findCallByProviderId(providerCallId: string): Promise<{ id: string; accountId: string; leadId: string; phone: string | null } | null>;
  updateCallEnded(callId: string, e: { status: string; outcome: CallOutcome; durationSec: number; recordingUrl: string | null; transcript: string | null }): Promise<void>;
  updateCallStarted(callId: string): Promise<void>;
  addSuppression(accountId: string, kind: "phone", value: string, source: "not_interested", leadId?: string): Promise<void>;
}

export interface VoiceInboundDeps {
  store: VoiceInboundStore;
  voiceInfra: Pick<VoiceInfra, "parseEventWebhook">;
  classifyFn: (transcript: string) => Promise<CallOutcome>;
  now?: () => Date;
}

export interface VoiceInboundSummary {
  handled: boolean;
  action: string;
}

// --- sequence orchestrator ---
export type SequenceStage = "linkedin" | "email" | "imessage" | "call";
export type SequenceCursor = SequenceStage | "done";
export type SequenceStatus = "active" | "paused_reply" | "converted" | "exhausted" | "stopped";

export interface StageConfig {
  enabled: boolean;
  touches: number;       // touches before the wait window (ignored for 'call')
  touchGapDays: number;  // spacing between touches within the stage
  waitDays: number;      // conversion window held after the last touch
  maxAttempts?: number;  // 'call' only: dial attempts before exhaustion
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
  callAttempts: number;
  nextActionAt: Date;
  enteredStageAt: Date;
}

export interface LeadChannels {
  linkedinUrl: string | null;
  email: string | null;
  emailStatus: string; // 'valid' | 'unverified' | 'invalid' | 'risky'
  phone: string | null;
  phoneStatus: string; // 'valid' | 'unvalidated' | 'invalid'
}

export interface SequenceTickContext {
  run: SequenceRun;
  config: SequenceConfig;
  channels: LeadChannels;
  suppressed: { linkedin: boolean; email: boolean; phone: boolean };
  accountPaused: boolean;
  killSwitch: boolean;
  now: Date;
}

export interface SequenceRunPatch {
  status?: SequenceStatus;
  currentStage?: SequenceCursor;
  touchesDone?: number;
  callAttempts?: number;
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
  ): Promise<{ linkedin: boolean; email: boolean; phone: boolean }>;
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
  isSuppressed(accountId: string, kind: "email" | "linkedin" | "phone", value: string): Promise<boolean>;
  insertScheduledSend(send: NewScheduledSend): Promise<void>;
  /** stop a sequence run (lead exits the sequence — e.g. dropped below min_score on refresh) */
  stopSequenceRun(runId: string): Promise<void>;
}

export interface SequenceTouchDeps {
  store: SequenceTouchStore;
  draftEmailFn: (input: DraftInput) => Promise<EmailDraft>;
  draftLinkedInFn: (input: DraftInput) => Promise<LinkedInDraft>;
  /** current time (injectable for tests); used by the freshness check before an email touch */
  now: () => Date;
  /**
   * Re-enrich + re-rank one aged lead before an email touch. Returns "ok" (still
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

// ── Mailbox SMTP secret store methods ──────────────────────────────────────────

export interface MailboxSmtpStore {
  /** Persist provisioned mailboxes with their SMTP secret encrypted at rest. */
  saveProvisionedMailboxes(accountId: string, mailboxes: ProvisionedMailbox[]): Promise<void>;
  /** Decrypt and return a mailbox's SMTP creds for the send path. */
  getMailboxSmtpCreds(mailboxId: string): Promise<SmtpCredentials>;
  /** Collect provider refs + domains for an account's mailboxes (deprovision). */
  collectMailboxProviderRefs(accountId: string): Promise<{ providerRef: string; domain: string }[]>;
  /** Delete all mailbox rows for the account (and their encrypted SMTP secrets). */
  purgeMailboxes(accountId: string): Promise<void>;
}
