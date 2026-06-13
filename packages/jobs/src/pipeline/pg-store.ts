import { and, desc, eq, gte, inArray, isNull, lt, lte, or, sql } from "drizzle-orm";
import {
  accounts,
  agentAssets,
  agentIcps,
  agents,
  campaignLeads,
  campaigns,
  copilotConversations,
  enrichmentResults,
  icps,
  leads,
  linkedinAccounts,
  mailboxes,
  outreachSends,
  replies,
  scheduledSends,
  suppressionEntries,
  unsubscribeTokens,
  appSettings,
  webhookEvents,
  type Db,
} from "@vantera/db";
import type { EnrichedProspect, IcpCriteria, ProspectCandidate } from "@vantera/prospect-data";
import { toStoredInsights, type LeadInsights, type WebsiteScan } from "@vantera/agent-brains";
import type {
  CopyConfig,
  CopyContext,
  CopyDraftStore,
  DispatchableSend,
  DraftableLead,
  FreshLead,
  InboundStore,
  NewScheduledSend,
  OutreachSendStore,
  PurgeCandidate,
  RetentionStore,
  ScoutConfig,
  ScoutContext,
  ScoutStore,
  SendContext,
  SendDispatchStore,
} from "./types";
import { EMAIL_STEADY_DAILY_PER_MAILBOX } from "./safety-limits";
import { parseSenderAddress } from "./email-footer";
import { normalizeLinkedInUrl } from "./copy-draft";

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
    linkedinStage: send.linkedinStage,
    styleFlags: send.styleFlags,
  };
}

/** Drizzle-backed store used by the Trigger.dev tasks (service-role DATABASE_URL). */
export function createPgStore(db: Db): ScoutStore & CopyDraftStore & SchedulerStore & RetentionStore & SendDispatchStore & OutreachSendStore & InboundStore {
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
        },
      };
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

    async getLiveCopyAgent(accountId: string) {
      const [agent] = await db
        .select({ id: agents.id })
        .from(agents)
        .where(and(eq(agents.accountId, accountId), eq(agents.kind, "copy"), eq(agents.status, "live")));
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
        aiInsights: r.aiInsights as DraftableLead["aiInsights"],
      }));
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
        channel: r.channel as "email" | "linkedin",
        linkedinStage: r.linkedinStage as "invite" | "message" | null,
        status: r.status as "approved" | "scheduled",
        accountPaused: r.accountPaused,
        hasSenderAddress: parseSenderAddress(r.senderAddress) !== null,
        campaignStatus: r.campaignStatus,
        leadInvitedAt: r.leadInvitedAt,
        leadConnectedAt: r.leadConnectedAt,
      }));
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
          leadEmail: leads.email,
          leadLinkedinUrl: leads.linkedinUrl,
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
        channel: r.channel as "email" | "linkedin",
        linkedinStage: r.linkedinStage as "invite" | "message" | null,
        status: r.status,
        subject: r.subject,
        body: r.body,
        campaignStatus: r.campaignStatus,
        accountPaused: r.accountPaused,
        senderAddress: parseSenderAddress(r.senderAddress),
        lead: { email: r.leadEmail, linkedinUrl: r.leadLinkedinUrl },
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
      channel: "email" | "linkedin";
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

    async insertReply(r: {
      accountId: string;
      leadId: string;
      campaignId: string | null;
      channel: "email" | "linkedin";
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
      kind: "email" | "linkedin",
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
