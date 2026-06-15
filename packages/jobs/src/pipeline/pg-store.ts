import { and, count, desc, eq, gte, inArray, isNull, lt, lte, or, sql } from "drizzle-orm";
import {
  accounts,
  agentAssets,
  agentIcps,
  agents,
  calls,
  campaignLeads,
  campaigns,
  conversionTokens,
  copilotConversations,
  crmConnections,
  crmPushEvents,
  enrichmentResults,
  icps,
  leadNotifications,
  leads,
  linkedinAccounts,
  mailboxes,
  outreachSends,
  replies,
  scheduledSends,
  sequenceRuns,
  suppressionEntries,
  unsubscribeTokens,
  appSettings,
  webhookEvents,
  type Db,
} from "@vantera/db";
import type { EnrichedProspect, IcpCriteria, ProspectCandidate } from "@vantera/prospect-data";
import { toStoredInsights, type LeadInsights, type WebsiteScan } from "@vantera/agent-brains";
import type { ClosedDeal, CrmProvider } from "@vantera/crm-infra";
import type { CrmPushStore } from "./crm-push";
import {
  SCOUT_DEFAULTS,
  type CallBriefStore,
  type CallDispatchStore,
  type CallerConfig,
  type CallerContext,
  type CallableLead,
  type ConversionStore,
  type CopyConfig,
  type CopyContext,
  type CopyDraftStore,
  type DispatchableCall,
  type DispatchableSend,
  type DraftableLead,
  type DueSequenceRun,
  type FreshLead,
  type InboundStore,
  type LeadChannels,
  type NewScheduledSend,
  type OutreachSendStore,
  type PurgeCandidate,
  type RetentionStore,
  type TrialStore,
  type ScoutConfig,
  type ScoutContext,
  type ScoutStore,
  type SendContext,
  type SendDispatchStore,
  type SequenceRunPatch,
  type SequenceStore,
  type SequenceTouchStore,
  type VoiceInboundStore,
} from "./types";
import { EMAIL_STEADY_DAILY_PER_MAILBOX } from "./safety-limits";
import { parseSenderAddress } from "./email-footer";
import { normalizeLinkedInUrl } from "./copy-draft";
import { normalizePhone } from "./call-brief";
import { resolveSequenceConfig } from "./sequence-config";
import type { RefreshLeadLoad, RefreshLeadStore } from "./refresh-lead";

/** Suppression lookup that accepts any kind (email/linkedin/phone) — used by the sequence store. */
async function isSuppressedAnyKind(
  db: Db,
  accountId: string,
  kind: "email" | "linkedin" | "phone",
  value: string
): Promise<boolean> {
  const [hit] = await db
    .select({ id: suppressionEntries.id })
    .from(suppressionEntries)
    .where(
      and(
        eq(suppressionEntries.accountId, accountId),
        eq(suppressionEntries.kind, kind),
        eq(suppressionEntries.value, value)
      )
    )
    .limit(1);
  return Boolean(hit);
}

/** Maps a NewScheduledSend to the drizzle insert values shape. */
function toRow(send: NewScheduledSend) {
  return {
    accountId: send.accountId,
    campaignId: send.campaignId,
    leadId: send.leadId,
    channel: send.channel,
    status: send.status,
    subject: send.subject,
    body: send.body,
    brief: send.brief ?? null,
    linkedinStage: send.linkedinStage,
    styleFlags: send.styleFlags,
  };
}

