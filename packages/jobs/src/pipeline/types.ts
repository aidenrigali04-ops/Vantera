import type {
  EnrichedProspect,
  IcpCriteria,
  ProspectCandidate,
  ProspectDataSource,
} from "@vantera/prospect-data";
import type {
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
import type { SenderAddress } from "./email-footer";
import type { EmailInfra } from "@vantera/email-infra";
import type { LinkedInInfra } from "@vantera/linkedin-infra";

export interface ScoutConfig {
  prospectsPerRun: number;
  minScore: number;
}

export const SCOUT_DEFAULTS: ScoutConfig = { prospectsPerRun: 25, minScore: 70 };

export interface ScoutContext {
  agent: { id: string; accountId: string; status: string; config: Partial<ScoutConfig> };
  icps: { id: string; name: string; criteria: IcpCriteria }[];
  account: {
    industry: string | null;
    websiteUrl: string | null;
    websiteScan: (WebsiteScan & { url?: string }) | null;
    websiteScannedAt: Date | null;
  };
}

export interface FreshLead {
  leadId: string;
  icpId: string;
  candidate: ProspectCandidate;
}

export interface ScoutStore {
  getScoutContext(agentId: string): Promise<ScoutContext | null>;
  saveWebsiteScan(accountId: string, url: string, scan: WebsiteScan): Promise<void>;
  /** insert unseen candidates, return new-or-unscored leads only (dedupe by external_ref per account) */
  upsertLeads(accountId: string, icpId: string, candidates: ProspectCandidate[]): Promise<FreshLead[]>;
  markRulesGate(leadId: string, result: RulesGateResult): Promise<void>;
  saveEnrichment(leadId: string, accountId: string, enriched: EnrichedProspect): Promise<void>;
  saveScore(leadId: string, insights: LeadInsights, qualified: boolean): Promise<void>;
  completeRun(agentId: string, lastRunAt: Date): Promise<void>;
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
  aiInsights: StoredInsights | null;
}

export interface NewScheduledSend {
  accountId: string;
  campaignId: string;
  leadId: string;
  channel: "email" | "linkedin";
  subject: string | null;
  body: string;
  /** automatic mode inserts clean drafts as 'approved'; style-flagged drafts always review */
  status: "pending_review" | "approved";
  /** invite/message pair for LinkedIn (0009); null for email */
  linkedinStage: "invite" | "message" | null;
  styleFlags: string | null;
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
}

export interface SendDispatchStore {
  isKillSwitchOn(): Promise<boolean>;
  /** approved rows + scheduled rows whose scheduled_for is older than staleCutoff (lost-task recovery) */
  getDispatchableSends(staleCutoff: Date): Promise<DispatchableSend[]>;
  /** Σ over ACTIVE mailboxes of min(daily_send_limit ?? cap, cap) − sends recorded today */
  getEmailCapacity(accountId: string, dayStart: Date): Promise<number>;
  /** null = no active LinkedIn identity */
  getLinkedInAccountAgeDays(accountId: string, now: Date): Promise<number | null>;
  countLinkedInSentToday(accountId: string, kind: "invite" | "message", dayStart: Date): Promise<number>;
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

export interface InboundPayload {
  source: "email" | "linkedin";
  payload: unknown;
}

export interface InboundStore {
  findMailboxByProviderRef(ref: string): Promise<{ id: string; accountId: string } | null>;
  findLinkedInAccountByProviderRef(ref: string): Promise<{ id: string; accountId: string } | null>;
  /** insert-or-update by (accountId, providerRef); sets connected_at when turning active */
  upsertLinkedInAccountStatus(e: {
    vanteraAccountId: string;
    providerRef: string;
    status: "active" | "disconnected";
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