/** Drizzle-backed store used by the Trigger.dev tasks (service-role DATABASE_URL). */
export function createPgStore(db: Db): ScoutStore & CopyDraftStore & SchedulerStore & RetentionStore & TrialStore & SendDispatchStore & OutreachSendStore & InboundStore & SequenceStore & SequenceTouchStore & ConversionStore & RefreshLeadStore {
  return {
    async getScoutContext(agentId: string): Promise<ScoutContext | null> {
      const [agent] = await db.select().from(agents).where(eq(agents.id, agentId));
      if (!agent || agent.kind !== "scout") return null;
      const icpRows = await db
        .select({ id: icps.id, name: icps.name, criteria: icps.criteria, position: agentIcps.position })
        .from(agentIcps)
        .innerJoin(icps, eq(agentIcps.icpId, icps.id))
        .where(eq(agentIcps.agentId, agentId));
      const [account] = await db.select().from(accounts).where(eq(accounts.id, agent.accountId));
      if (!account) return null;
      return {
        agent: {
          id: agent.id,
          accountId: agent.accountId,
          status: agent.status,
          cadence: agent.cadence as "daily" | "weekly" | null,
          config: (agent.config ?? {}) as Partial<ScoutConfig>,
        },
        icps: icpRows
          .sort((a, b) => a.position - b.position)
          .map((r) => ({ id: r.id, name: r.name, criteria: (r.criteria ?? {}) as IcpCriteria })),
        account: {
          industry: account.onboardingIndustry,
          websiteUrl: account.websiteUrl,
          websiteScan: account.websiteScan as ScoutContext["account"]["websiteScan"],
          websiteScannedAt: account.websiteScannedAt,
          subscriptionStatus: account.subscriptionStatus,
        },
      };
    },

    async countAccountLeads(accountId: string): Promise<number> {
      const [row] = await db
        .select({ n: count() })
        .from(leads)
        .where(eq(leads.accountId, accountId));
      return row?.n ?? 0;
    },

    async saveWebsiteScan(accountId: string, url: string, scan: WebsiteScan): Promise<void> {
      await db
        .update(accounts)
        .set({ websiteScan: { ...scan, url }, websiteScannedAt: new Date() })
        .where(eq(accounts.id, accountId));
    },

    async upsertLeads(
      accountId: string,
      icpId: string,
      candidates: ProspectCandidate[]
    ): Promise<FreshLead[]> {
      if (candidates.length === 0) return [];
      const refs = candidates.map((c) => c.externalRef);
      const existing = await db
        .select({ id: leads.id, externalRef: leads.externalRef, scoredAt: leads.scoredAt })
        .from(leads)
        .where(and(eq(leads.accountId, accountId), inArray(leads.externalRef, refs)));
      const existingByRef = new Map(existing.map((r) => [r.externalRef, r]));

      const fresh: FreshLead[] = [];
      for (const candidate of candidates) {
        const found = existingByRef.get(candidate.externalRef);
        if (found) {
          // re-process only if it never made it through scoring
          if (!found.scoredAt) fresh.push({ leadId: found.id, icpId, candidate });
          continue;
        }
        const [inserted] = await db
          .insert(leads)
          .values({
            accountId,
            icpId,
            source: "discovery",
            externalRef: candidate.externalRef,
            companyName: candidate.companyName,
            companyDomain: candidate.companyDomain,
            companySize: candidate.companySize,
            industry: candidate.industry,
            location: candidate.location,
            firstName: candidate.firstName,
            lastName: candidate.lastName,
            title: candidate.title,
            linkedinUrl: candidate.linkedinUrl,
          })
          .returning({ id: leads.id });
        if (inserted) fresh.push({ leadId: inserted.id, icpId, candidate });
      }
      return fresh;
    },

    async markRulesGate(leadId, result) {
      await db
        .update(leads)
        .set({
          rulesGatePassed: result.passed,
          rulesGateReasons: result.reasons,
          ...(result.passed ? {} : { status: "rejected" as const }),
        })
        .where(eq(leads.id, leadId));
    },

    async saveEnrichment(leadId: string, accountId: string, enriched: EnrichedProspect) {
      await db
        .update(leads)
        .set({
          email: enriched.email ?? undefined,
          emailStatus: enriched.emailStatus ?? undefined,
          phone: enriched.phone ?? undefined,
          phoneStatus: enriched.phoneStatus ?? undefined,
          linkedinUrl: enriched.linkedinUrl ?? undefined,
          techStack: enriched.technographics ?? undefined,
        })
        .where(eq(leads.id, leadId));
      if (enriched.email) {
        await db.insert(enrichmentResults).values({
          accountId,
          leadId,
          kind: "email_verification",
          provider: "prospect-data",
          status: "success",
          payload: { email: enriched.email, status: enriched.emailStatus },
        });
      }
      if (enriched.phone) {
        await db.insert(enrichmentResults).values({
          accountId,
          leadId,
          kind: "phone_validation",
          provider: "prospect-data",
          status: "success",
          payload: { phone: enriched.phone, status: enriched.phoneStatus },
        });
      }
    },

    async saveScore(leadId: string, insights: LeadInsights, qualified: boolean) {
      await db
        .update(leads)
        .set({
          aiScore: Math.round(insights.score),
          aiRationale: insights.rationale,
          aiInsights: toStoredInsights(insights),
          scoredAt: new Date(),
          status: qualified ? "qualified" : "rejected",
        })
        .where(eq(leads.id, leadId));
    },

    async completeRun(agentId: string, lastRunAt: Date) {
      await db.update(agents).set({ lastRunAt }).where(eq(agents.id, agentId));
    },

    async getOutreachCapacity(accountId: string) {
      const mbx = await db
        .select({ status: mailboxes.status, dailyCap: mailboxes.dailySendLimit })
        .from(mailboxes)
        .where(and(eq(mailboxes.accountId, accountId), inArray(mailboxes.status, ["warming", "active"])));

      const [li] = await db
        .select({ connectedAt: linkedinAccounts.connectedAt })
        .from(linkedinAccounts)
        .where(and(eq(linkedinAccounts.accountId, accountId), eq(linkedinAccounts.status, "active")))
        .orderBy(linkedinAccounts.connectedAt)
        .limit(1);

      const [copy] = await db
        .select({ config: agents.config })
        .from(agents)
        .where(and(eq(agents.accountId, accountId), eq(agents.kind, "copy"), eq(agents.status, "live")))
        .limit(1);
      const channels = (copy?.config as { channels?: { email?: boolean; linkedin?: boolean } } | null)
        ?.channels;

      const now = Date.now();
      return {
        linkedinConnected: Boolean(li),
        linkedinAccountAgeDays: li?.connectedAt
          ? Math.floor((now - li.connectedAt.getTime()) / 86_400_000)
          : null,
        linkedinEnabled: channels?.linkedin ?? Boolean(li),
        emailEnabled: channels?.email ?? mbx.length > 0,
        mailboxes: mbx.map((m) => ({
          phase: m.status === "active" ? ("ready" as const) : ("warming" as const),
          dailyCap: m.dailyCap ?? 0,
        })),
      };
    },

    async countUncontactedLeads(accountId: string) {
      const rows = await db
        .selectDistinct({ leadId: scheduledSends.leadId })
        .from(scheduledSends)
        .where(
          and(
            eq(scheduledSends.accountId, accountId),
            inArray(scheduledSends.status, ["drafting", "pending_review", "approved", "scheduled"]),
          ),
        );
      return rows.length;
    },

    async getLiveCopyAgent(accountId: string) {
      const [agent] = await db
        .select({ id: agents.id })
        .from(agents)
        .where(and(eq(agents.accountId, accountId), eq(agents.kind, "copy"), eq(agents.status, "live")));
      return agent ?? null;
    },

    async getLiveCallerAgent(accountId: string) {
      const [agent] = await db
        .select({ id: agents.id })
        .from(agents)
        .where(and(eq(agents.accountId, accountId), eq(agents.kind, "caller"), eq(agents.status, "live")));
      return agent ?? null;
    },

    // ── CopyDraftStore ───────────────────────────────────────────────────────

    async getCopyContext(copyAgentId: string): Promise<CopyContext | null> {
      const [agent] = await db.select().from(agents).where(eq(agents.id, copyAgentId));
      if (!agent || agent.kind !== "copy") return null;
      const assets = await db
        .select({ kind: agentAssets.kind, url: agentAssets.url, filename: agentAssets.filename })
        .from(agentAssets)
        .where(eq(agentAssets.agentId, copyAgentId));
      const [account] = await db.select().from(accounts).where(eq(accounts.id, agent.accountId));
      if (!account) return null;
      const [campaign] = agent.campaignId
        ? await db.select({ sendMode: campaigns.sendMode }).from(campaigns).where(eq(campaigns.id, agent.campaignId))
        : [undefined];
      const config = (agent.config ?? {}) as Partial<CopyConfig>;
      return {
        agent: {
          id: agent.id,
          accountId: agent.accountId,
          status: agent.status,
          campaignId: agent.campaignId,
          config: {
            cta: config.cta ?? "a quick look",
            channels: { linkedin: config.channels?.linkedin ?? false, email: config.channels?.email ?? false },
          },
          sendMode: campaign?.sendMode === "automatic" ? "automatic" : "review",
        },
        assets,
        account: {
          industry: account.onboardingIndustry,
          websiteScan: account.websiteScan as CopyContext["account"]["websiteScan"],
        },
      };
    },

    async getDraftableLeads(accountId: string, leadIds: string[]): Promise<DraftableLead[]> {
      if (leadIds.length === 0) return [];
      const rows = await db
        .select()
        .from(leads)
        .where(and(eq(leads.accountId, accountId), inArray(leads.id, leadIds)));
      return rows.map((r) => ({
        id: r.id,
        firstName: r.firstName,
        lastName: r.lastName,
        title: r.title,
        companyName: r.companyName,
        industry: r.industry,
        email: r.email,
        linkedinUrl: r.linkedinUrl,
        phone: r.phone,
        aiInsights: r.aiInsights as DraftableLead["aiInsights"],
        scoredAt: r.scoredAt,
      }));
    },

    async getDraftableLead(accountId: string, leadId: string): Promise<DraftableLead | null> {
      const [r] = await db
        .select()
        .from(leads)
        .where(and(eq(leads.accountId, accountId), eq(leads.id, leadId)))
        .limit(1);
      if (!r) return null;
      return {
        id: r.id,
        firstName: r.firstName,
        lastName: r.lastName,
        title: r.title,
        companyName: r.companyName,
        industry: r.industry,
        email: r.email,
        linkedinUrl: r.linkedinUrl,
        phone: r.phone,
        aiInsights: r.aiInsights as DraftableLead["aiInsights"],
        scoredAt: r.scoredAt,
      };
    },

    async getCampaignCta(campaignId: string): Promise<string> {
      // CTA lives on the agent that owns this campaign (agents.config.cta).
      const [agent] = await db
        .select({ config: agents.config })
        .from(agents)
        .where(eq(agents.campaignId, campaignId))
        .limit(1);
      const config = (agent?.config ?? {}) as { cta?: string };
      return config.cta ?? "a quick look";
    },

    async isSuppressed(accountId, kind, value) {
      const [hit] = await db
        .select({ id: suppressionEntries.id })
        .from(suppressionEntries)
        .where(
          and(
            eq(suppressionEntries.accountId, accountId),
            eq(suppressionEntries.kind, kind),
            eq(suppressionEntries.value, value)
          )
        )
        .limit(1);
      return Boolean(hit);
    },

    async ensureCampaignLead(campaignId, leadId, accountId) {
      await db
        .insert(campaignLeads)
        .values({ campaignId, leadId, accountId })
        .onConflictDoNothing();
    },

    async setCampaignLeadStatus(campaignId, leadId, status) {
      await db
        .update(campaignLeads)
        .set({ status })
        .where(and(eq(campaignLeads.campaignId, campaignId), eq(campaignLeads.leadId, leadId)));
    },

    async insertScheduledSend(send: NewScheduledSend) {
      await db.insert(scheduledSends).values(toRow(send));
    },

    async stopSequenceRun(runId: string) {
      await db
        .update(sequenceRuns)
        .set({ status: "stopped", updatedAt: new Date() })
        .where(eq(sequenceRuns.id, runId));
    },

    async insertLinkedInSendPair(invite: NewScheduledSend, message: NewScheduledSend) {
      await db.transaction(async (tx) => {
        await tx.insert(scheduledSends).values(toRow(invite));
        await tx.insert(scheduledSends).values(toRow(message));
      });
    },

    async setLeadStatus(leadId, status) {
      await db.update(leads).set({ status }).where(eq(leads.id, leadId));
    },

    // ── SchedulerStore ───────────────────────────────────────────────────────

    async getDueScoutAgents(now: Date) {
      return db
        .select({
          id: agents.id,
          accountId: agents.accountId,
          runAtTime: agents.runAtTime,
          cadence: agents.cadence,
          timezone: agents.timezone,
        })
        .from(agents)
        .where(
          and(
            eq(agents.kind, "scout"),
            eq(agents.status, "live"),
            or(isNull(agents.nextRunAt), lte(agents.nextRunAt, now))
          )
        );
    },

    async advanceSchedule(agentId: string, nextRunAt: Date) {
      await db.update(agents).set({ nextRunAt }).where(eq(agents.id, agentId));
    },

    // ── RetentionStore ───────────────────────────────────────────────────────

    async getPurgeCandidates(cutoff: Date): Promise<PurgeCandidate[]> {
      return db
        .select({
          id: leads.id,
          status: leads.status,
          rulesGatePassed: leads.rulesGatePassed,
          scoredAt: leads.scoredAt,
        })
        .from(leads)
        .where(and(lt(leads.createdAt, cutoff), inArray(leads.status, ["sourced", "rejected"])));
    },

    async deleteLeads(ids: string[]): Promise<number> {
      // enrichment_results cascade with the lead; suppression entries set-null and survive (0003)
      const rows = await db.delete(leads).where(inArray(leads.id, ids)).returning({ id: leads.id });
      return rows.length;
    },

    async purgeWebhookEvents(cutoff: Date): Promise<number> {
      const rows = await db.delete(webhookEvents).where(lt(webhookEvents.receivedAt, cutoff)).returning({ id: webhookEvents.id });
      return rows.length;
    },

    async purgeOldCopilotConversations(cutoff: Date): Promise<number> {
      // copilot_messages cascade-delete via FK on delete cascade (0011)
      const rows = await db.delete(copilotConversations).where(lt(copilotConversations.updatedAt, cutoff)).returning({ id: copilotConversations.id });
      return rows.length;
    },

    // ── SendDispatchStore ────────────────────────────────────────────────────

    async isKillSwitchOn() {
      const [row] = await db.select().from(appSettings).where(eq(appSettings.key, "outreach_kill_switch"));
      return row?.value === true;
    },

    async getDispatchableSends(staleCutoff: Date): Promise<DispatchableSend[]> {
      const rows = await db
        .select({
          id: scheduledSends.id,
          accountId: scheduledSends.accountId,
          campaignId: scheduledSends.campaignId,
          leadId: scheduledSends.leadId,
          channel: scheduledSends.channel,
          linkedinStage: scheduledSends.linkedinStage,
          status: scheduledSends.status,
          accountPaused: accounts.outreachPaused,
          senderAddress: accounts.senderAddress,
          subscriptionStatus: accounts.subscriptionStatus,
          campaignStatus: campaigns.status,
          leadInvitedAt: leads.linkedinInvitedAt,
          leadConnectedAt: leads.linkedinConnectedAt,
        })
        .from(scheduledSends)
        .innerJoin(accounts, eq(scheduledSends.accountId, accounts.id))
        .innerJoin(campaigns, eq(scheduledSends.campaignId, campaigns.id))
        .innerJoin(leads, eq(scheduledSends.leadId, leads.id))
        .where(
          or(
            eq(scheduledSends.status, "approved"),
            and(eq(scheduledSends.status, "scheduled"), lt(scheduledSends.scheduledFor, staleCutoff))
          )
        );
      return rows.map((r) => ({
        id: r.id,
        accountId: r.accountId,
        campaignId: r.campaignId,
        leadId: r.leadId,
        channel: r.channel as "email" | "linkedin" | "imessage",
        linkedinStage: r.linkedinStage as "invite" | "message" | null,
        status: r.status as "approved" | "scheduled",
        accountPaused: r.accountPaused,
        hasSenderAddress: parseSenderAddress(r.senderAddress) !== null,
        campaignStatus: r.campaignStatus,
        leadInvitedAt: r.leadInvitedAt,
        leadConnectedAt: r.leadConnectedAt,
        subscriptionStatus: r.subscriptionStatus,
      }));
    },

    async countAccountSends(accountId: string): Promise<number> {
      const [row] = await db
        .select({ n: count() })
        .from(outreachSends)
        .where(eq(outreachSends.accountId, accountId));
      return row?.n ?? 0;
    },

    async getEmailCapacity(accountId: string, dayStart: Date): Promise<number> {
      const boxes = await db
        .select({ id: mailboxes.id, dailySendLimit: mailboxes.dailySendLimit })
        .from(mailboxes)
        .where(and(eq(mailboxes.accountId, accountId), eq(mailboxes.status, "active"))); // warming NEVER counts
      if (boxes.length === 0) return 0;
      const sent = await db
        .select({ mailboxId: outreachSends.mailboxId })
        .from(outreachSends)
        .where(and(eq(outreachSends.accountId, accountId), eq(outreachSends.channel, "email"), gte(outreachSends.sentAt, dayStart)));
      const sentByBox = new Map<string, number>();
      for (const s of sent) if (s.mailboxId) sentByBox.set(s.mailboxId, (sentByBox.get(s.mailboxId) ?? 0) + 1);
      return boxes.reduce((sum, b) => {
        const cap = Math.min(b.dailySendLimit ?? EMAIL_STEADY_DAILY_PER_MAILBOX, EMAIL_STEADY_DAILY_PER_MAILBOX);
        return sum + Math.max(0, cap - (sentByBox.get(b.id) ?? 0));
      }, 0);
    },

    async getLinkedInAccountAgeDays(accountId: string, now: Date): Promise<number | null> {
      const [acct] = await db
        .select({ connectedAt: linkedinAccounts.connectedAt })
        .from(linkedinAccounts)
        .where(and(eq(linkedinAccounts.accountId, accountId), eq(linkedinAccounts.status, "active")))
        .limit(1);
      if (!acct) return null;
      if (!acct.connectedAt) return 0;
      return Math.floor((now.getTime() - acct.connectedAt.getTime()) / 86_400_000);
    },

    async countLinkedInSentToday(accountId: string, kind: "invite" | "message", dayStart: Date): Promise<number> {
      const rows = await db
        .select({ id: outreachSends.id })
        .from(outreachSends)
        .innerJoin(scheduledSends, eq(outreachSends.scheduledSendId, scheduledSends.id))
        .where(
          and(
            eq(outreachSends.accountId, accountId),
            eq(outreachSends.channel, "linkedin"),
            eq(scheduledSends.linkedinStage, kind),
            gte(outreachSends.sentAt, dayStart)
          )
        );
      return rows.length;
    },

    async countImessageSentToday(accountId: string, dayStart: Date): Promise<number> {
      const rows = await db
        .select({ id: outreachSends.id })
        .from(outreachSends)
        .where(
          and(
            eq(outreachSends.accountId, accountId),
            eq(outreachSends.channel, "imessage"),
            gte(outreachSends.sentAt, dayStart)
          )
        );
      return rows.length;
    },

    async markScheduled(sendId: string, scheduledFor: Date) {
      await db.update(scheduledSends).set({ status: "scheduled", scheduledFor }).where(eq(scheduledSends.id, sendId));
    },

    async cancelSend(sendId: string, error: string) {
      await db.update(scheduledSends).set({ status: "canceled", error }).where(eq(scheduledSends.id, sendId));
    },

    // ── OutreachSendStore ────────────────────────────────────────────────────

    async getSendContext(sendId: string): Promise<SendContext | null> {
      const [r] = await db
        .select({
          id: scheduledSends.id,
          accountId: scheduledSends.accountId,
          campaignId: scheduledSends.campaignId,
          leadId: scheduledSends.leadId,
          channel: scheduledSends.channel,
          linkedinStage: scheduledSends.linkedinStage,
          status: scheduledSends.status,
          subject: scheduledSends.subject,
          body: scheduledSends.body,
          campaignStatus: campaigns.status,
          accountPaused: accounts.outreachPaused,
          senderAddress: accounts.senderAddress,
          senderName: accounts.senderName,
          leadEmail: leads.email,
          leadLinkedinUrl: leads.linkedinUrl,
          leadPhone: leads.phone,
        })
        .from(scheduledSends)
        .innerJoin(accounts, eq(scheduledSends.accountId, accounts.id))
        .innerJoin(campaigns, eq(scheduledSends.campaignId, campaigns.id))
        .innerJoin(leads, eq(scheduledSends.leadId, leads.id))
        .where(eq(scheduledSends.id, sendId));
      if (!r) return null;
      return {
        id: r.id,
        accountId: r.accountId,
        campaignId: r.campaignId,
        leadId: r.leadId,
        channel: r.channel as "email" | "linkedin" | "imessage",
        linkedinStage: r.linkedinStage as "invite" | "message" | null,
        status: r.status,
        subject: r.subject,
        body: r.body,
        campaignStatus: r.campaignStatus,
        accountPaused: r.accountPaused,
        senderAddress: parseSenderAddress(r.senderAddress),
        senderName: r.senderName ?? "", // null → empty so the send path strips {{sender_name}} cleanly
        lead: { email: r.leadEmail, linkedinUrl: r.leadLinkedinUrl, phone: r.leadPhone },
      };
    },

    async claimSending(sendId: string): Promise<boolean> {
      const rows = await db
        .update(scheduledSends)
        .set({ status: "sending" })
        .where(and(eq(scheduledSends.id, sendId), eq(scheduledSends.status, "scheduled")))
        .returning({ id: scheduledSends.id });
      return rows.length > 0;
    },

    async revertToApproved(sendId: string) {
      await db.update(scheduledSends).set({ status: "approved", scheduledFor: null }).where(eq(scheduledSends.id, sendId));
    },

    async markSent(sendId: string) {
      await db.update(scheduledSends).set({ status: "sent" }).where(eq(scheduledSends.id, sendId));
    },

    async markFailed(sendId: string, error: string) {
      await db.update(scheduledSends).set({ status: "failed", error }).where(eq(scheduledSends.id, sendId));
    },

    async markSuppressed(sendId: string) {
      await db.update(scheduledSends).set({ status: "suppressed" }).where(eq(scheduledSends.id, sendId));
    },

    async pickActiveMailbox(accountId: string) {
      const boxes = await db
        .select({ id: mailboxes.id, providerRef: mailboxes.providerRef, status: mailboxes.status })
        .from(mailboxes)
        .where(and(eq(mailboxes.accountId, accountId), eq(mailboxes.status, "active")));
      if (boxes.length === 0) return null;
      // LRU rotation by last outbound send; 50 recent sends is plenty to order a handful of mailboxes
      const lastSends = await db
        .select({ mailboxId: outreachSends.mailboxId, sentAt: outreachSends.sentAt })
        .from(outreachSends)
        .where(and(eq(outreachSends.accountId, accountId), eq(outreachSends.channel, "email")))
        .orderBy(desc(outreachSends.sentAt))
        .limit(50);
      const lastByBox = new Map<string, number>();
      for (const s of lastSends) {
        if (s.mailboxId && !lastByBox.has(s.mailboxId)) lastByBox.set(s.mailboxId, s.sentAt.getTime());
      }
      boxes.sort((a, b) => (lastByBox.get(a.id) ?? 0) - (lastByBox.get(b.id) ?? 0));
      return boxes[0] ?? null;
    },

    async getActiveLinkedInIdentity(accountId: string) {
      const [acct] = await db
        .select({ id: linkedinAccounts.id, providerRef: linkedinAccounts.providerRef, status: linkedinAccounts.status })
        .from(linkedinAccounts)
        .where(and(eq(linkedinAccounts.accountId, accountId), eq(linkedinAccounts.status, "active")))
        .limit(1);
      return acct ?? null;
    },

    async createUnsubscribeToken(accountId: string, leadId: string, email: string) {
      const [row] = await db
        .insert(unsubscribeTokens)
        .values({ accountId, leadId, email })
        .returning({ token: unsubscribeTokens.token });
      if (!row) throw new Error("failed to create unsubscribe token");
      return row.token;
    },

    async recordOutreachSend(rec: {
      accountId: string;
      campaignId: string;
      leadId: string;
      scheduledSendId: string;
      channel: "email" | "linkedin" | "imessage";
      mailboxId?: string;
      linkedinAccountId?: string;
      messageRef: string | null;
    }) {
      await db.insert(outreachSends).values({
        accountId: rec.accountId,
        campaignId: rec.campaignId,
        leadId: rec.leadId,
        scheduledSendId: rec.scheduledSendId,
        channel: rec.channel,
        mailboxId: rec.mailboxId,
        linkedinAccountId: rec.linkedinAccountId,
        messageRef: rec.messageRef,
      });
    },

    async setLeadInvited(leadId: string, at: Date) {
      await db.update(leads).set({ linkedinInvitedAt: at }).where(eq(leads.id, leadId));
    },

    // ── InboundStore ─────────────────────────────────────────────────────────

    async findMailboxByProviderRef(ref: string) {
      const [m] = await db
        .select({ id: mailboxes.id, accountId: mailboxes.accountId })
        .from(mailboxes)
        .where(eq(mailboxes.providerRef, ref));
      return m ?? null;
    },

    async findLinkedInAccountByProviderRef(ref: string) {
      const [a] = await db
        .select({ id: linkedinAccounts.id, accountId: linkedinAccounts.accountId })
        .from(linkedinAccounts)
        .where(eq(linkedinAccounts.providerRef, ref));
      return a ?? null;
    },

    async upsertLinkedInAccountStatus(e: {
      vanteraAccountId: string;
      providerRef: string;
      status: "active" | "disconnected";
      profileUrl: string | null;
      displayName: string | null;
    }) {
      await db
        .insert(linkedinAccounts)
        .values({
          accountId: e.vanteraAccountId,
          providerRef: e.providerRef,
          status: e.status,
          profileUrl: e.profileUrl,
          displayName: e.displayName,
          connectedAt: e.status === "active" ? new Date() : null,
        })
        .onConflictDoUpdate({
          target: [linkedinAccounts.accountId, linkedinAccounts.providerRef],
          set: {
            status: e.status,
            profileUrl: e.profileUrl,
            displayName: e.displayName,
            // reconnects restart the rule-04 ramp clock; disconnects keep the old value
            connectedAt: e.status === "active" ? new Date() : sql`${linkedinAccounts.connectedAt}`,
          },
        });
    },

    async findLeadByEmail(accountId: string, email: string) {
      // callers pass lowercased addresses; stored emails may be mixed-case
      const [lead] = await db
        .select({ id: leads.id })
        .from(leads)
        .where(and(eq(leads.accountId, accountId), sql`lower(${leads.email}) = ${email}`));
      if (!lead) return null;
      const [cl] = await db
        .select({ campaignId: campaignLeads.campaignId })
        .from(campaignLeads)
        .where(eq(campaignLeads.leadId, lead.id))
        .limit(1);
      return { id: lead.id, campaignId: cl?.campaignId ?? null };
    },

    async findLeadByLinkedInUrl(accountId: string, normalizedUrl: string) {
      // linkedin_url is stored as captured; normalize in JS over the account's leads.
      // revisit: normalized linkedin_url column if accounts exceed ~10k leads
      const rows = await db
        .select({ id: leads.id, linkedinUrl: leads.linkedinUrl })
        .from(leads)
        .where(eq(leads.accountId, accountId));
      const hit = rows.find((r) => r.linkedinUrl && normalizeLinkedInUrl(r.linkedinUrl) === normalizedUrl);
      if (!hit) return null;
      const [cl] = await db
        .select({ campaignId: campaignLeads.campaignId })
        .from(campaignLeads)
        .where(eq(campaignLeads.leadId, hit.id))
        .limit(1);
      return { id: hit.id, campaignId: cl?.campaignId ?? null };
    },

    async findLeadByPhone(accountId: string, normalizedPhone: string) {
      // Phone stored as-is; normalize both sides to match (E.164, lowercased, no spaces).
      const rows = await db
        .select({ id: leads.id, phone: leads.phone })
        .from(leads)
        .where(eq(leads.accountId, accountId));
      const hit = rows.find((r) => r.phone && normalizePhone(r.phone) === normalizedPhone);
      if (!hit) return null;
      const [cl] = await db
        .select({ campaignId: campaignLeads.campaignId })
        .from(campaignLeads)
        .where(eq(campaignLeads.leadId, hit.id))
        .limit(1);
      return { id: hit.id, campaignId: cl?.campaignId ?? null };
    },

    async insertReply(r: {
      accountId: string;
      leadId: string;
      campaignId: string | null;
      channel: "email" | "linkedin" | "imessage";
      providerMessageRef: string | null;
      body: string;
      receivedAt: Date;
    }) {
      const [row] = await db.insert(replies).values(r).returning({ id: replies.id });
      if (!row) throw new Error("failed to insert reply");
      return row.id;
    },

    async setReplyClassification(replyId: string, verdict: import("@vantera/agent-brains").ReplyVerdict) {
      await db
        .update(replies)
        .set({
          classification: verdict.classification as typeof replies.classification._.data,
          classificationRationale: verdict.rationale,
          classifiedAt: new Date(),
        })
        .where(eq(replies.id, replyId));
    },

    async addSuppression(
      accountId: string,
      kind: "email" | "linkedin" | "phone",
      value: string,
      source: "unsubscribe" | "bounce" | "complaint" | "not_interested",
      leadId?: string
    ) {
      await db
        .insert(suppressionEntries)
        .values({ accountId, kind, value, source, leadId })
        .onConflictDoNothing();
    },

    async pauseMailbox(mailboxId: string) {
      await db.update(mailboxes).set({ status: "paused" }).where(eq(mailboxes.id, mailboxId));
    },

    async updateMailboxWarmup(mailboxId: string, status: "warming" | "active", dailyCap: number) {
      await db.update(mailboxes).set({ status, dailySendLimit: dailyCap }).where(eq(mailboxes.id, mailboxId));
    },

    async setLeadConnected(leadId: string, at: Date) {
      await db.update(leads).set({ linkedinConnectedAt: at }).where(eq(leads.id, leadId));
    },

    async setLeadReplied(leadId: string, campaignId: string | null) {
      await db.update(leads).set({ status: "replied" }).where(eq(leads.id, leadId));
      if (campaignId) {
        await db
          .update(campaignLeads)
          .set({ status: "replied" })
          .where(and(eq(campaignLeads.campaignId, campaignId), eq(campaignLeads.leadId, leadId)));
      }
    },

    async cancelPendingSends(leadId: string) {
      const rows = await db
        .update(scheduledSends)
        .set({ status: "canceled", error: "lead replied or was suppressed" })
        .where(
          and(
            eq(scheduledSends.leadId, leadId),
            // "sending" is intentionally excluded — that provider call is already in flight
            inArray(scheduledSends.status, ["pending_review", "approved", "scheduled"])
          )
        )
        .returning({ id: scheduledSends.id });
      return rows.length;
    },

    // ── SequenceStore ──────────────────────────────────────────────────────────

    async getDueSequenceRuns(now: Date, limit: number): Promise<DueSequenceRun[]> {
      const rows = await db
        .select({
          id: sequenceRuns.id,
          accountId: sequenceRuns.accountId,
          campaignId: sequenceRuns.campaignId,
          leadId: sequenceRuns.leadId,
          status: sequenceRuns.status,
          currentStage: sequenceRuns.currentStage,
          touchesDone: sequenceRuns.touchesDone,
          callAttempts: sequenceRuns.callAttempts,
          nextActionAt: sequenceRuns.nextActionAt,
          enteredStageAt: sequenceRuns.enteredStageAt,
          linkedinUrl: leads.linkedinUrl,
          email: leads.email,
          emailStatus: leads.emailStatus,
          phone: leads.phone,
          phoneStatus: leads.phoneStatus,
          sequenceConfig: campaigns.sequenceConfig,
          accountPaused: accounts.outreachPaused,
        })
        .from(sequenceRuns)
        .innerJoin(
          leads,
          and(eq(leads.id, sequenceRuns.leadId), eq(leads.accountId, sequenceRuns.accountId))
        )
        .innerJoin(
          campaigns,
          and(eq(campaigns.id, sequenceRuns.campaignId), eq(campaigns.accountId, sequenceRuns.accountId))
        )
        .innerJoin(accounts, eq(accounts.id, sequenceRuns.accountId))
        .where(and(eq(sequenceRuns.status, "active"), lte(sequenceRuns.nextActionAt, now)))
        .orderBy(sequenceRuns.nextActionAt)
        .limit(limit);
      return rows.map((r) => ({
        run: {
          id: r.id,
          accountId: r.accountId,
          campaignId: r.campaignId,
          leadId: r.leadId,
          status: r.status,
          currentStage: r.currentStage,
          touchesDone: r.touchesDone,
          callAttempts: r.callAttempts,
          nextActionAt: r.nextActionAt,
          enteredStageAt: r.enteredStageAt,
        },
        channels: {
          linkedinUrl: r.linkedinUrl,
          email: r.email,
          emailStatus: r.emailStatus,
          phone: r.phone,
          phoneStatus: r.phoneStatus,
        },
        config: resolveSequenceConfig(
          (r.sequenceConfig ?? null) as Parameters<typeof resolveSequenceConfig>[0]
        ),
        accountPaused: r.accountPaused,
      }));
    },

    async suppressionFlags(accountId: string, ch: LeadChannels) {
      return {
        linkedin: ch.linkedinUrl
          ? await isSuppressedAnyKind(db, accountId, "linkedin", normalizeLinkedInUrl(ch.linkedinUrl))
          : false,
        email: ch.email
          ? await isSuppressedAnyKind(db, accountId, "email", ch.email.toLowerCase())
          : false,
        phone: ch.phone
          ? await isSuppressedAnyKind(db, accountId, "phone", normalizePhone(ch.phone))
          : false,
      };
    },

    async applyRunPatch(runId: string, expectNextActionAt: Date, patch: SequenceRunPatch): Promise<boolean> {
      const set: Partial<typeof sequenceRuns.$inferInsert> = { updatedAt: new Date() };
      if (patch.status !== undefined) set.status = patch.status;
      if (patch.currentStage !== undefined) set.currentStage = patch.currentStage;
      if (patch.touchesDone !== undefined) set.touchesDone = patch.touchesDone;
      if (patch.callAttempts !== undefined) set.callAttempts = patch.callAttempts;
      if (patch.nextActionAt !== undefined) set.nextActionAt = patch.nextActionAt;
      if (patch.enteredStageAt !== undefined) set.enteredStageAt = patch.enteredStageAt;
      if (patch.lastTouchAt !== undefined) set.lastTouchAt = patch.lastTouchAt;
      const rows = await db
        .update(sequenceRuns)
        .set(set)
        // optimistic claim: lose the row if another tick already moved it
        .where(
          and(
            eq(sequenceRuns.id, runId),
            eq(sequenceRuns.status, "active"),
            eq(sequenceRuns.nextActionAt, expectNextActionAt)
          )
        )
        .returning({ id: sequenceRuns.id });
      return rows.length > 0;
    },

    async archiveLead(leadId: string, campaignId: string): Promise<void> {
      await db.update(leads).set({ status: "archived" }).where(eq(leads.id, leadId));
      await db
        .update(campaignLeads)
        .set({ status: "completed" })
        .where(and(eq(campaignLeads.campaignId, campaignId), eq(campaignLeads.leadId, leadId)));
    },

    async enrollPendingLeads(now: Date): Promise<number> {
      // Enrol in_campaign leads that lack any sequence_runs row for their campaign.
      // The unique (campaign_id, lead_id) constraint + ON CONFLICT DO NOTHING keeps this idempotent.
      const selectQuery = db
        .select({
          accountId: campaignLeads.accountId,
          campaignId: campaignLeads.campaignId,
          leadId: campaignLeads.leadId,
          nextActionAt: sql<Date>`${now}`.as("next_action_at"),
        })
        .from(campaignLeads)
        .innerJoin(leads, eq(leads.id, campaignLeads.leadId))
        .where(
          and(
            eq(leads.status, "in_campaign"),
            sql`not exists (select 1 from ${sequenceRuns} sr where sr.campaign_id = ${campaignLeads.campaignId} and sr.lead_id = ${campaignLeads.leadId})`
          )
        );
      const rows = await db
        .insert(sequenceRuns)
        .select(selectQuery)
        .onConflictDoNothing({ target: [sequenceRuns.campaignId, sequenceRuns.leadId] })
        .returning({ id: sequenceRuns.id });
      return rows.length;
    },

    // ── ConversionStore ──────────────────────────────────────────────────────

    async resolveConversionToken(token: string) {
      const [row] = await db
        .select({
          accountId: conversionTokens.accountId,
          leadId: conversionTokens.leadId,
          campaignId: conversionTokens.campaignId,
          targetUrl: conversionTokens.targetUrl,
        })
        .from(conversionTokens)
        .where(eq(conversionTokens.token, token))
        .limit(1);
      return row ?? null;
    },

    async setLeadConverted(leadId: string) {
      await db.update(leads).set({ status: "converted" }).where(eq(leads.id, leadId));
    },

    async closeSequenceRun(campaignId: string, leadId: string) {
      await db
        .update(sequenceRuns)
        .set({ status: "converted" })
        .where(and(eq(sequenceRuns.campaignId, campaignId), eq(sequenceRuns.leadId, leadId)));
    },

    // Widened union satisfies both ConversionStore ("converted") and InboundStore ("reply");
    // lead_notifications.kind check (migration 0017) permits reply | converted | exhausted.
    async insertLeadNotification(n: {
      accountId: string;
      leadId: string;
      kind: "reply" | "converted" | "exhausted";
      body: string;
    }) {
      await db.insert(leadNotifications).values({
        accountId: n.accountId,
        leadId: n.leadId,
        kind: n.kind,
        body: n.body,
      });
    },

    // ── InboundStore (reply-pause gate) ──────────────────────────────────────

    async pauseSequenceForReply(leadId: string, stop: boolean) {
      await db
        .update(sequenceRuns)
        .set({ status: stop ? "stopped" : "paused_reply", updatedAt: new Date() })
        .where(and(eq(sequenceRuns.leadId, leadId), eq(sequenceRuns.status, "active")));
    },

    // ── RefreshLeadStore ──────────────────────────────────────────────────────

    async loadLeadForRefresh(accountId: string, leadId: string): Promise<RefreshLeadLoad | null> {
      // Join lead → its ICP → the account, so we can build icpDescription + candidate fields.
      const [row] = await db
        .select({
          externalRef: leads.externalRef,
          companyName: leads.companyName,
          companySize: leads.companySize,
          industry: leads.industry,
          location: leads.location,
          title: leads.title,
          icpName: icps.name,
          icpCriteria: icps.criteria,
          accountIndustry: accounts.onboardingIndustry,
        })
        .from(leads)
        .leftJoin(icps, eq(leads.icpId, icps.id))
        .innerJoin(accounts, eq(leads.accountId, accounts.id))
        .where(and(eq(leads.id, leadId), eq(leads.accountId, accountId)))
        .limit(1);
      if (!row) return null;

      // Resolve min_score from the live scout agent's config; fall back to SCOUT_DEFAULTS.minScore.
      const [scoutAgent] = await db
        .select({ config: agents.config })
        .from(agents)
        .where(and(eq(agents.accountId, accountId), eq(agents.kind, "scout"), eq(agents.status, "live")))
        .limit(1);
      const scoutConfig = (scoutAgent?.config ?? {}) as { min_score?: number; minScore?: number };
      const minScore = scoutConfig.min_score ?? scoutConfig.minScore ?? SCOUT_DEFAULTS.minScore;

      return {
        externalRef: row.externalRef ?? "",
        minScore,
        accountIndustry: row.accountIndustry,
        icpDescription: row.icpName
          ? `${row.icpName}: ${JSON.stringify(row.icpCriteria ?? {})}`
          : "",
        candidate: {
          companyName: row.companyName,
          companySize: row.companySize,
          industry: row.industry,
          location: row.location,
          title: row.title,
        },
      };
    },

    // ── TrialStore ───────────────────────────────────────────────────────────
    async getExpiredTrialAccounts(now: Date) {
      return db
        .select({ id: accounts.id })
        .from(accounts)
        .where(
          and(
            eq(accounts.subscriptionStatus, "trialing"),
            isNull(accounts.stripeSubscriptionId),
            lt(accounts.trialEndsAt, now)
          )
        );
    },

    async expireTrials(ids: string[]) {
      if (ids.length === 0) return 0;
      const rows = await db
        .update(accounts)
        .set({ plan: "none", subscriptionStatus: "none", outreachPaused: true })
        .where(inArray(accounts.id, ids))
        .returning({ id: accounts.id });
      return rows.length;
    },
  };
}

export interface DueScoutAgent {
  id: string;
  accountId: string;
  runAtTime: string | null;
  cadence: "daily" | "weekly" | null;
  timezone: string;
}

export interface SchedulerStore {
  getDueScoutAgents(now: Date): Promise<DueScoutAgent[]>;
  advanceSchedule(agentId: string, nextRunAt: Date): Promise<void>;
}

// ── CallerConfig helper ───────────────────────────────────────────────────────

function parseCallerConfig(raw: Record<string, unknown>): CallerConfig {
  const rawVoice = (raw["voice"] ?? {}) as Record<string, unknown>;
  const rawWindow = (raw["calling_window"] ?? {}) as Record<string, unknown>;
  return {
    cta: (raw["cta"] as string) ?? "",
    bookingLink: (raw["booking_link"] as string) ?? "",
    voice: {
      voiceId: (rawVoice["voice_id"] as string) ?? "",
      personaName: (rawVoice["persona_name"] as string) ?? "",
      language: (rawVoice["language"] as string) ?? "en-US",
    },
    recordingConsentMode: ((raw["recording_consent_mode"] as string) ?? "one_party") as "one_party" | "two_party",
    callingWindow: {
      days: (rawWindow["days"] as string[]) ?? ["mon", "tue", "wed", "thu", "fri"],
      startLocal: (rawWindow["start_local"] as string) ?? "09:00",
      endLocal: (rawWindow["end_local"] as string) ?? "17:00",
    },
    maxAttempts: (raw["max_attempts"] as number) ?? 3,
  };
}

// ── CallBriefStore ────────────────────────────────────────────────────────────

export function createCallBriefStore(db: Db): CallBriefStore {
  return {
    async getCallerContext(callerAgentId: string): Promise<CallerContext | null> {
      const [agent] = await db.select().from(agents).where(eq(agents.id, callerAgentId));
      if (!agent || agent.kind !== "caller") return null;
      const assets = await db
        .select({ kind: agentAssets.kind, url: agentAssets.url, filename: agentAssets.filename })
        .from(agentAssets)
        .where(eq(agentAssets.agentId, callerAgentId));
      const [account] = await db.select().from(accounts).where(eq(accounts.id, agent.accountId));
      if (!account) return null;
      const config = parseCallerConfig((agent.config ?? {}) as Record<string, unknown>);
      return {
        agent: {
          id: agent.id,
          accountId: agent.accountId,
          status: agent.status,
          campaignId: agent.campaignId,
          config,
        },
        assets,
        account: {
          industry: account.onboardingIndustry,
          websiteScan: account.websiteScan as CallerContext["account"]["websiteScan"],
        },
      };
    },

    async getCallableLeads(accountId: string, leadIds: string[]): Promise<CallableLead[]> {
      if (leadIds.length === 0) return [];
      const rows = await db
        .select()
        .from(leads)
        .where(and(eq(leads.accountId, accountId), inArray(leads.id, leadIds)));
      return rows.map((r) => ({
        id: r.id,
        firstName: r.firstName,
        lastName: r.lastName,
        title: r.title,
        companyName: r.companyName,
        industry: r.industry,
        phone: r.phone,
        phoneStatus: r.phoneStatus as "unvalidated" | "valid" | "invalid",
        aiInsights: r.aiInsights as CallableLead["aiInsights"],
      }));
    },

    async isSuppressed(accountId: string, kind: "phone", value: string): Promise<boolean> {
      const [hit] = await db
        .select({ id: suppressionEntries.id })
        .from(suppressionEntries)
        .where(
          and(
            eq(suppressionEntries.accountId, accountId),
            eq(suppressionEntries.kind, kind),
            eq(suppressionEntries.value, value)
          )
        )
        .limit(1);
      return Boolean(hit);
    },

    async ensureCampaignLead(campaignId: string, leadId: string, accountId: string): Promise<void> {
      await db
        .insert(campaignLeads)
        .values({ campaignId, leadId, accountId })
        .onConflictDoNothing();
    },

    async setCampaignLeadStatus(
      campaignId: string,
      leadId: string,
      status: "queued" | "suppressed" | "skipped"
    ): Promise<void> {
      await db
        .update(campaignLeads)
        .set({ status })
        .where(and(eq(campaignLeads.campaignId, campaignId), eq(campaignLeads.leadId, leadId)));
    },

    async insertScheduledSend(send: NewScheduledSend): Promise<void> {
      await db.insert(scheduledSends).values(toRow(send));
    },

    async setLeadStatus(leadId: string, status: "in_campaign"): Promise<void> {
      await db.update(leads).set({ status }).where(eq(leads.id, leadId));
    },
  };
}

// ── CallDispatchStore ─────────────────────────────────────────────────────────

export function createCallDispatchStore(db: Db): CallDispatchStore {
  return {
    async getApprovedCalls(): Promise<DispatchableCall[]> {
      // Load approved call rows joined to their lead and to the caller agent for the account.
      // leads has no timezone column; leadTimezone is always null (dispatch core falls back to UTC).
      const rows = await db
        .select({
          id: scheduledSends.id,
          accountId: scheduledSends.accountId,
          campaignId: scheduledSends.campaignId,
          leadId: scheduledSends.leadId,
          brief: scheduledSends.brief,
          phone: leads.phone,
          agentConfig: agents.config,
          agentId: agents.id,
        })
        .from(scheduledSends)
        .innerJoin(leads, eq(scheduledSends.leadId, leads.id))
        .innerJoin(
          agents,
          and(eq(agents.accountId, scheduledSends.accountId), eq(agents.kind, "caller"), eq(agents.status, "live"))
        )
        .where(
          and(eq(scheduledSends.channel, "call"), eq(scheduledSends.status, "approved"))
        );

      // Count attempts per scheduled send in a second query to avoid a complex lateral join.
      const sendIds = rows.map((r) => r.id);
      const attemptCounts =
        sendIds.length > 0
          ? await db
              .select({
                scheduledSendId: calls.scheduledSendId,
                n: count(calls.id),
              })
              .from(calls)
              .where(inArray(calls.scheduledSendId, sendIds))
              .groupBy(calls.scheduledSendId)
          : [];
      const attemptsBySend = new Map(attemptCounts.map((r) => [r.scheduledSendId, Number(r.n)]));

      return rows.map((r) => {
        const config = parseCallerConfig((r.agentConfig ?? {}) as Record<string, unknown>);
        return {
          id: r.id,
          accountId: r.accountId,
          campaignId: r.campaignId,
          agentId: r.agentId,
          leadId: r.leadId,
          brief: r.brief as DispatchableCall["brief"],
          phone: r.phone ?? "",
          config,
          attemptsSoFar: attemptsBySend.get(r.id) ?? 0,
          leadTimezone: null, // leads table has no timezone column; dispatch core falls back to UTC
        };
      });
    },

    async isKillSwitchOn(): Promise<boolean> {
      const [row] = await db.select().from(appSettings).where(eq(appSettings.key, "outreach_kill_switch"));
      return row?.value === true;
    },

    async isSuppressed(accountId: string, kind: "phone", value: string): Promise<boolean> {
      const [hit] = await db
        .select({ id: suppressionEntries.id })
        .from(suppressionEntries)
        .where(
          and(
            eq(suppressionEntries.accountId, accountId),
            eq(suppressionEntries.kind, kind),
            eq(suppressionEntries.value, value)
          )
        )
        .limit(1);
      return Boolean(hit);
    },

    async claimSending(sendId: string): Promise<boolean> {
      const rows = await db
        .update(scheduledSends)
        .set({ status: "sending" })
        .where(and(eq(scheduledSends.id, sendId), eq(scheduledSends.status, "approved")))
        .returning({ id: scheduledSends.id });
      return rows.length > 0;
    },

    async revertToApproved(sendId: string): Promise<void> {
      await db.update(scheduledSends).set({ status: "approved", scheduledFor: null }).where(eq(scheduledSends.id, sendId));
    },

    async markSuppressed(sendId: string): Promise<void> {
      await db.update(scheduledSends).set({ status: "suppressed" }).where(eq(scheduledSends.id, sendId));
    },

    async markSendSent(sendId: string): Promise<void> {
      await db.update(scheduledSends).set({ status: "sent" }).where(eq(scheduledSends.id, sendId));
    },

    async insertCall(c: {
      accountId: string;
      leadId: string;
      agentId: string;
      campaignId: string;
      scheduledSendId: string;
      providerCallId: string;
      attemptNo: number;
    }): Promise<void> {
      await db.insert(calls).values({
        accountId: c.accountId,
        leadId: c.leadId,
        agentId: c.agentId,
        campaignId: c.campaignId,
        scheduledSendId: c.scheduledSendId,
        providerCallId: c.providerCallId,
        attemptNo: c.attemptNo,
        status: "dialing",
        startedAt: new Date(),
      });
    },
  };
}

// ── VoiceInboundStore ─────────────────────────────────────────────────────────

export function createVoiceInboundStore(db: Db): VoiceInboundStore {
  return {
    async recordWebhookEvent(source: "voice", providerEventId: string, payload: unknown): Promise<boolean> {
      const rows = await db
        .insert(webhookEvents)
        .values({ source, providerEventId, payload: payload as Record<string, unknown> })
        .onConflictDoNothing()
        .returning({ id: webhookEvents.id });
      return rows.length > 0;
    },

    async findCallByProviderId(
      providerCallId: string
    ): Promise<{ id: string; accountId: string; leadId: string; phone: string | null } | null> {
      const [row] = await db
        .select({
          id: calls.id,
          accountId: calls.accountId,
          leadId: calls.leadId,
          phone: leads.phone,
        })
        .from(calls)
        .innerJoin(leads, eq(calls.leadId, leads.id))
        .where(eq(calls.providerCallId, providerCallId))
        .limit(1);
      return row ?? null;
    },

    async updateCallStarted(callId: string): Promise<void> {
      await db
        .update(calls)
        .set({ status: "in_progress", startedAt: new Date() })
        .where(eq(calls.id, callId));
    },

    async updateCallEnded(
      callId: string,
      e: {
        status: string;
        outcome: import("@vantera/agent-brains").CallOutcome;
        durationSec: number;
        recordingUrl: string | null;
        transcript: string | null;
      }
    ): Promise<void> {
      await db
        .update(calls)
        .set({
          status: e.status as typeof calls.status._.data,
          outcome: e.outcome as typeof calls.outcome._.data,
          durationSec: e.durationSec,
          recordingUrl: e.recordingUrl,
          transcript: e.transcript,
          endedAt: new Date(),
        })
        .where(eq(calls.id, callId));
    },

    async addSuppression(
      accountId: string,
      kind: "phone",
      value: string,
      source: "not_interested",
      leadId?: string
    ): Promise<void> {
      await db
        .insert(suppressionEntries)
        .values({ accountId, kind, value, source, leadId })
        .onConflictDoNothing();
    },
  };
}

// CRM push (Phase 9). Drizzle impl of the pure-core's injected store interface.
export function createCrmPushStore(db: Db): CrmPushStore {
  return {
    async loadEvent(id) {
      const [e] = await db.select().from(crmPushEvents).where(eq(crmPushEvents.id, id)).limit(1);
      if (!e) return null;
      return {
        id: e.id,
        accountId: e.accountId,
        connectionId: e.connectionId,
        leadId: e.leadId,
        status: e.status as "pending" | "success" | "failed",
        attempts: e.attempts,
        payload: (e.payload ?? null) as ClosedDeal | null,
      };
    },

    async loadConnection(id) {
      const [c] = await db.select().from(crmConnections).where(eq(crmConnections.id, id)).limit(1);
      if (!c) return null;
      return {
        id: c.id,
        provider: c.provider as CrmProvider,
        status: c.status,
        accessTokenEnc: c.accessTokenEnc,
        refreshTokenEnc: c.refreshTokenEnc,
        tokenExpiresAt: c.tokenExpiresAt ? c.tokenExpiresAt.toISOString() : null,
        externalAccountRef: c.externalAccountRef,
        config: (c.config ?? {}) as {
          target?: Record<string, string>;
          mapping?: Record<string, string>;
        },
      };
    },

    async saveRefreshedTokens(connectionId, t) {
      await db
        .update(crmConnections)
        .set({
          accessTokenEnc: t.accessTokenEnc,
          refreshTokenEnc: t.refreshTokenEnc,
          tokenExpiresAt: t.tokenExpiresAt ? new Date(t.tokenExpiresAt) : null,
        })
        .where(eq(crmConnections.id, connectionId));
    },

    async markSuccess(eventId, externalRef, connectionId, at) {
      await db
        .update(crmPushEvents)
        .set({
          status: "success",
          externalRef: externalRef ?? null,
          error: null,
          nextRetryAt: null,
          lastAttemptAt: new Date(at),
          attempts: sql`${crmPushEvents.attempts} + 1`,
        })
        .where(eq(crmPushEvents.id, eventId));
      if (connectionId) {
        await db
          .update(crmConnections)
          .set({ status: "active", lastError: null, lastSyncAt: new Date(at) })
          .where(eq(crmConnections.id, connectionId));
      }
    },

    async markFailure(a) {
      await db
        .update(crmPushEvents)
        .set({
          status: a.nextRetryAt ? "pending" : "failed",
          error: a.error,
          attempts: a.attempts,
          nextRetryAt: a.nextRetryAt ? new Date(a.nextRetryAt) : null,
          lastAttemptAt: new Date(),
        })
        .where(eq(crmPushEvents.id, a.eventId));
      if (a.connectionError && a.connectionId) {
        await db
          .update(crmConnections)
          .set({ status: "error", lastError: a.connectionError })
          .where(eq(crmConnections.id, a.connectionId));
      }
    },

    async dueEventIds(now, limit) {
      const rows = await db
        .select({ id: crmPushEvents.id })
        .from(crmPushEvents)
        .where(and(eq(crmPushEvents.status, "pending"), lte(crmPushEvents.nextRetryAt, now)))
        .limit(limit);
      return rows.map((r) => r.id);
    },
  };
}
