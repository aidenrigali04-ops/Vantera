import { createHash } from "node:crypto";
import { and, asc, count, desc, eq, gt, gte, inArray, isNotNull, isNull, lt, lte, max, ne, or, sql } from "drizzle-orm";
import { LIFECYCLE_ADMIN_EMAIL } from "./lifecycle-outreach";
import { exemptFromTrialCaps, statusForTrialCaps } from "./trial-caps";
import {
  accountDeletionRequests,
  accountMembers,
  accounts,
  agentAssets,
  agentIcps,
  agentRuns,
  agents,
  campaignLeads,
  campaigns,
  conversionTokens,
  copilotConversations,
  crmConnections,
  crmContactRefs,
  crmPushEvents,
  enrichmentResults,
  icps,
  intentObservations,
  leadNotifications,
  leadEmbeddings,
  leadFeedback,
  leadSignals,
  leadStrategyStamps,
  meetingConnections,
  meetingEvents,
  leads,
  lifecycleTouches,
  linkedinAccounts,
  outreachSends,
  proofPoints,
  replies,
  nativeMessages,
  revealRuns,
  scheduledSends,
  sequenceRuns,
  suppressionEntries,
  appSettings,
  conversationDecisions,
  conversationPriors,
  conversationPriorsGlobal,
  conversationStates,
  userProfiles,
  webhookEvents,
  optimizationPlaybook,
  strategies,
  type Db,
} from "@vantera/db";
import type {
  EnrichedProspect,
  IcpCriteria,
  ProspectCandidate,
  ProspectSignal,
} from "@vantera/prospect-data";
import type {
  CopyStrategy,
  FunnelCohort,
  LeadOutcomeFlags,
  StrategyGenome,
  StrategySource,
  ConversationState,
  PriorCell,
} from "@vantera/agent-brains";
import {
  buildTargetingProfile,
  buildLeadOrdering,
  countRows,
  RANK_FEEDBACK_MAX,
  describeStrategy,
  buildReadout,
  lookalikeBucket,
  lookalikeCutpoints,
  profileText,
  LOOKALIKE_MIN_POSITIVES,
  orderLeads,
  pickWhyNow,
  toStoredInsights,
  genomeSignature,
  stripIdentity,
  replyPolarity,
  rollupCohort,
  type LeadInsights,
  type CountTable,
  type LeadOrdering,
  type LookalikeCutpoints,
  type LearnerFeatures,
  type LearnerRow,
  type ProofPoint,
  type WebsiteScan,
} from "@vantera/agent-brains";
import { resolveEntitlements, type EntitlementSnapshot } from "@vantera/billing";
import type { ClosedDeal, CrmProvider } from "@vantera/crm-infra";
import type { AccountDeletionStore } from "./account-deletion";
import type { TrialEndingAccount } from "./trial-ending";
import type { CrmPushStore } from "./crm-push";
import type {
  ActivityConnectionRow,
  CrmActivityStore,
  LeadActivityEvent,
} from "./crm-activity-sync";
import type { WeeklySummaryRow, WeeklySummaryStore } from "./weekly-summary";
import type { AccountHealthStore, LinkedInAccountRow } from "./account-health";
import type { ReplyBacklogStore } from "./reply-backlog";
import type { PullbackRow, PullbackSegment, PullbackTouch } from "./pullback";
import {
  SCOUT_DEFAULTS,
  type ConversionStore,
  type ConnectionSyncStore,
  type CopyConfig,
  type CopyContext,
  type AgentRunRecord,
  type AgentRunStore,
  type CopyDraftStore,
  type DispatchSender,
  type DispatchableSend,
  type DraftableLead,
  type DueSequenceRun,
  type FreshLead,
  type InboundStore,
  type LeadChannels,
  type LifecycleCandidate,
  type LifecycleConfig,
  type LifecycleDueTouch,
  type LifecycleStore,
  type NewScheduledSend,
  type OutreachSendStore,
  type PurgeCandidate,
  type ResponderBundle,
  type RetentionStore,
  type TrialStore,
  type IntentConfig,
  type IntentObservationRow,
  type IntentScanContext,
  type IntentScanStore,
  type ScoutConfig,
  type ScoutContext,
  type ScoutStore,
  type MeetingEventStore,
  type SendContext,
  type SendDispatchStore,
  type SequenceRunPatch,
  type SequenceStore,
  type SequenceTouchStore,
  type StrategyStampStore,
  type ConversationStore,
  type ConversationMode,
  type ScorableDecision,
} from "./types";
import { mergePriorTables, turnsFromRows } from "./conversation-store-pure";
import type { ThreadSyncStore } from "./thread-sync";
import { normalizeLinkedInUrl } from "./copy-draft";
import { stampEnteredLead } from "./stamp";
import { resolveSequenceConfig } from "./sequence-config";
import { aggregateSenderLoad } from "./sender-load";
import { STALE_TASK_MINUTES } from "./send-dispatch";
import type { RefreshLeadLoad, RefreshLeadStore } from "./refresh-lead";
import type { FastPassContext, FastPassStore, RevealRunPatch } from "./fast-pass";
import type { QualifyLeadLoad, QualifyLeadStore } from "./qualify-lead";

/**
 * Map a provider signal to a lead_signals row (0031). label falls back to detail, and the provider's
 * ISO observed_at becomes a Date (or null). Pure so the mapping is unit-tested without a DB.
 */
export function toLeadSignalRow(accountId: string, leadId: string, s: ProspectSignal) {
  return {
    accountId,
    leadId,
    kind: s.kind,
    label: s.label ?? s.detail,
    detail: s.detail,
    level: s.level,
    observedAt: s.observedAt ? new Date(s.observedAt) : null,
    source: "prospect-data" as const,
  };
}

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
    linkedinStage: send.linkedinStage,
    origin: send.origin ?? "sequence",
    styleFlags: send.styleFlags,
    recipe: send.recipe ?? null,
  };
}

/**
 * The account's most recent message openers — injected into draft prompts as "do not reuse" and
 * (as skeletons, see openerSkeletons in @vantera/agent-brains) enforced in code, so a batch of
 * drafts can't converge on one scaffold (69% of sends had shared the same opener before 0044;
 * AI-detectable templating is the category's #1 churn driver). Never used as grounding.
 *
 * Copy-quality fix (2026-10-21): reads QUEUED drafts too (pending_review/approved — the template
 * was repeating inside the review queue before anything sent), keeps a separate budget per
 * linkedin_stage (invites no longer crowd follow-ups out of a mixed 10-row window), and strips the
 * prospect's name/company from each opener so a rename can't satisfy "don't reuse".
 */
const AVOID_PHRASES_LIMIT = 10;
const AVOID_OPENER_STATUSES = ["sent", "pending_review", "approved"] as const;
const AVOID_OPENER_STAGES = ["message", "invite"] as const;
export async function recentSendOpeners(db: Db, accountId: string): Promise<string[]> {
  const perStage = await Promise.all(
    AVOID_OPENER_STAGES.map((stage) =>
      db
        .select({
          body: scheduledSends.body,
          firstName: leads.firstName,
          lastName: leads.lastName,
          companyName: leads.companyName,
        })
        .from(scheduledSends)
        .leftJoin(leads, eq(leads.id, scheduledSends.leadId))
        .where(
          and(
            eq(scheduledSends.accountId, accountId),
            inArray(scheduledSends.status, [...AVOID_OPENER_STATUSES]),
            eq(scheduledSends.linkedinStage, stage),
            isNotNull(scheduledSends.body)
          )
        )
        .orderBy(desc(scheduledSends.updatedAt))
        .limit(AVOID_PHRASES_LIMIT)
    )
  );
  const seen = new Set<string>();
  const out: string[] = [];
  for (const rows of perStage) {
    for (const r of rows) {
      const identity = [r.firstName, r.lastName, r.companyName].filter(Boolean).join(" ");
      const opener = stripIdentity((r.body ?? "").split("\n")[0]!, identity).slice(0, 90).trim();
      if (opener.length < 12 || seen.has(opener.toLowerCase())) continue;
      seen.add(opener.toLowerCase());
      out.push(opener);
    }
  }
  return out;
}

/**
 * Vera's positive memory (Stage 0.5) — openers from THIS account that earned an interested reply,
 * DERIVED at read time (no stored snapshot): leads with an interested reply, joined to each lead's
 * earliest sent scheduled_send body, newest wins first. Same first-line/70-char clip as the avoid
 * list so exemplars stay guides for angle, never full copy material. Per-account only (prospect-
 * facing text never crosses tenants); prompt-only downstream (see exemplarBlock in agent-brains).
 */
const WINNING_OPENERS_LIMIT = 3;
async function winningOpeners(db: Db, accountId: string): Promise<string[]> {
  const rows = await db
    .select({
      leadId: scheduledSends.leadId,
      body: scheduledSends.body,
      sentOrder: scheduledSends.createdAt,
      wonAt: replies.receivedAt,
    })
    .from(scheduledSends)
    .innerJoin(replies, eq(replies.leadId, scheduledSends.leadId))
    .where(
      and(
        eq(scheduledSends.accountId, accountId),
        eq(scheduledSends.status, "sent"),
        isNotNull(scheduledSends.body),
        eq(replies.classification, "interested")
      )
    )
    .orderBy(desc(replies.receivedAt), scheduledSends.createdAt)
    .limit(40); // small scan window; reduced to ≤3 exemplars below
  const seenLead = new Set<string>();
  const seenOpener = new Set<string>();
  const out: string[] = [];
  for (const r of rows) {
    if (!r.leadId || seenLead.has(r.leadId)) continue; // earliest send per lead (ordered asc within lead)
    seenLead.add(r.leadId);
    const opener = (r.body ?? "").split("\n")[0]!.slice(0, 70).trim();
    if (opener.length < 12 || seenOpener.has(opener.toLowerCase())) continue;
    seenOpener.add(opener.toLowerCase());
    out.push(opener);
    if (out.length >= WINNING_OPENERS_LIMIT) break;
  }
  return out;
}

/**
 * Stage 2 targeting evidence: every INVITED lead's segment fields + outcome flags, derived at
 * read time (no stored profile). Feeds both the discovery allocator (per-ICP) and the qualified-
 * pool drain tilt (per-segment). Per-account only.
 */
/** Days an invite needs before its outcome is observable (accept → reply lag). Younger invites are
 *  right-censored, not failures — counting them as misses biased the ICP allocator + tilt against
 *  every newly-targeted segment. */
export const OUTCOME_MATURATION_DAYS = 14;

async function invitedOutcomeRows(
  db: Db,
  accountId: string
): Promise<{ icpId: string | null; title: string | null; industry: string | null; flags: LeadOutcomeFlags }[]> {
  const rows = await db
    .select({
      id: leads.id,
      icpId: leads.icpId,
      title: leads.title,
      industry: leads.industry,
      invitedAt: leads.linkedinInvitedAt,
      connectedAt: leads.linkedinConnectedAt,
      bookedAt: leads.meetingBookedAt,
      status: leads.status,
    })
    .from(leads)
    .where(
      and(
        eq(leads.accountId, accountId),
        isNotNull(leads.linkedinInvitedAt),
        lte(leads.linkedinInvitedAt, new Date(Date.now() - OUTCOME_MATURATION_DAYS * 86_400_000))
      )
    );
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const replyRows = await db
    .select({ leadId: replies.leadId, classification: replies.classification })
    .from(replies)
    .where(inArray(replies.leadId, ids));
  const interested = new Set<string>();
  const negative = new Set<string>();
  for (const r of replyRows) {
    if (r.classification === "interested") interested.add(r.leadId);
    else if (r.classification === "not_interested" || r.classification === "unsubscribe")
      negative.add(r.leadId);
  }
  return rows.map((r) => ({
    icpId: r.icpId,
    title: r.title,
    industry: r.industry,
    flags: {
      invited: true,
      accepted: r.connectedAt != null,
      interested: interested.has(r.id),
      negative: negative.has(r.id),
      booked: r.bookedAt != null,
      converted: r.status === "converted",
    },
  }));
}

/** ML-4: leads the user marked "Not a fit" never get drafted (reversible — flip the verdict). The
 *  outer lead id is written qualified (see learnerFeatureCols on drizzle's bare-"id" rendering). */
export const notMarkedNotFit = sql`not exists (select 1 from ${leadFeedback} f where f.lead_id = "leads"."id" and f.verdict = 'not_fit')`;

/** Newest-first union of exemplar lists, deduped by line, capped — the revealed-preferences merge. */
export function mergeExemplars(lists: { line: string; at: Date }[][], max: number): string[] {
  const newest = new Map<string, number>();
  for (const list of lists) for (const { line, at } of list) newest.set(line, Math.max(newest.get(line) ?? 0, at.getTime()));
  return [...newest.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([line]) => line);
}

/** ML-1 learner window: matured invites from the last LEARNER_LOOKBACK_DAYS. */
const LEARNER_LOOKBACK_DAYS = 180;
/** Bound on the cross-account pool read per ordering (counts only ever leave the store). */
const LEARNER_POOL_LIMIT = 50_000;

/** Learner features computed in SQL: buying-signal kinds + intent level off lead_signals. The outer
 *  lead id is written fully qualified: in a select list drizzle renders ${leads.id} as a bare "id",
 *  which inside these subqueries would bind to lead_signals.id / replies.id instead. */
export const learnerFeatureCols = {
  source: leads.source,
  title: leads.title,
  industry: leads.industry,
  companySize: leads.companySize,
  aiScore: leads.aiScore,
  signals: sql<string[] | null>`(select array_agg(distinct ls.kind) from ${leadSignals} ls where ls.lead_id = "leads"."id")`,
  intentLevel: sql<string | null>`(select max(ls.level) from ${leadSignals} ls where ls.lead_id = "leads"."id" and ls.kind = 'intent')`,
};

const toFeatures = (r: {
  source: string;
  title: string | null;
  industry: string | null;
  companySize: string | null;
  aiScore: number | null;
  signals: string[] | null;
  intentLevel: string | null;
}): LearnerFeatures => ({
  source: r.source,
  title: r.title,
  industry: r.industry,
  companySize: r.companySize,
  aiScore: r.aiScore,
  signals: r.signals ?? [],
  intentLevel: r.intentLevel,
});

/**
 * Matured invites as learner training rows — one account, or the cross-account pool excluding
 * one account (so the hierarchical model never counts the account's own rows twice). Positive =
 * an interested reply or a booked meeting.
 */
async function learnerTrainingRows(
  db: Db,
  scope: { accountId: string } | { excludeAccountId: string }
): Promise<(LearnerRow & { id: string })[]> {
  const now = Date.now();
  const rows = await db
    .select({
      id: leads.id,
      ...learnerFeatureCols,
      accepted: sql<boolean>`${leads.linkedinConnectedAt} is not null`,
      booked: sql<boolean>`${leads.meetingBookedAt} is not null`,
      interested: sql<boolean>`exists (select 1 from ${replies} r where r.lead_id = "leads"."id" and r.classification = 'interested')`,
    })
    .from(leads)
    .where(
      and(
        "accountId" in scope ? eq(leads.accountId, scope.accountId) : ne(leads.accountId, scope.excludeAccountId),
        isNotNull(leads.linkedinInvitedAt),
        lte(leads.linkedinInvitedAt, new Date(now - OUTCOME_MATURATION_DAYS * 86_400_000)),
        gte(leads.linkedinInvitedAt, new Date(now - LEARNER_LOOKBACK_DAYS * 86_400_000))
      )
    )
    .limit(LEARNER_POOL_LIMIT);
  return rows.map((r) => ({
    id: r.id,
    ...toFeatures(r),
    flags: {
      invited: true,
      accepted: r.accepted,
      interested: r.interested,
      negative: false,
      booked: r.booked,
      converted: false,
    },
  }));
}

/**
 * ML-7: cosine similarity of each lead to the account's OWN positive leads (interested reply,
 * booked, closed, or marked a good fit), leave-one-out — a positive never matches itself. Every
 * join is pinned to `accountId`: similarity never crosses tenants. Empty until the account has
 * LOOKALIKE_MIN_POSITIVES embedded positives.
 */
export async function lookalikeSims(db: Db, accountId: string, leadIds: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (leadIds.length === 0) return out;
  const rows = (await db.execute(sql`
    with pos as (
      select e.lead_id, e.embedding
      from ${leadEmbeddings} e
      join ${leads} l on l.id = e.lead_id and l.account_id = e.account_id
      where e.account_id = ${accountId}
        and (l.meeting_booked_at is not null or l.status = 'converted'
          or exists (select 1 from ${replies} r where r.lead_id = l.id and r.classification = 'interested')
          or exists (select 1 from ${leadFeedback} f where f.lead_id = l.id and f.account_id = l.account_id and f.verdict = 'good_fit'))
    )
    select e.lead_id as lead_id,
      (select max(1 - (p.embedding <=> e.embedding)) from pos p where p.lead_id <> e.lead_id) as sim,
      (select count(*) from pos) as npos
    from ${leadEmbeddings} e
    where e.account_id = ${accountId}
      and e.lead_id in (${sql.join(leadIds.map((id) => sql`${id}`), sql`, `)})
  `)) as unknown as { lead_id: string; sim: number | string | null; npos: number | string }[];
  for (const r of rows) {
    if (Number(r.npos) < LOOKALIKE_MIN_POSITIVES || r.sim == null) continue;
    out.set(r.lead_id, Number(r.sim));
  }
  return out;
}

/** Attach the lookalike bucket to candidate rows using the account's training cutpoints. */
async function withLookalike<T extends { id: string }>(db: Db, accountId: string, rows: T[], cut: LookalikeCutpoints | null) {
  if (!cut || rows.length === 0) return rows;
  const sims = await lookalikeSims(db, accountId, rows.map((r) => r.id));
  return rows.map((r) => ({ ...r, lookalike: lookalikeBucket(sims.get(r.id), cut) }));
}

/** The account's lead ordering (the ML-1 learner when it has evidence, else ML-0's tilt) plus the
 *  account's OWN counts — the only input allowed into anything displayed (ML-2) — and the ML-7
 *  lookalike cutpoints (from the account's own training similarities) for bucketing candidates. */
async function leadOrdering(
  db: Db,
  accountId: string
): Promise<{ ordering: LeadOrdering; own: CountTable; cut: LookalikeCutpoints | null }> {
  const [trainingRows, pool, tilt] = await Promise.all([
    learnerTrainingRows(db, { accountId }),
    learnerTrainingRows(db, { excludeAccountId: accountId }),
    invitedOutcomeRows(db, accountId),
  ]);
  const sims = await lookalikeSims(db, accountId, trainingRows.map((r) => r.id));
  const cut = lookalikeCutpoints([...sims.values()]);
  const ownRows = trainingRows.map((r) => ({ ...r, lookalike: lookalikeBucket(sims.get(r.id), cut) }));
  const own = countRows(ownRows);
  const ordering = buildLeadOrdering(
    own,
    countRows(pool),
    tilt.map((r) => ({ title: r.title, industry: r.industry, flags: r.flags }))
  );
  return { ordering, own, cut };
}

/** The account's citable proof/pricing/FAQ facts (0046), oldest-sort first — fed into the responder
 *  grounding so the brain can answer "prove it / what's the price" truthfully (never in a first touch). */
async function loadProofPoints(db: Db, accountId: string): Promise<ProofPoint[]> {
  const rows = await db
    .select({ kind: proofPoints.kind, text: proofPoints.text, question: proofPoints.question })
    .from(proofPoints)
    .where(eq(proofPoints.accountId, accountId))
    .orderBy(asc(proofPoints.sort), asc(proofPoints.createdAt));
  return rows.map((r) => ({ kind: r.kind, text: r.text, question: r.question }));
}

/** The account's playbook champion strategy + version; {strategy:{}, version:null} when no
 *  playbook exists yet. A plain function so getResponderBundle can call it directly — this
 *  file's object-literal store never references sibling methods via `this`. */
async function fetchChampion(
  db: Db,
  accountId: string
): Promise<{ strategy: CopyStrategy; version: number | null }> {
  const [row] = await db
    .select({
      championStrategy: optimizationPlaybook.championStrategy,
      version: optimizationPlaybook.version,
    })
    .from(optimizationPlaybook)
    .where(eq(optimizationPlaybook.accountId, accountId))
    .limit(1);
  return {
    strategy: (row?.championStrategy ?? {}) as CopyStrategy,
    version: row?.version ?? null,
  };
}

/** Drizzle-backed store used by the Trigger.dev tasks (service-role DATABASE_URL). */
export function createPgStore(db: Db): ScoutStore & CopyDraftStore & SchedulerStore & RetentionStore & TrialStore & SendDispatchStore & OutreachSendStore & InboundStore & SequenceStore & SequenceTouchStore & ConversionStore & RefreshLeadStore & QualifyLeadStore & IntentScanStore & ConnectionSyncStore & AgentRunStore & FastPassStore & StrategyStampStore & MeetingEventStore {
  async function upsertStrategy(accountId: string, genome: StrategyGenome, source: StrategySource): Promise<string> {
    const signature = genomeSignature(genome);
    const [row] = await db
      .insert(strategies)
      .values({ accountId, signature, genome, source })
      .onConflictDoUpdate({
        target: [strategies.accountId, strategies.signature],
        set: { signature: sql`${strategies.signature}` },
      })
      .returning({ id: strategies.id });
    return row!.id;
  }

  async function hasStrategyStamp(accountId: string, leadId: string): Promise<boolean> {
    const [row] = await db
      .select({ id: leadStrategyStamps.id })
      .from(leadStrategyStamps)
      .where(and(eq(leadStrategyStamps.accountId, accountId), eq(leadStrategyStamps.leadId, leadId)))
      .limit(1);
    return Boolean(row);
  }

  async function stampLead(
    accountId: string,
    leadId: string,
    strategyId: string,
    opts?: { experimentId?: string | null; arm?: "champion" | "challenger" | null }
  ): Promise<void> {
    await db
      .insert(leadStrategyStamps)
      .values({
        accountId,
        leadId,
        strategyId,
        experimentId: opts?.experimentId ?? null,
        arm: opts?.arm ?? null,
      })
      .onConflictDoNothing({ target: leadStrategyStamps.leadId });
  }

  async function recordStrategyStamp(accountId: string, leadId: string): Promise<void> {
    await stampEnteredLead(
      { upsertStrategy, hasStamp: hasStrategyStamp, stampLead },
      { accountId, leadId }
    );
  }

  async function accountExemptFromTrialCaps(accountId: string): Promise<boolean> {
    const rows = await db.execute<{ email: string | null }>(sql`
      select u.email
      from public.account_members m
      join auth.users u on u.id = m.user_id
      where m.account_id = ${accountId}
        and m.role in ('owner', 'admin')
    `);
    return exemptFromTrialCaps(rows.map((r) => r.email).filter((e): e is string => Boolean(e)));
  }

  // ML-1 ordering is a cross-account read — computed once per account per store (a store lives for
  // one task run), shared by the drain, the slot ranking, and the run-summary readout.
  const orderingCache = new Map<string, Promise<{ ordering: LeadOrdering; own: CountTable; cut: LookalikeCutpoints | null }>>();
  const orderingFor = (accountId: string) => {
    let cached = orderingCache.get(accountId);
    if (!cached) {
      cached = leadOrdering(db, accountId);
      cached.catch(() => orderingCache.delete(accountId));
      orderingCache.set(accountId, cached);
    }
    return cached;
  };
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
          trialCapsExempt: await accountExemptFromTrialCaps(agent.accountId),
          // features.intent (Growth/Scale) — billing is the single source of truth (Phase 15)
          intentEnabled: resolveEntitlements({
            plan: account.plan as EntitlementSnapshot["plan"],
            subscriptionStatus: account.subscriptionStatus as EntitlementSnapshot["subscriptionStatus"],
            seatsPurchased: 0,
            linkedinAccountsPurchased: 0,
            currentPeriodEnd: null,
          }).features.intent,
        },
      };
    },

    // ── Fast pass (journey v2 — the pre-payment Reveal scan) ───────────────
    async getFastPassContext(accountId: string): Promise<FastPassContext | null> {
      const [account] = await db.select().from(accounts).where(eq(accounts.id, accountId));
      if (!account) return null;
      // agent-less: the onboarding ICP rows are the targeting source pre-payment
      const icpRows = await db
        .select({ id: icps.id, name: icps.name, criteria: icps.criteria })
        .from(icps)
        .where(and(eq(icps.accountId, accountId), eq(icps.source, "onboarding")));
      return {
        icps: icpRows.map((r) => ({ id: r.id, name: r.name, criteria: (r.criteria ?? {}) as IcpCriteria })),
        account: {
          industry: account.onboardingIndustry,
          websiteUrl: account.websiteUrl,
          websiteScan: account.websiteScan as ScoutContext["account"]["websiteScan"],
          websiteScannedAt: account.websiteScannedAt,
          subscriptionStatus: account.subscriptionStatus,
          intentEnabled: false, // company-event signals never run in the fast pass
        },
      };
    },

    async updateRevealRun(revealRunId: string, patch: RevealRunPatch): Promise<void> {
      await db
        .update(revealRuns)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(revealRuns.id, revealRunId));
    },

    async saveIcpCriteria(icpId: string, criteria: IcpCriteria) {
      await db.update(icps).set({ criteria }).where(eq(icps.id, icpId));
    },

    // ── Intent Agent (Phase 13) ────────────────────────────────────────────
    async getIntentContext(agentId: string): Promise<IntentScanContext | null> {
      const [agent] = await db.select().from(agents).where(eq(agents.id, agentId));
      if (!agent || agent.kind !== "intent") return null;
      const [account] = await db.select().from(accounts).where(eq(accounts.id, agent.accountId));
      if (!account) return null;
      // read through the account's active LinkedIn connection (null = can't read this run)
      const [li] = await db
        .select({ ref: linkedinAccounts.providerRef })
        .from(linkedinAccounts)
        .where(and(eq(linkedinAccounts.accountId, agent.accountId), eq(linkedinAccounts.status, "active")))
        .limit(1);
      // qualification ICP is inherited from the account's Scout (rule 06 — the same bar)
      const [scout] = await db
        .select({ id: agents.id, config: agents.config })
        .from(agents)
        .where(and(eq(agents.accountId, agent.accountId), eq(agents.kind, "scout")))
        .limit(1);
      const icpRows = scout
        ? await db
            .select({ id: icps.id, name: icps.name, criteria: icps.criteria, position: agentIcps.position })
            .from(agentIcps)
            .innerJoin(icps, eq(agentIcps.icpId, icps.id))
            .where(eq(agentIcps.agentId, scout.id))
        : [];
      const scan = account.websiteScan as (WebsiteScan & { url?: string }) | null;
      return {
        agent: {
          id: agent.id,
          accountId: agent.accountId,
          status: agent.status,
          config: (agent.config ?? {}) as Partial<IntentConfig>,
          cadence: agent.cadence,
        },
        connectedAccountId: li?.ref ?? null,
        icps: icpRows
          .sort((a, b) => a.position - b.position)
          .map((r) => ({ id: r.id, name: r.name, criteria: (r.criteria ?? {}) as IcpCriteria })),
        account: {
          industry: account.onboardingIndustry,
          valueProp: scan ? `${scan.summary} Value props: ${scan.value_props.join("; ")}` : null,
          subscriptionStatus: account.subscriptionStatus,
        },
        // ML-5: exclusions + guidance live on the Scout and govern intent leads too
        targeting: (scout?.config as { targeting?: unknown } | null)?.targeting,
      };
    },

    async seenObservationKeys(accountId, refs) {
      if (refs.length === 0) return new Set<string>();
      const profileUrls = [...new Set(refs.map((r) => r.profileUrl))];
      const rows = await db
        .select({ profileUrl: intentObservations.profileUrl, postRef: intentObservations.postRef })
        .from(intentObservations)
        .where(and(eq(intentObservations.accountId, accountId), inArray(intentObservations.profileUrl, profileUrls)));
      return new Set(rows.map((r) => `${r.profileUrl}|${r.postRef}`));
    },

    async recordObservations(accountId, agentId, rows) {
      if (rows.length === 0) return;
      await db
        .insert(intentObservations)
        .values(
          rows.map((r) => ({
            accountId,
            agentId,
            leadId: r.leadId,
            profileUrl: r.profileUrl,
            signalKind: r.signalKind,
            watchTarget: r.watchTarget,
            postRef: r.postRef,
            headline: r.headline,
            detail: r.detail,
            outcome: r.outcome,
          }))
        )
        .onConflictDoNothing();
    },

    async upsertIntentLead(accountId, candidate, icpId) {
      const [existing] = await db
        .select({ id: leads.id })
        .from(leads)
        .where(and(eq(leads.accountId, accountId), eq(leads.externalRef, candidate.externalRef)))
        .limit(1);
      if (existing) return { leadId: existing.id };
      const [inserted] = await db
        .insert(leads)
        .values({
          accountId,
          source: "intent",
          externalRef: candidate.externalRef,
          companyName: candidate.companyName,
          companySize: candidate.companySize,
          industry: candidate.industry,
          location: candidate.location,
          firstName: candidate.firstName,
          lastName: candidate.lastName,
          title: candidate.title,
          linkedinUrl: candidate.linkedinUrl,
          ...(icpId ? { icpId } : {}),
        })
        .returning({ id: leads.id });
      if (inserted) await recordStrategyStamp(accountId, inserted.id);
      return { leadId: inserted!.id };
    },

    async saveIntentSignal(leadId, accountId, signal) {
      await db
        .insert(leadSignals)
        .values({
          accountId,
          leadId,
          kind: signal.kind ?? "intent",
          label: signal.label,
          detail: signal.detail,
          // the classifier's verdict level (high | medium) — an ML-1 learner feature
          level: signal.level ?? "active",
          observedAt: new Date(),
          source: "prospect-data",
        })
        .onConflictDoNothing();
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
        if (inserted) {
          await recordStrategyStamp(accountId, inserted.id);
          fresh.push({ leadId: inserted.id, icpId, candidate });
        }
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
      // Only persist fields the provider actually returned. Drizzle throws "No values to set" on
      // an all-undefined .set(), which happens whenever bulk_enrich finds no email/phone/tech for
      // a prospect (common) — so guard the UPDATE and skip it when there is nothing to write.
      const patch = {
        ...(enriched.email !== undefined ? { email: enriched.email } : {}),
        ...(enriched.emailStatus !== undefined ? { emailStatus: enriched.emailStatus } : {}),
        ...(enriched.phone !== undefined ? { phone: enriched.phone } : {}),
        ...(enriched.phoneStatus !== undefined ? { phoneStatus: enriched.phoneStatus } : {}),
        ...(enriched.linkedinUrl !== undefined ? { linkedinUrl: enriched.linkedinUrl } : {}),
        ...(enriched.technographics !== undefined ? { techStack: enriched.technographics } : {}),
        // firmographics from the business enrichment — without these the AI rank can't confirm
        // ICP fit and caps the score (rule 06).
        ...(enriched.industry !== undefined ? { industry: enriched.industry } : {}),
        ...(enriched.companySize !== undefined ? { companySize: enriched.companySize } : {}),
      };
      if (Object.keys(patch).length > 0) {
        await db.update(leads).set(patch).where(eq(leads.id, leadId));
      }
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
      // Real buying signals (events + intent) → lead_signals, the "why now" feed + attribution
      // source (0031). label falls back to detail; re-observing the same signal is idempotent
      // (unique lead_id,kind,label → onConflictDoNothing). Skipped silently when none were found.
      if (enriched.signals && enriched.signals.length > 0) {
        await db
          .insert(leadSignals)
          .values(enriched.signals.map((s) => toLeadSignalRow(accountId, leadId, s)))
          .onConflictDoNothing();
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

    async notifyHotSignals(accountId: string, items: { leadId: string; label: string }[]) {
      if (items.length === 0) return;
      await db.insert(leadNotifications).values(
        items.map((it) => ({
          accountId,
          leadId: it.leadId,
          kind: "hot_signal" as const,
          body: it.label,
        }))
      );
    },

    async completeRun(agentId: string, lastRunAt: Date) {
      await db.update(agents).set({ lastRunAt }).where(eq(agents.id, agentId));
    },

    async getOutreachCapacity(accountId: string) {
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
      const channels = (copy?.config as { channels?: { linkedin?: boolean } } | null)
        ?.channels;

      const now = Date.now();
      return {
        linkedinConnected: Boolean(li),
        linkedinAccountAgeDays: li?.connectedAt
          ? Math.floor((now - li.connectedAt.getTime()) / 86_400_000)
          : null,
        linkedinEnabled: channels?.linkedin ?? Boolean(li),
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

    async countQualifiedPool(accountId: string) {
      const [row] = await db
        .select({ n: count() })
        .from(leads)
        .where(and(eq(leads.accountId, accountId), eq(leads.status, "qualified")));
      return row?.n ?? 0;
    },

    async getTopQualifiedLeadIds(accountId: string, limit: number) {
      if (limit <= 0) return [];
      // qualified, not-yet-drafted leads (drafting flips status to 'in_campaign'), best first.
      // ML-1: ordered by the outcome learner's predicted positive-reply rate once it has evidence,
      // else by ai_score + the bounded ML-0 tilt. Ordering ONLY — the qualification gate and the
      // draft budget are unchanged.
      const rows = await db
        .select({ id: leads.id, ...learnerFeatureCols })
        .from(leads)
        .where(and(eq(leads.accountId, accountId), eq(leads.status, "qualified"), notMarkedNotFit))
        .orderBy(desc(leads.aiScore), desc(leads.scoredAt));
      const { ordering, cut } = await orderingFor(accountId);
      return orderLeads(
        await withLookalike(db, accountId, rows.map((r) => ({ id: r.id, ...toFeatures(r) })), cut),
        ordering
      )
        .slice(0, limit)
        .map((r) => r.id);
    },

    async rankLeadIds(accountId: string, leadIds: string[]) {
      if (leadIds.length <= 1) return leadIds;
      const rows = await db
        .select({ id: leads.id, ...learnerFeatureCols })
        .from(leads)
        .where(and(eq(leads.accountId, accountId), inArray(leads.id, leadIds)));
      const { ordering, cut } = await orderingFor(accountId);
      const ordered = orderLeads(
        await withLookalike(db, accountId, rows.map((r) => ({ id: r.id, ...toFeatures(r) })), cut),
        ordering
      ).map((r) => r.id);
      const seen = new Set(ordered);
      return [...ordered, ...leadIds.filter((id) => !seen.has(id))];
    },

    async getIcpOutcomeRows(accountId: string) {
      return (await invitedOutcomeRows(db, accountId))
        .filter((r): r is typeof r & { icpId: string } => r.icpId != null)
        .map((r) => ({ icpId: r.icpId, flags: r.flags }));
    },

    async getLearnedInsights(accountId: string) {
      // persisted to agent_runs (web-readable) → built from the account's OWN outcomes only
      const { ordering, own } = await orderingFor(accountId);
      return { mode: ordering.kind, ...buildReadout(own) };
    },

    async getLeadsToEmbed(accountId: string, limit: number) {
      // qualified/contacted leads whose profile text changed or was never embedded
      const rows = await db
        .select({
          id: leads.id,
          title: leads.title,
          companyName: leads.companyName,
          industry: leads.industry,
          companySize: leads.companySize,
          location: leads.location,
          aiInsights: leads.aiInsights,
          existingHash: leadEmbeddings.sourceHash,
        })
        .from(leads)
        .leftJoin(leadEmbeddings, and(eq(leadEmbeddings.leadId, leads.id), eq(leadEmbeddings.accountId, leads.accountId)))
        .where(and(eq(leads.accountId, accountId), inArray(leads.status, ["qualified", "enriched", "in_campaign", "replied", "converted"])))
        .orderBy(desc(leads.updatedAt))
        .limit(limit * 5);
      const out: { leadId: string; text: string; sourceHash: string }[] = [];
      for (const r of rows) {
        const insights = (r.aiInsights ?? {}) as { prospect_offering?: string; summary?: string };
        const text = profileText({
          title: r.title,
          companyName: r.companyName,
          industry: r.industry,
          companySize: r.companySize,
          location: r.location,
          prospectOffering: insights.prospect_offering,
          summary: insights.summary,
        });
        if (!text) continue;
        const sourceHash = createHash("sha256").update(text).digest("hex").slice(0, 32);
        if (sourceHash === r.existingHash) continue;
        out.push({ leadId: r.id, text, sourceHash });
        if (out.length === limit) break;
      }
      return out;
    },

    async saveLeadEmbeddings(accountId: string, rows: { leadId: string; embedding: number[]; model: string; sourceHash: string }[]) {
      for (const r of rows) {
        await db
          .insert(leadEmbeddings)
          .values({ leadId: r.leadId, accountId, embedding: r.embedding, model: r.model, sourceHash: r.sourceHash })
          .onConflictDoUpdate({
            target: leadEmbeddings.leadId,
            set: { embedding: r.embedding, model: r.model, sourceHash: r.sourceHash },
          });
      }
    },

    async getRankFeedback(accountId: string) {
      const line = (r: { title: string | null; companyName: string | null; industry: string | null }) =>
        [r.title ?? "-", r.companyName ?? "-", r.industry ?? "-"].join(" | ");
      const verdicts = (verdict: "good_fit" | "not_fit") =>
        db
          .select({ title: leads.title, companyName: leads.companyName, industry: leads.industry, at: leadFeedback.updatedAt })
          .from(leadFeedback)
          .innerJoin(leads, and(eq(leads.id, leadFeedback.leadId), eq(leads.accountId, leadFeedback.accountId)))
          .where(and(eq(leadFeedback.accountId, accountId), eq(leadFeedback.verdict, verdict)))
          .orderBy(desc(leadFeedback.updatedAt))
          .limit(RANK_FEEDBACK_MAX);
      const [rejected, positive, notFit, goodFit] = await Promise.all([
        db
          .selectDistinctOn([scheduledSends.leadId], {
            leadId: scheduledSends.leadId,
            title: leads.title,
            companyName: leads.companyName,
            industry: leads.industry,
            at: scheduledSends.updatedAt,
          })
          .from(scheduledSends)
          .innerJoin(leads, and(eq(leads.id, scheduledSends.leadId), eq(leads.accountId, scheduledSends.accountId)))
          .where(and(eq(scheduledSends.accountId, accountId), eq(scheduledSends.rejectionReason, "wrong_person")))
          .orderBy(scheduledSends.leadId, desc(scheduledSends.updatedAt))
          .limit(200),
        db
          .select({ title: leads.title, companyName: leads.companyName, industry: leads.industry, at: leads.updatedAt })
          .from(leads)
          .where(
            and(
              eq(leads.accountId, accountId),
              or(
                isNotNull(leads.meetingBookedAt),
                sql`exists (select 1 from ${replies} r where r.lead_id = "leads"."id" and r.classification = 'interested')`
              )
            )
          )
          .orderBy(desc(leads.updatedAt))
          .limit(RANK_FEEDBACK_MAX),
        verdicts("not_fit"),
        verdicts("good_fit"),
      ]);
      // ML-4: explicit fit verdicts join review rejections / positive replies, newest first
      const tagged = (rows: { title: string | null; companyName: string | null; industry: string | null; at: Date }[]) =>
        rows.map((r) => ({ line: line(r), at: r.at }));
      return {
        rejected: mergeExemplars([tagged(rejected), tagged(notFit)], RANK_FEEDBACK_MAX),
        positive: mergeExemplars([tagged(positive), tagged(goodFit)], RANK_FEEDBACK_MAX),
      };
    },

    async getUnrankedLeads(accountId: string, since: Date, limit: number) {
      const rows = await db
        .select({
          id: leads.id,
          companyName: leads.companyName,
          companySize: leads.companySize,
          industry: leads.industry,
          location: leads.location,
          title: leads.title,
          techStack: leads.techStack,
        })
        .from(leads)
        .where(
          and(
            eq(leads.accountId, accountId),
            eq(leads.rulesGatePassed, true),
            isNull(leads.scoredAt),
            eq(leads.status, "sourced"),
            gte(leads.createdAt, since)
          )
        )
        .orderBy(desc(leads.createdAt))
        .limit(limit);
      if (rows.length === 0) return [];
      const signalRows = await db
        .select({
          leadId: leadSignals.leadId,
          kind: leadSignals.kind,
          label: leadSignals.label,
          detail: leadSignals.detail,
          level: leadSignals.level,
          observedAt: leadSignals.observedAt,
        })
        .from(leadSignals)
        .where(and(eq(leadSignals.accountId, accountId), inArray(leadSignals.leadId, rows.map((r) => r.id))));
      const signalsByLead = new Map<string, ProspectSignal[]>();
      for (const s of signalRows) {
        const list = signalsByLead.get(s.leadId) ?? [];
        list.push({
          kind: s.kind,
          label: s.label,
          detail: s.detail ?? s.label,
          ...(s.level ? { level: s.level } : {}),
          ...(s.observedAt ? { observedAt: s.observedAt.toISOString() } : {}),
        });
        signalsByLead.set(s.leadId, list);
      }
      return rows.map((r) => {
        const tech = Array.isArray(r.techStack) ? r.techStack.filter((t): t is string => typeof t === "string") : [];
        const signals = signalsByLead.get(r.id);
        return {
          leadId: r.id,
          companyName: r.companyName ?? undefined,
          companySize: r.companySize ?? undefined,
          industry: r.industry ?? undefined,
          location: r.location ?? undefined,
          title: r.title ?? undefined,
          ...(tech.length > 0 ? { technographics: tech } : {}),
          ...(signals ? { signals } : {}),
        };
      });
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
            bookingUrl: config.bookingUrl ?? null,
            websiteUrl: config.websiteUrl ?? null,
            channels: { linkedin: config.channels?.linkedin ?? false },
          },
          sendMode: campaign?.sendMode === "automatic" ? "automatic" : "review",
        },
        assets,
        account: {
          industry: account.onboardingIndustry,
          websiteScan: account.websiteScan as CopyContext["account"]["websiteScan"],
          // 0061 seller-authored positioning; null → toDraftInput falls back to the scan summary.
          valueProp: account.valueProp,
          brandVoice: account.brandVoice,
          guardrails: account.guardrails,
        },
        avoidPhrases: await recentSendOpeners(db, agent.accountId),
        winningOpeners: await winningOpeners(db, agent.accountId),
        // Config-aware selection (spec 2026-07-21): a COUNT of the account's proof points feeds
        // deriveAccountProfile's proofDepth. A count only, never the proof text — the profile is a
        // config-derived approach prior, never a fact source.
        proofCount: (
          await db.select({ n: count() }).from(proofPoints).where(eq(proofPoints.accountId, agent.accountId))
        )[0]?.n ?? 0,
      };
    },

    async getDraftableLeads(accountId: string, leadIds: string[]): Promise<DraftableLead[]> {
      if (leadIds.length === 0) return [];
      const rows = await db
        .select()
        .from(leads)
        .where(and(eq(leads.accountId, accountId), inArray(leads.id, leadIds), notMarkedNotFit));
      // ML-3: each lead's captured signals → the freshest reach-out-worthy why-now
      const signalRows = await db
        .select({
          leadId: leadSignals.leadId,
          kind: leadSignals.kind,
          label: leadSignals.label,
          detail: leadSignals.detail,
          observedAt: leadSignals.observedAt,
        })
        .from(leadSignals)
        .where(and(eq(leadSignals.accountId, accountId), inArray(leadSignals.leadId, leadIds)));
      const signalsByLead = new Map<string, typeof signalRows>();
      for (const s of signalRows) signalsByLead.set(s.leadId, [...(signalsByLead.get(s.leadId) ?? []), s]);
      const now = new Date();
      return rows.map((r) => ({
        whyNow: pickWhyNow(signalsByLead.get(r.id) ?? [], now),
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
        aiScore: r.aiScore,
        scoredAt: r.scoredAt,
      }));
    },

    async getDraftableLead(accountId: string, leadId: string): Promise<DraftableLead | null> {
      // 0050 meeting layer: a booked lead never receives another scripted touch — null here
      // makes the sequence-touch path report "skipped" (its existing missing-lead handling).
      const [r] = await db
        .select()
        .from(leads)
        .where(
          and(
            eq(leads.accountId, accountId),
            eq(leads.id, leadId),
            isNull(leads.meetingBookedAt)
          )
        )
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
        aiScore: r.aiScore,
        scoredAt: r.scoredAt,
      };
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

    async leadsWithExistingSends(accountId: string, leadIds: string[]): Promise<Set<string>> {
      if (leadIds.length === 0) return new Set();
      const rows = await db
        .selectDistinct({ leadId: scheduledSends.leadId })
        .from(scheduledSends)
        .where(and(eq(scheduledSends.accountId, accountId), inArray(scheduledSends.leadId, leadIds)));
      return new Set(rows.map((r) => r.leadId));
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

    async reviveSequenceRun(leadId: string, nextActionAt: Date) {
      // Conversation cadence (0044): the engaged lead's run goes back on the clock with one
      // touch of headroom — touches_done drops to (target-1)-equivalent by simply stepping
      // back one from wherever it is, floored at 0. Exhausted runs come back active; converted
      // runs stay converted (the win is never reopened).
      //
      // paused_reply is EXCLUDED: that status means a human took the thread over (manual reply).
      // A later prospect reply must never silently re-arm automation on a human-driven thread —
      // only an explicit "resume automation" does that. (Human-takeover fix, 2026-07-10.)
      //
      // 'stopped' is EXCLUDED too: it is always a deliberate stand-down (hard negative, booking,
      // calendar stand-down, turn-cap hand-off), and reviving it re-armed scripted nudges at a
      // prospect who had booked or been handed to a human. A booked or suppressed lead never
      // revives whatever its run status says.
      await db
        .update(sequenceRuns)
        .set({
          status: "active",
          touchesDone: sql`greatest(${sequenceRuns.touchesDone} - 1, 0)`,
          nextActionAt,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(sequenceRuns.leadId, leadId),
            inArray(sequenceRuns.status, ["active", "exhausted"]),
            sql`not exists (select 1 from ${leads} l where l.id = ${sequenceRuns.leadId} and l.meeting_booked_at is not null)`,
            sql`not exists (select 1 from ${suppressionEntries} se join ${leads} l on l.id = ${sequenceRuns.leadId} where se.account_id = ${sequenceRuns.accountId} and se.kind = 'linkedin' and (se.lead_id = l.id or se.value = l.linkedin_url_normalized))`
          )
        );
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

    async getChampion(accountId) {
      return fetchChampion(db, accountId);
    },

    async getBestOfN() {
      // Global rollout knob (Task 3) — same appSettings/eq pattern as isKillSwitchOn below.
      const [row] = await db.select().from(appSettings).where(eq(appSettings.key, "best_of_n"));
      const v = row?.value;
      return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 1;
    },

    async countFirstTouchDraftsSince(accountId, since) {
      const [row] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(scheduledSends)
        .where(
          and(
            eq(scheduledSends.accountId, accountId),
            eq(scheduledSends.linkedinStage, "invite"),
            gte(scheduledSends.createdAt, since)
          )
        );
      return row?.n ?? 0;
    },

    async getMessageShapeAuto() {
      // Global rollout knob (message-shape selector, spec 2026-07-20) — same appSettings/eq pattern
      // as getBestOfN/getAdoptionMode. OFF (byte-identical champion) whenever the row is absent OR
      // holds anything other than the literal boolean `true`; an owner must explicitly opt in.
      const [row] = await db.select().from(appSettings).where(eq(appSettings.key, "message_shape_auto"));
      return row?.value === true;
    },

    upsertStrategy,
    hasStrategyStamp,
    stampLead,

    async getFunnelCohort(accountId, window): Promise<FunnelCohort> {
      const filters = [eq(leads.accountId, accountId)];
      if (window?.since) filters.push(gte(leads.createdAt, window.since));
      if (window?.until) filters.push(lt(leads.createdAt, window.until));
      const rows = await db
        .select({
          id: leads.id,
          linkedinUrl: leads.linkedinUrl,
          rulesGatePassed: leads.rulesGatePassed,
          invitedAt: leads.linkedinInvitedAt,
          connectedAt: leads.linkedinConnectedAt,
          bookedAt: leads.meetingBookedAt,
          status: leads.status,
        })
        .from(leads)
        .where(and(...filters));
      const suppressed = await db
        .select({ value: suppressionEntries.value })
        .from(suppressionEntries)
        .where(and(eq(suppressionEntries.accountId, accountId), eq(suppressionEntries.kind, "linkedin")));
      const blocked = new Set(suppressed.map((row) => row.value));
      const visible = rows.filter((row) => !row.linkedinUrl || !blocked.has(normalizeLinkedInUrl(row.linkedinUrl)));
      if (visible.length === 0) return rollupCohort([]);
      const replyRows = await db
        .select({ leadId: replies.leadId, classification: replies.classification })
        .from(replies)
        .where(and(eq(replies.accountId, accountId), inArray(replies.leadId, visible.map((row) => row.id))));
      const byLead = new Map<string, string[]>();
      for (const reply of replyRows) {
        if (!reply.leadId || !reply.classification) continue;
        const list = byLead.get(reply.leadId) ?? [];
        list.push(reply.classification);
        byLead.set(reply.leadId, list);
      }
      return rollupCohort(
        visible.map((row) => {
          const polarity = replyPolarity(byLead.get(row.id) ?? []);
          return {
            id: row.id,
            sourced: true,
            qualified: row.rulesGatePassed === true,
            invited: row.invitedAt != null,
            accepted: row.connectedAt != null,
            interested: polarity.interested,
            negative: polarity.negative,
            booked: row.bookedAt != null,
            closed: row.status === "converted",
            arm: null,
          };
        })
      );
    },

    // ── SchedulerStore ───────────────────────────────────────────────────────

    async getDueAgents(now: Date) {
      return db
        .select({
          id: agents.id,
          accountId: agents.accountId,
          kind: agents.kind,
          runAtTime: agents.runAtTime,
          cadence: agents.cadence,
          timezone: agents.timezone,
          onboardingCompletedAt: accounts.onboardingCompletedAt,
        })
        .from(agents)
        .innerJoin(accounts, eq(accounts.id, agents.accountId))
        .where(
          and(
            inArray(agents.kind, ["scout", "intent"]),
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
          leadAssignedSenderId: leads.linkedinAccountId,
          leadLocation: leads.location,
          origin: scheduledSends.origin,
          createdAt: scheduledSends.createdAt,
        })
        .from(scheduledSends)
        .innerJoin(accounts, eq(scheduledSends.accountId, accounts.id))
        .innerJoin(campaigns, eq(scheduledSends.campaignId, campaigns.id))
        .innerJoin(leads, eq(scheduledSends.leadId, leads.id))
        .where(
          and(
            or(
              eq(scheduledSends.status, "approved"),
              and(eq(scheduledSends.status, "scheduled"), lt(scheduledSends.scheduledFor, staleCutoff))
            ),
            // archived/rejected leads left outreach — their leftover rows are never dispatched
            ne(leads.status, "archived"),
            ne(leads.status, "rejected")
          )
        );

      // Per-lead delivery facts for the message-stage rows (batched, two grouped queries):
      // when the last agent message DELIVERED and when the lead last REPLIED. These drive the
      // dispatcher's per-lead proactive gap (rule 04 pacing survives a drained backlog).
      const messageLeadIds = [
        ...new Set(rows.filter((r) => r.linkedinStage === "message").map((r) => r.leadId)),
      ];
      const lastSentByLead = new Map<string, Date>();
      const lastReplyByLead = new Map<string, Date>();
      const inFlightLeads = new Set<string>();
      if (messageLeadIds.length > 0) {
        const sentAgg = await db
          .select({ leadId: scheduledSends.leadId, at: max(scheduledSends.updatedAt) })
          .from(scheduledSends)
          .where(
            and(
              inArray(scheduledSends.leadId, messageLeadIds),
              eq(scheduledSends.linkedinStage, "message"),
              eq(scheduledSends.status, "sent")
            )
          )
          .groupBy(scheduledSends.leadId);
        for (const r of sentAgg) if (r.at) lastSentByLead.set(r.leadId, r.at);
        const replyAgg = await db
          .select({ leadId: replies.leadId, at: max(replies.receivedAt) })
          .from(replies)
          .where(inArray(replies.leadId, messageLeadIds))
          .groupBy(replies.leadId);
        for (const r of replyAgg) if (r.leadId && r.at) lastReplyByLead.set(r.leadId, r.at);
        // Messages already claimed and still live for these leads: 'sending', or 'scheduled' with
        // a runAt newer than the stale cutoff (a stale scheduled row is being re-dispatched in
        // THIS batch, so it must not block itself). One claimed message per lead at a time.
        const inFlightAgg = await db
          .select({ leadId: scheduledSends.leadId })
          .from(scheduledSends)
          .where(
            and(
              inArray(scheduledSends.leadId, messageLeadIds),
              eq(scheduledSends.linkedinStage, "message"),
              or(
                // any "sending" row blocks, stale or not: a stuck one may have been DELIVERED with
                // the bookkeeping lost, so a second message could land right behind it
                eq(scheduledSends.status, "sending"),
                and(
                  eq(scheduledSends.status, "scheduled"),
                  gte(scheduledSends.scheduledFor, staleCutoff)
                )
              )
            )
          )
          .groupBy(scheduledSends.leadId);
        for (const r of inFlightAgg) inFlightLeads.add(r.leadId);
      }

      const exemptAccounts = new Set<string>();
      for (const accountId of new Set(rows.map((r) => r.accountId))) {
        if (await accountExemptFromTrialCaps(accountId)) exemptAccounts.add(accountId);
      }

      return rows.map((r) => ({
        id: r.id,
        accountId: r.accountId,
        campaignId: r.campaignId,
        leadId: r.leadId,
        channel: r.channel as "linkedin",
        linkedinStage: r.linkedinStage as "invite" | "message" | null,
        status: r.status as "approved" | "scheduled",
        createdAt: r.createdAt,
        accountPaused: r.accountPaused,
        campaignStatus: r.campaignStatus,
        leadInvitedAt: r.leadInvitedAt,
        leadConnectedAt: r.leadConnectedAt,
        leadAssignedSenderId: r.leadAssignedSenderId,
        subscriptionStatus: statusForTrialCaps(r.subscriptionStatus, exemptAccounts.has(r.accountId)),
        unconstrained: exemptAccounts.has(r.accountId),
        leadLastMessageSentAt: lastSentByLead.get(r.leadId) ?? null,
        leadRepliedAt: lastReplyByLead.get(r.leadId) ?? null,
        leadHasInFlightMessage: inFlightLeads.has(r.leadId),
        origin: r.origin as "sequence" | "reply_response" | "manual",
        leadLocation: r.leadLocation,
      }));
    },

    async getLeadMessageGuardFacts(leadId: string, body: string | null) {
      const [sentAgg] = await db
        .select({ at: max(scheduledSends.updatedAt) }) // markSent stamps updated_at ⇒ delivery time
        .from(scheduledSends)
        .where(
          and(
            eq(scheduledSends.leadId, leadId),
            eq(scheduledSends.linkedinStage, "message"),
            eq(scheduledSends.status, "sent")
          )
        );
      const [replyAgg] = await db
        .select({ at: max(replies.receivedAt) })
        .from(replies)
        .where(eq(replies.leadId, leadId));
      let duplicateBodyDelivered = false;
      if (body !== null && body.trim() !== "") {
        const [dup] = await db
          .select({ id: scheduledSends.id })
          .from(scheduledSends)
          .where(
            and(
              eq(scheduledSends.leadId, leadId),
              eq(scheduledSends.linkedinStage, "message"),
              eq(scheduledSends.status, "sent"),
              eq(scheduledSends.body, body)
            )
          )
          .limit(1);
        duplicateBodyDelivered = Boolean(dup);
      }
      return {
        lastMessageDeliveredAt: sentAgg?.at ?? null,
        lastReplyAt: replyAgg?.at ?? null,
        duplicateBodyDelivered,
      };
    },

    async countAccountSends(accountId: string): Promise<number> {
      const [row] = await db
        .select({ n: count() })
        .from(outreachSends)
        .where(eq(outreachSends.accountId, accountId));
      return row?.n ?? 0;
    },

    async listSenderCandidates(accountId: string, now: Date): Promise<DispatchSender[]> {
      // Every active sender for the tenant (multi-sender, rule 04/13).
      const accts = await db
        .select({ id: linkedinAccounts.id, connectedAt: linkedinAccounts.connectedAt })
        .from(linkedinAccounts)
        .where(and(eq(linkedinAccounts.accountId, accountId), eq(linkedinAccounts.status, "active")));
      if (accts.length === 0) return [];

      const since7 = new Date(now.getTime() - 7 * 86_400_000);
      const staleCutoff = new Date(now.getTime() - STALE_TASK_MINUTES * 60_000);

      // Delivered: one scan of this tenant's last-7d LinkedIn sends (bounded: ≤ ~100/wk per account).
      const delivered = await db
        .select({
          liId: outreachSends.linkedinAccountId,
          stage: scheduledSends.linkedinStage,
          at: outreachSends.sentAt,
        })
        .from(outreachSends)
        .innerJoin(scheduledSends, eq(outreachSends.scheduledSendId, scheduledSends.id))
        .where(
          and(
            eq(outreachSends.accountId, accountId),
            eq(outreachSends.channel, "linkedin"),
            gte(outreachSends.sentAt, since7)
          )
        );

      // Handed out but not yet delivered, attributed to the lead's assigned sender. A scheduled
      // row past the stale cutoff is excluded: the dispatcher re-dispatches it and counts it then.
      const handedOut = await db
        .select({
          liId: leads.linkedinAccountId,
          stage: scheduledSends.linkedinStage,
          at: scheduledSends.scheduledFor,
        })
        .from(scheduledSends)
        .innerJoin(leads, eq(scheduledSends.leadId, leads.id))
        .where(
          and(
            eq(scheduledSends.accountId, accountId),
            eq(scheduledSends.channel, "linkedin"),
            or(
              // a dead "sending" row (killed task) must not hold budget forever
              and(eq(scheduledSends.status, "sending"), gte(scheduledSends.updatedAt, staleCutoff)),
              and(eq(scheduledSends.status, "scheduled"), gte(scheduledSends.scheduledFor, staleCutoff))
            )
          )
        );

      return aggregateSenderLoad(
        accts,
        delivered,
        handedOut.map((r) => ({ ...r, at: r.at ?? now })),
        now
      );
    },

    async assignLeadSender(leadId: string, linkedinAccountId: string): Promise<void> {
      await db.update(leads).set({ linkedinAccountId }).where(eq(leads.id, leadId));
    },

    async markScheduled(sendId: string, scheduledFor: Date) {
      await db
        .update(scheduledSends)
        .set({ status: "scheduled", scheduledFor })
        .where(and(eq(scheduledSends.id, sendId), inArray(scheduledSends.status, ["approved", "scheduled"])));
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
          leadLinkedinUrl: leads.linkedinUrl,
          leadStatus: leads.status,
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
        channel: r.channel as "linkedin",
        linkedinStage: r.linkedinStage as "invite" | "message" | null,
        status: r.status,
        subject: r.subject,
        body: r.body,
        campaignStatus: r.campaignStatus,
        accountPaused: r.accountPaused,
        lead: { linkedinUrl: r.leadLinkedinUrl, status: r.leadStatus },
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

    // Status-guarded transitions: each only moves a row out of the states its caller can be in, so
    // a late or duplicate task can never flip a row that another task already sent or settled.
    async revertToApproved(sendId: string) {
      await db
        .update(scheduledSends)
        .set({ status: "approved", scheduledFor: null })
        .where(and(eq(scheduledSends.id, sendId), inArray(scheduledSends.status, ["scheduled", "sending"])));
    },

    async markSent(sendId: string) {
      await db
        .update(scheduledSends)
        .set({ status: "sent" })
        .where(and(eq(scheduledSends.id, sendId), eq(scheduledSends.status, "sending")));
    },

    async markFailed(sendId: string, error: string) {
      await db
        .update(scheduledSends)
        .set({ status: "failed", error })
        .where(and(eq(scheduledSends.id, sendId), inArray(scheduledSends.status, ["scheduled", "sending"])));
    },

    async markSuppressed(sendId: string) {
      await db
        .update(scheduledSends)
        .set({ status: "suppressed" })
        .where(and(eq(scheduledSends.id, sendId), inArray(scheduledSends.status, ["scheduled", "sending"])));
    },

    async cancelUnsentFollowups(leadId: string, reason: string) {
      // an already-connected lead can still be messaged — the invite failing doesn't matter then
      const [lead] = await db
        .select({ connectedAt: leads.linkedinConnectedAt })
        .from(leads)
        .where(eq(leads.id, leadId))
        .limit(1);
      if (!lead || lead.connectedAt) return 0;
      const rows = await db
        .update(scheduledSends)
        .set({ status: "canceled", error: reason })
        .where(
          and(
            eq(scheduledSends.leadId, leadId),
            eq(scheduledSends.linkedinStage, "message"),
            // agent follow-ups only — a human-typed or reply-response message is never dropped here
            eq(scheduledSends.origin, "sequence"),
            inArray(scheduledSends.status, ["pending_review", "approved"])
          )
        )
        .returning({ id: scheduledSends.id });
      return rows.length;
    },

    async getLeadAssignedIdentity(leadId: string) {
      const [row] = await db
        .select({
          id: linkedinAccounts.id,
          providerRef: linkedinAccounts.providerRef,
          status: linkedinAccounts.status,
        })
        .from(leads)
        .innerJoin(linkedinAccounts, eq(leads.linkedinAccountId, linkedinAccounts.id))
        .where(eq(leads.id, leadId))
        .limit(1);
      return row ?? null;
    },

    async recordOutreachSend(rec: {
      accountId: string;
      campaignId: string;
      leadId: string;
      scheduledSendId: string;
      channel: "linkedin";
      linkedinAccountId?: string;
      messageRef: string | null;
    }) {
      await db.insert(outreachSends).values({
        accountId: rec.accountId,
        campaignId: rec.campaignId,
        leadId: rec.leadId,
        scheduledSendId: rec.scheduledSendId,
        channel: rec.channel,
        linkedinAccountId: rec.linkedinAccountId,
        messageRef: rec.messageRef,
      });
    },

    async setLeadInvited(leadId: string, at: Date) {
      await db.update(leads).set({ linkedinInvitedAt: at }).where(eq(leads.id, leadId));
    },

    // ── InboundStore ─────────────────────────────────────────────────────────

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
      status: "active" | "restricted" | "disconnected";
      profileUrl: string | null;
      displayName: string | null;
    }): Promise<{ supersededRefs: string[] }> {
      // Identity dedupe BEFORE the ref-keyed upsert: an ACTIVE arrival for a profile this
      // tenant already holds under a DIFFERENT ref is a reconnect that minted a fresh
      // provider account. Revive the existing row in place — its id carries the lead
      // assignments and send history — and hand back the replaced refs for seat cleanup.
      // (Without this, every reconnect added a billable duplicate seat: 2026-07-08.)
      if (e.status === "active" && e.profileUrl) {
        const identity = normalizeLinkedInUrl(e.profileUrl);
        const siblings = (
          await db
            .select({
              id: linkedinAccounts.id,
              providerRef: linkedinAccounts.providerRef,
              profileUrl: linkedinAccounts.profileUrl,
              createdAt: linkedinAccounts.createdAt,
            })
            .from(linkedinAccounts)
            .where(eq(linkedinAccounts.accountId, e.vanteraAccountId))
        ).filter((r) => r.profileUrl && normalizeLinkedInUrl(r.profileUrl) === identity);

        if (siblings.some((r) => r.providerRef !== e.providerRef)) {
          const counts = new Map<string, number>();
          const leadAgg = await db
            .select({ id: leads.linkedinAccountId, n: count() })
            .from(leads)
            .where(inArray(leads.linkedinAccountId, siblings.map((r) => r.id)))
            .groupBy(leads.linkedinAccountId);
          for (const r of leadAgg) if (r.id) counts.set(r.id, r.n);
          // keeper = the row carrying the lead history (most assigned, tie oldest)
          const keeper = [...siblings].sort(
            (a, b) =>
              (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0) ||
              a.createdAt.getTime() - b.createdAt.getTime()
          )[0]!;
          const dupIds = siblings.filter((r) => r.id !== keeper.id).map((r) => r.id);
          if (dupIds.length > 0) {
            await db
              .update(leads)
              .set({ linkedinAccountId: keeper.id })
              .where(inArray(leads.linkedinAccountId, dupIds));
            await db
              .update(outreachSends)
              .set({ linkedinAccountId: keeper.id })
              .where(inArray(outreachSends.linkedinAccountId, dupIds));
            await db.delete(linkedinAccounts).where(inArray(linkedinAccounts.id, dupIds));
          }
          await db
            .update(linkedinAccounts)
            .set({
              providerRef: e.providerRef,
              status: "active",
              profileUrl: e.profileUrl,
              displayName: e.displayName,
              connectedAt: new Date(), // a reconnect restarts the rule-04 ramp clock
            })
            .where(eq(linkedinAccounts.id, keeper.id));
          return {
            supersededRefs: [...new Set(siblings.map((r) => r.providerRef))].filter(
              (ref) => ref !== e.providerRef
            ),
          };
        }
      }

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
      return { supersededRefs: [] };
    },

    async findLeadByLinkedInUrl(accountId: string, normalizedUrl: string) {
      // Fast path: the DB-generated, indexed linkedin_url_normalized column (0036).
      const [indexed] = await db
        .select({ id: leads.id })
        .from(leads)
        .where(and(eq(leads.accountId, accountId), eq(leads.linkedinUrlNormalized, normalizedUrl)))
        .limit(1);
      let leadId = indexed?.id ?? null;
      if (!leadId) {
        // Fallback: a row whose stored (SQL) normalize diverges from the JS normalizeLinkedInUrl
        // (rare — e.g. exotic whitespace). Scan + JS-normalize so a reply is never mis-attributed.
        const rows = await db
          .select({ id: leads.id, linkedinUrl: leads.linkedinUrl })
          .from(leads)
          .where(eq(leads.accountId, accountId));
        leadId = rows.find((r) => r.linkedinUrl && normalizeLinkedInUrl(r.linkedinUrl) === normalizedUrl)?.id ?? null;
      }
      if (!leadId) return null;
      const [cl] = await db
        .select({ campaignId: campaignLeads.campaignId })
        .from(campaignLeads)
        .where(eq(campaignLeads.leadId, leadId))
        .limit(1);
      return { id: leadId, campaignId: cl?.campaignId ?? null };
    },

    async findLeadByProviderRef(accountId: string, providerRef: string) {
      const [row] = await db
        .select({ id: leads.id })
        .from(leads)
        .where(and(eq(leads.accountId, accountId), eq(leads.linkedinProviderRef, providerRef)))
        .limit(1);
      if (!row) return null;
      const [cl] = await db
        .select({ campaignId: campaignLeads.campaignId })
        .from(campaignLeads)
        .where(eq(campaignLeads.leadId, row.id))
        .limit(1);
      return { id: row.id, campaignId: cl?.campaignId ?? null };
    },

    async findContactedLeadsByName(accountId: string, name: string) {
      // Unique-or-bust: at most 2 rows so the caller can tell "unique" from "ambiguous".
      // Contacted = the lead has been invited (or beyond) — a stranger with the same name
      // as an uncontacted prospect can never claim their reply.
      const rows = await db
        .select({ id: leads.id })
        .from(leads)
        .where(
          and(
            eq(leads.accountId, accountId),
            isNotNull(leads.linkedinInvitedAt),
            sql`lower(btrim(concat_ws(' ', ${leads.firstName}, ${leads.lastName}))) = lower(btrim(${name}))`
          )
        )
        .limit(2);
      const out: Array<{ id: string; campaignId: string | null }> = [];
      for (const r of rows) {
        const [cl] = await db
          .select({ campaignId: campaignLeads.campaignId })
          .from(campaignLeads)
          .where(eq(campaignLeads.leadId, r.id))
          .limit(1);
        out.push({ id: r.id, campaignId: cl?.campaignId ?? null });
      }
      return out;
    },

    async saveLeadProviderRef(leadId: string, providerRef: string) {
      await db.update(leads).set({ linkedinProviderRef: providerRef }).where(eq(leads.id, leadId));
    },

    async setReplyOutreachSend(replyId: string, scheduledSendId: string | null) {
      // replies.outreach_send_id references the outreach_sends audit row; resolve the delivered
      // scheduled send to its newest audit row (null when unattributed or no audit row exists).
      let outreachSendId: string | null = null;
      if (scheduledSendId) {
        const [row] = await db
          .select({ id: outreachSends.id })
          .from(outreachSends)
          .where(eq(outreachSends.scheduledSendId, scheduledSendId))
          .orderBy(desc(outreachSends.sentAt))
          .limit(1);
        outreachSendId = row?.id ?? null;
      }
      await db.update(replies).set({ outreachSendId }).where(eq(replies.id, replyId));
    },

    async lastDeliveredSendId(accountId: string, leadId: string, before: Date) {
      const deliveredAt = sql<Date>`coalesce((select max(o.sent_at) from ${outreachSends} o where o.scheduled_send_id = ${scheduledSends.id}), ${scheduledSends.updatedAt})`;
      const [row] = await db
        .select({ id: scheduledSends.id })
        .from(scheduledSends)
        .where(
          and(
            eq(scheduledSends.accountId, accountId),
            eq(scheduledSends.leadId, leadId),
            eq(scheduledSends.status, "sent"),
            inArray(scheduledSends.linkedinStage, ["invite", "message"]),
            sql`${deliveredAt} <= ${before.toISOString()}::timestamptz`
          )
        )
        .orderBy(desc(deliveredAt))
        .limit(1);
      return row?.id ?? null;
    },

    async insertReply(r: {
      accountId: string;
      leadId: string;
      campaignId: string | null;
      channel: "linkedin";
      providerMessageRef: string | null;
      body: string;
      receivedAt: Date;
    }) {
      // Idempotent on (account_id, provider_message_ref) — 0043 partial unique index. A
      // provider retry or the stored-event replay lands on the existing row (created: false)
      // so downstream effects (notification, responder) never double-fire.
      const [row] = await db
        .insert(replies)
        .values(r)
        .onConflictDoNothing({
          target: [replies.accountId, replies.providerMessageRef],
          where: sql`provider_message_ref is not null`,
        })
        .returning({ id: replies.id, createdAt: replies.createdAt });
      if (row) return { id: row.id, created: true, createdAt: row.createdAt, classified: false, readout: null };
      if (!r.providerMessageRef) throw new Error("failed to insert reply");
      // classified_at is the processed marker (runInbound writes it last): an existing row without
      // it belongs to a run that crashed mid-way, and the caller finishes it instead of deduping.
      const [existing] = await db
        .select({ id: replies.id, createdAt: replies.createdAt, classifiedAt: replies.classifiedAt, readout: replies.readout })
        .from(replies)
        .where(
          and(
            eq(replies.accountId, r.accountId),
            eq(replies.providerMessageRef, r.providerMessageRef)
          )
        )
        .limit(1);
      if (!existing) throw new Error("failed to insert reply");
      return {
        id: existing.id,
        created: false,
        createdAt: existing.createdAt,
        classified: existing.classifiedAt !== null,
        readout: (existing.readout as import("@vantera/agent-brains").Readout | null) ?? null,
      };
    },

    async getLeadLinkedInUrl(accountId: string, leadId: string) {
      const [row] = await db
        .select({ url: leads.linkedinUrl })
        .from(leads)
        .where(and(eq(leads.accountId, accountId), eq(leads.id, leadId)))
        .limit(1);
      return row?.url ?? null;
    },

    async isOwnOutboundMessage(accountId: string, leadId: string, providerMessageRef: string, body: string) {
      // Our provider message id on the audit row is the strong key …
      const [byRef] = await db
        .select({ id: outreachSends.id })
        .from(outreachSends)
        .where(
          and(
            eq(outreachSends.accountId, accountId),
            eq(outreachSends.leadId, leadId),
            eq(outreachSends.messageRef, providerMessageRef)
          )
        )
        .limit(1);
      if (byRef) return true;
      // … and the text of a send already claimed or delivered covers the echo racing the post-send
      // bookkeeping (the row is 'sending' before the provider call, its body final).
      const [byBody] = await db
        .select({ id: scheduledSends.id })
        .from(scheduledSends)
        .where(
          and(
            eq(scheduledSends.accountId, accountId),
            eq(scheduledSends.leadId, leadId),
            inArray(scheduledSends.status, ["sending", "sent"]),
            sql`btrim(${scheduledSends.body}) = btrim(${body})`
          )
        )
        .limit(1);
      return Boolean(byBody);
    },

    async insertNativeMessage(m: {
      accountId: string;
      leadId: string;
      providerMessageRef: string;
      body: string;
      sentAt: Date;
    }) {
      // Idempotent on (account_id, provider_message_ref) — 0073 unique index; the webhook and the
      // thread sync share the provider's message id, so neither can mirror a message twice.
      const rows = await db
        .insert(nativeMessages)
        .values(m)
        .onConflictDoNothing({ target: [nativeMessages.accountId, nativeMessages.providerMessageRef] })
        .returning({ id: nativeMessages.id });
      return { created: rows.length > 0 };
    },

    async pauseForHumanTakeover(accountId: string, leadId: string, campaignId: string | null) {
      // Same semantics as the in-app manual reply (sendManualReply): the agent's queued drafts go
      // (never a human's own manual sends), and every live-or-stood-down run holds at paused_reply
      // until the user explicitly hands the thread back. 'converted' (the win) is left alone.
      await db
        .update(scheduledSends)
        .set({ status: "canceled", error: "human took over the thread" })
        .where(
          and(
            eq(scheduledSends.accountId, accountId),
            eq(scheduledSends.leadId, leadId),
            inArray(scheduledSends.status, ["pending_review", "approved", "scheduled"]),
            or(isNull(scheduledSends.origin), ne(scheduledSends.origin, "manual"))
          )
        );
      const paused = await db
        .update(sequenceRuns)
        .set({ status: "paused_reply", updatedAt: new Date() })
        .where(
          and(
            eq(sequenceRuns.accountId, accountId),
            eq(sequenceRuns.leadId, leadId),
            inArray(sequenceRuns.status, ["active", "exhausted", "stopped", "paused_reply"])
          )
        )
        .returning({ id: sequenceRuns.id });
      // No run at all (never enrolled / compose-to-any-lead): a paused marker is what the
      // responder and proactive touches read, so one must exist for the takeover to hold.
      if (paused.length === 0 && campaignId) {
        await db
          .insert(sequenceRuns)
          .values({ accountId, campaignId, leadId, status: "paused_reply" })
          .onConflictDoNothing({ target: [sequenceRuns.campaignId, sequenceRuns.leadId] });
      }
    },

    async setReplyReadout(replyId: string, readout: import("@vantera/agent-brains").Readout) {
      await db.update(replies).set({ readout }).where(eq(replies.id, replyId));
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

    async getResponderBundle(
      accountId: string,
      leadId: string,
      _campaignId: string | null,
      opts?: { excludeReplyId?: string }
    ): Promise<ResponderBundle | null> {
      // The live Outreach (copy) agent owns reply handling (rule 08). No live agent ⇒ responder off.
      const [agent] = await db
        .select({ id: agents.id, campaignId: agents.campaignId, config: agents.config })
        .from(agents)
        .where(and(eq(agents.accountId, accountId), eq(agents.kind, "copy"), eq(agents.status, "live")))
        .limit(1);
      if (!agent?.campaignId) return null;

      // No insights ⇒ nothing to ground a reply on; stay silent (just classify + notify).
      const [lead] = await db
        .select()
        .from(leads)
        .where(and(eq(leads.accountId, accountId), eq(leads.id, leadId)))
        .limit(1);
      if (!lead?.aiInsights) return null;

      // The playbook champion shapes every message (null version when no playbook exists yet).
      const champion = await fetchChampion(db, accountId);

      const [account] = await db.select().from(accounts).where(eq(accounts.id, accountId)).limit(1);
      const [campaign] = await db
        .select({ sendMode: campaigns.sendMode })
        .from(campaigns)
        .where(eq(campaigns.id, agent.campaignId))
        .limit(1);
      const assets = await db
        .select({ url: agentAssets.url, filename: agentAssets.filename })
        .from(agentAssets)
        .where(eq(agentAssets.agentId, agent.id));
      const config = (agent.config ?? {}) as { cta?: string; bookingUrl?: string | null; websiteUrl?: string | null };
      const scan = account?.websiteScan as (WebsiteScan & { url?: string }) | null;

      // Running thread: delivered agent touches + the lead's replies, merged oldest-first.
      // The INVITE note is included — it's the actual first touch, and a brain that can't see
      // it can regenerate the same hook, making a follow-up read like a second cold intro.
      // Ordered by DELIVERY time (the audit row's sent_at, else markSent's updated_at stamp) — a
      // draft created early but delivered after the lead's reply must sit after it in the thread.
      const sent = await db
        .select({
          body: scheduledSends.body,
          stage: scheduledSends.linkedinStage,
          origin: scheduledSends.origin,
          deliveredAt: sql<Date>`coalesce((select max(o.sent_at) from ${outreachSends} o where o.scheduled_send_id = ${scheduledSends.id}), ${scheduledSends.updatedAt})`.mapWith(scheduledSends.updatedAt),
        })
        .from(scheduledSends)
        .where(
          and(
            eq(scheduledSends.leadId, leadId),
            inArray(scheduledSends.linkedinStage, ["invite", "message"]),
            eq(scheduledSends.status, "sent"),
            isNotNull(scheduledSends.body)
          )
        );
      // The incoming reply is handed to the brain separately (`incoming`); auto-responders aren't
      // conversation and would read as the lead's last word.
      const got = await db
        .select({ body: replies.body, at: replies.receivedAt })
        .from(replies)
        .where(
          and(
            eq(replies.leadId, leadId),
            opts?.excludeReplyId ? ne(replies.id, opts.excludeReplyId) : undefined,
            or(isNull(replies.classification), ne(replies.classification, "out_of_office"))
          )
        );
      // What the user typed natively in LinkedIn (0073) is the seller's side of the thread too — a
      // brain blind to it re-asks what the human already asked, or contradicts what they promised.
      const native = await db
        .select({ body: nativeMessages.body, at: nativeMessages.sentAt })
        .from(nativeMessages)
        .where(and(eq(nativeMessages.accountId, accountId), eq(nativeMessages.leadId, leadId)));
      const thread = [
        ...sent.map((s) => ({ role: "agent" as const, text: s.body ?? "", at: s.deliveredAt })),
        ...native.map((n) => ({ role: "agent" as const, text: n.body, at: n.at })),
        ...got.map((r) => ({ role: "lead" as const, text: r.body ?? "", at: r.at })),
      ]
        .filter((t) => t.text.trim() !== "")
        .sort((a, b) => a.at.getTime() - b.at.getTime())
        .map(({ role, text }) => ({ role, text }));

      // Turn cap + delivery gap count MESSAGES only — the invite is thread context, not a turn.
      const sentMessages = sent.filter((s) => s.stage === "message");
      // A human's manual message is thread context and gates the delivery gap, but never spends
      // the AGENT's converse-to-close budget.
      const agentMessages = sentMessages.filter((s) => s.origin !== "manual");
      // A natively typed message gates the delivery gap exactly like an in-app manual one.
      const lastAgentMessageAt = [...sentMessages.map((r) => r.deliveredAt), ...native.map((n) => n.at)].reduce<
        Date | null
      >((max, at) => (max === null || at > max ? at : max), null);

      // Newest message-stage draft still queued/in-flight — callers decide what it means:
      // sequence touches never stack on one; the responder supersedes it when it predates the reply.
      const [pending] = await db
        .select({ createdAt: scheduledSends.createdAt })
        .from(scheduledSends)
        .where(
          and(
            eq(scheduledSends.leadId, leadId),
            eq(scheduledSends.linkedinStage, "message"),
            inArray(scheduledSends.status, ["pending_review", "approved", "scheduled", "sending"])
          )
        )
        .orderBy(desc(scheduledSends.createdAt))
        .limit(1);

      // Human takeover: a manual reply pauses the lead's run (paused_reply). While it's paused the
      // agent never messages the thread — the responder and proactive touches both read this flag.
      const [paused] = await db
        .select({ id: sequenceRuns.id })
        .from(sequenceRuns)
        .where(and(eq(sequenceRuns.leadId, leadId), eq(sequenceRuns.status, "paused_reply")))
        .limit(1);

      return {
        campaignId: agent.campaignId,
        sendMode: campaign?.sendMode === "automatic" ? "automatic" : "review",
        lead: {
          firstName: lead.firstName,
          lastName: lead.lastName,
          title: lead.title,
          companyName: lead.companyName,
          industry: lead.industry,
        },
        insights: lead.aiInsights as ResponderBundle["insights"],
        context: {
          cta: config.cta ?? "a quick look",
          bookingUrl: config.bookingUrl ?? null,
          websiteUrl: config.websiteUrl ?? null,
          contentLinks: assets
            .map((a) => a.url ?? a.filename)
            .filter((v): v is string => Boolean(v)),
          accountName: account?.name ?? null,
          accountIndustry: account?.onboardingIndustry ?? null,
          // 0061: seller-authored positioning wins; scan summary is the fallback. Voice +
          // guardrails feed the responder tone/limits (leadBlock renders them).
          valueProp: account?.valueProp ?? scan?.summary ?? null,
          brandVoice: account?.brandVoice ?? null,
          guardrails: account?.guardrails ?? null,
          avoidPhrases: await recentSendOpeners(db, accountId),
          // Citable proof/pricing/FAQ facts — lets the responder answer evidence/price questions
          // truthfully instead of deflecting or getting flagged for a fabricated number (0046).
          proofPoints: await loadProofPoints(db, accountId),
          // WS-3.1: conversation drafting (replies + follow-ups) becomes strategy-aware — same
          // strategy as the attribution stamp below, so the prompt and the recipe never disagree
          // about what shaped the message.
          strategy: champion.strategy,
        },
        thread,
        agentTurns: agentMessages.length,
        newestUnsentMessageCreatedAt: pending?.createdAt ?? null,
        lastAgentMessageAt,
        humanHandled: paused !== undefined,
        attribution: {
          strategy: champion.strategy,
          playbookVersion: champion.version,
        },
      };
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

    async setLeadConnected(leadId: string, at: Date) {
      await db.update(leads).set({ linkedinConnectedAt: at }).where(eq(leads.id, leadId));
    },

    // Leads we invited but never recorded as connected — candidates for an acceptance backfill
    // (sync-connections) after the webhook outage that dropped new_relation events.
    async getInvitedUnacceptedLeads(accountId: string): Promise<{ leadId: string; profileUrl: string }[]> {
      const rows = await db
        .select({ leadId: leads.id, profileUrl: leads.linkedinUrl })
        .from(leads)
        .where(
          and(
            eq(leads.accountId, accountId),
            isNotNull(leads.linkedinInvitedAt),
            isNull(leads.linkedinConnectedAt),
            isNotNull(leads.linkedinUrl)
          )
        );
      return rows.flatMap((r) => (r.profileUrl ? [{ leadId: r.leadId, profileUrl: r.profileUrl }] : []));
    },

    async setLeadReplied(leadId: string, campaignId: string | null) {
      // Never demote a closed-won lead: 'converted' is the close-stage label (CRM push, conversion
      // metrics), and a later reply from that buyer must not erase it.
      await db
        .update(leads)
        .set({ status: "replied" })
        .where(and(eq(leads.id, leadId), ne(leads.status, "converted")));
      if (campaignId) {
        await db
          .update(campaignLeads)
          .set({ status: "replied" })
          .where(and(eq(campaignLeads.campaignId, campaignId), eq(campaignLeads.leadId, leadId)));
      }
    },

    async markMeetingBooked(leadId: string, at: Date) {
      // First booking wins — never overwrite an earlier meeting timestamp. This is the
      // reply-classification DETECTOR's writer, so source='agent' (manual is authoritative
      // and writes through the web action, 0050).
      await db
        .update(leads)
        .set({ meetingBookedAt: at, meetingSource: "agent" })
        .where(and(eq(leads.id, leadId), isNull(leads.meetingBookedAt)));
    },

    // ── MeetingEventStore (ML-6 calendar integration) ─────────────────────────

    async getMeetingConnection(connectionId: string) {
      const [row] = await db
        .select({ id: meetingConnections.id, accountId: meetingConnections.accountId, provider: meetingConnections.provider, status: meetingConnections.status })
        .from(meetingConnections)
        .where(eq(meetingConnections.id, connectionId));
      return row ?? null;
    },

    async touchMeetingConnection(connectionId: string) {
      await db
        .update(meetingConnections)
        .set({ lastEventAt: new Date(), status: "active", lastError: null })
        .where(eq(meetingConnections.id, connectionId));
    },

    async leadInAccount(accountId: string, leadId: string) {
      const [row] = await db
        .select({ id: leads.id })
        .from(leads)
        .where(and(eq(leads.id, leadId), eq(leads.accountId, accountId)));
      return !!row;
    },

    async findLeadByEmail(accountId: string, email: string) {
      const [row] = await db
        .select({ id: leads.id })
        .from(leads)
        .where(and(eq(leads.accountId, accountId), sql`lower(${leads.email}) = ${email.trim().toLowerCase()}`))
        .orderBy(desc(leads.updatedAt))
        .limit(1);
      return row?.id ?? null;
    },

    async upsertMeetingEvent(e) {
      await db
        .insert(meetingEvents)
        .values({
          accountId: e.accountId,
          leadId: e.leadId,
          connectionId: e.connectionId,
          provider: e.provider,
          bookingRef: e.bookingRef,
          status: e.status,
          startAt: e.startAt,
          attribution: e.attribution ?? "link",
        })
        .onConflictDoUpdate({
          target: [meetingEvents.accountId, meetingEvents.provider, meetingEvents.bookingRef],
          set: { status: e.status, ...(e.startAt ? { startAt: e.startAt } : {}) },
        });
    },

    async findMeetingEvent(accountId: string, provider: string, bookingRef: string) {
      const [row] = await db
        .select({ leadId: meetingEvents.leadId, status: meetingEvents.status })
        .from(meetingEvents)
        .where(
          and(
            eq(meetingEvents.accountId, accountId),
            eq(meetingEvents.provider, provider as "calendly" | "calcom"),
            eq(meetingEvents.bookingRef, bookingRef)
          )
        );
      return row ?? null;
    },

    async hasLiveBooking(accountId: string, leadId: string) {
      const [row] = await db
        .select({ id: meetingEvents.id })
        .from(meetingEvents)
        .where(and(eq(meetingEvents.accountId, accountId), eq(meetingEvents.leadId, leadId), eq(meetingEvents.status, "booked")))
        .limit(1);
      return !!row;
    },

    async markCalendarMeeting(accountId: string, leadId: string, startAt: Date | null) {
      // first booking keeps its booked_at; the calendar is authoritative on WHEN and the source
      await db
        .update(leads)
        .set({
          meetingBookedAt: sql`coalesce(${leads.meetingBookedAt}, now())`,
          meetingAt: startAt,
          meetingSource: "calendar",
        })
        .where(and(eq(leads.id, leadId), eq(leads.accountId, accountId)));
    },

    async clearCalendarMeeting(accountId: string, leadId: string) {
      await db
        .update(leads)
        .set({ meetingBookedAt: null, meetingAt: null, meetingSource: null })
        .where(and(eq(leads.id, leadId), eq(leads.accountId, accountId), eq(leads.meetingSource, "calendar")));
    },

    async standDownOutreach(accountId: string, leadId: string) {
      await db
        .update(scheduledSends)
        .set({ status: "canceled", error: "meeting booked — outreach stood down" })
        .where(
          and(
            eq(scheduledSends.accountId, accountId),
            eq(scheduledSends.leadId, leadId),
            inArray(scheduledSends.status, ["pending_review", "approved", "scheduled"])
          )
        );
      await db
        .update(sequenceRuns)
        .set({ status: "stopped" })
        .where(and(eq(sequenceRuns.accountId, accountId), eq(sequenceRuns.leadId, leadId), eq(sequenceRuns.status, "active")));
    },

    async notifyMeetingBooked(accountId: string, leadId: string) {
      await db.insert(leadNotifications).values({ accountId, leadId, kind: "meeting_booked", body: "calendar" });
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
          nextActionAt: sequenceRuns.nextActionAt,
          enteredStageAt: sequenceRuns.enteredStageAt,
          revivedAt: sequenceRuns.revivedAt,
          lastTouchAt: sequenceRuns.lastTouchAt,
          linkedinUrl: leads.linkedinUrl,
          leadInvitedAt: leads.linkedinInvitedAt,
          leadConnectedAt: leads.linkedinConnectedAt,
          sequenceConfig: campaigns.sequenceConfig,
          accountPaused: accounts.outreachPaused,
          // the lead engaged at least once — an exhausting run earns the one-shot soft-no revival
          leadReplied: sql<boolean>`exists (select 1 from replies r where r.lead_id = ${sequenceRuns.leadId})`,
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
          nextActionAt: r.nextActionAt,
          enteredStageAt: r.enteredStageAt,
          revivedAt: r.revivedAt,
          lastTouchAt: r.lastTouchAt,
        },
        channels: {
          linkedinUrl: r.linkedinUrl,
        },
        config: resolveSequenceConfig(
          (r.sequenceConfig ?? null) as Parameters<typeof resolveSequenceConfig>[0]
        ),
        accountPaused: r.accountPaused,
        leadReplied: r.leadReplied,
        connection: { invitedAt: r.leadInvitedAt, connectedAt: r.leadConnectedAt },
      }));
    },

    async suppressionFlags(accountId: string, ch: LeadChannels) {
      return {
        linkedin: ch.linkedinUrl
          ? await isSuppressedAnyKind(db, accountId, "linkedin", normalizeLinkedInUrl(ch.linkedinUrl))
          : false,
      };
    },

    async suppressionFlagsForRuns(runs) {
      // Group normalized LinkedIn urls by account → one indexed inArray query per account,
      // replacing the per-run suppressionFlags lookup (the orchestrator N+1).
      const urlsByAccount = new Map<string, Set<string>>();
      for (const r of runs) {
        if (!r.channels.linkedinUrl) continue;
        const norm = normalizeLinkedInUrl(r.channels.linkedinUrl);
        let set = urlsByAccount.get(r.run.accountId);
        if (!set) urlsByAccount.set(r.run.accountId, (set = new Set()));
        set.add(norm);
      }
      const suppressedByAccount = new Map<string, Set<string>>();
      for (const [accountId, urls] of urlsByAccount) {
        const rows = await db
          .select({ value: suppressionEntries.value })
          .from(suppressionEntries)
          .where(
            and(
              eq(suppressionEntries.accountId, accountId),
              eq(suppressionEntries.kind, "linkedin"),
              inArray(suppressionEntries.value, [...urls])
            )
          );
        suppressedByAccount.set(accountId, new Set(rows.map((row) => row.value)));
      }
      const out = new Map<string, { linkedin: boolean }>();
      for (const r of runs) {
        const norm = r.channels.linkedinUrl ? normalizeLinkedInUrl(r.channels.linkedinUrl) : null;
        out.set(r.run.id, {
          linkedin: !!norm && (suppressedByAccount.get(r.run.accountId)?.has(norm) ?? false),
        });
      }
      return out;
    },

    async applyRunPatch(runId: string, expectNextActionAt: Date, patch: SequenceRunPatch): Promise<boolean> {
      const set: Partial<typeof sequenceRuns.$inferInsert> = { updatedAt: new Date() };
      if (patch.status !== undefined) set.status = patch.status;
      if (patch.currentStage !== undefined) set.currentStage = patch.currentStage;
      if (patch.touchesDone !== undefined) set.touchesDone = patch.touchesDone;
      if (patch.nextActionAt !== undefined) set.nextActionAt = patch.nextActionAt;
      if (patch.enteredStageAt !== undefined) set.enteredStageAt = patch.enteredStageAt;
      if (patch.lastTouchAt !== undefined) set.lastTouchAt = patch.lastTouchAt;
      if (patch.revivedAt !== undefined) set.revivedAt = patch.revivedAt;
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
      // An archived lead is out of outreach: cancel whatever is still queued for them ("sending"
      // is left alone — that provider call is already in flight).
      await db
        .update(scheduledSends)
        .set({ status: "canceled", error: "lead archived" })
        .where(
          and(
            eq(scheduledSends.leadId, leadId),
            inArray(scheduledSends.status, ["pending_review", "approved", "scheduled"])
          )
        );
      await db
        .update(campaignLeads)
        .set({ status: "completed" })
        .where(and(eq(campaignLeads.campaignId, campaignId), eq(campaignLeads.leadId, leadId)));
    },

    async enrollPendingLeads(now: Date): Promise<number> {
      // Enrol in_campaign leads that lack any sequence_runs row for their campaign.
      // The unique (campaign_id, lead_id) constraint + ON CONFLICT DO NOTHING keeps this idempotent.
      //
      // Two-step (select candidates, then insert .values) rather than INSERT…SELECT: Drizzle's
      // insert().select() requires the projection to enumerate EVERY table column in declaration
      // order (haveSameKeys), so a 4-of-13-column projection throws at build time. .values()
      // respects the column defaults (id/status/stage/timestamps), matching every other insert here.
      const candidates = await db
        .select({
          accountId: campaignLeads.accountId,
          campaignId: campaignLeads.campaignId,
          leadId: campaignLeads.leadId,
        })
        .from(campaignLeads)
        .innerJoin(leads, eq(leads.id, campaignLeads.leadId))
        .where(
          and(
            eq(leads.status, "in_campaign"),
            sql`not exists (select 1 from ${sequenceRuns} sr where sr.campaign_id = ${campaignLeads.campaignId} and sr.lead_id = ${campaignLeads.leadId})`
          )
        );
      if (candidates.length === 0) return 0;
      const rows = await db
        .insert(sequenceRuns)
        .values(candidates.map((c) => ({ ...c, nextActionAt: now })))
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

    // Widened union satisfies every notifying store; lead_notifications.kind check
    // (0017, extended by 0044 + 0050) permits all of them.
    async insertLeadNotification(n: {
      accountId: string;
      leadId: string;
      kind: "reply" | "converted" | "exhausted" | "needs_human" | "meeting_booked";
      body: string;
    }) {
      await db.insert(leadNotifications).values({
        accountId: n.accountId,
        leadId: n.leadId,
        kind: n.kind,
        body: n.body,
      });
    },

    // ── InboundStore (sequence stop gate) ────────────────────────────────────

    async stopSequenceForReply(leadId: string) {
      await db
        .update(sequenceRuns)
        .set({ status: "stopped", updatedAt: new Date() })
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
          valueProp: accounts.valueProp,
          websiteScan: accounts.websiteScan,
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

      const scan = row.websiteScan as (WebsiteScan & { url?: string }) | null;
      return {
        externalRef: row.externalRef ?? "",
        minScore,
        accountIndustry: row.accountIndustry,
        icpDescription: row.icpName
          ? `${row.icpName}: ${JSON.stringify(row.icpCriteria ?? {})}`
          : "",
        valueProp: row.valueProp ?? scan?.summary ?? null,
        candidate: {
          companyName: row.companyName,
          companySize: row.companySize,
          industry: row.industry,
          location: row.location,
          title: row.title,
        },
      };
    },

    // ── AgentRunStore (T4 operate path) ──────────────────────────────────────

    async recordAgentRun(run: AgentRunRecord) {
      await db.insert(agentRuns).values({
        accountId: run.accountId,
        agentId: run.agentId,
        kind: run.kind,
        status: run.status,
        summary: run.summary,
        note: run.note ?? null,
      });
      // Retention (rule 11): telemetry, not tenant data — keep 90 days per agent.
      await db
        .delete(agentRuns)
        .where(
          and(
            eq(agentRuns.agentId, run.agentId),
            lt(agentRuns.startedAt, new Date(Date.now() - 90 * 86_400_000))
          )
        );
    },

    // ── QualifyLeadStore (R6 manual-add) ─────────────────────────────────────

    async loadLeadForQualify(accountId: string, leadId: string): Promise<QualifyLeadLoad | null> {
      const [row] = await db
        .select({
          scoredAt: leads.scoredAt,
          companyName: leads.companyName,
          companySize: leads.companySize,
          industry: leads.industry,
          location: leads.location,
          title: leads.title,
          icpName: icps.name,
          icpCriteria: icps.criteria,
          accountIndustry: accounts.onboardingIndustry,
          valueProp: accounts.valueProp,
          websiteScan: accounts.websiteScan,
        })
        .from(leads)
        .leftJoin(icps, eq(leads.icpId, icps.id))
        .innerJoin(accounts, eq(leads.accountId, accounts.id))
        .where(and(eq(leads.id, leadId), eq(leads.accountId, accountId)))
        .limit(1);
      if (!row) return null;

      // Same min_score source as every other qualification path (rule 06).
      const [scoutAgent] = await db
        .select({ config: agents.config })
        .from(agents)
        .where(and(eq(agents.accountId, accountId), eq(agents.kind, "scout"), eq(agents.status, "live")))
        .limit(1);
      const scoutConfig = (scoutAgent?.config ?? {}) as { min_score?: number; minScore?: number };
      const minScore = scoutConfig.min_score ?? scoutConfig.minScore ?? SCOUT_DEFAULTS.minScore;

      const scan = row.websiteScan as (WebsiteScan & { url?: string }) | null;
      return {
        alreadyScored: row.scoredAt != null,
        minScore,
        accountIndustry: row.accountIndustry,
        icpDescription: row.icpName
          ? `${row.icpName}: ${JSON.stringify(row.icpCriteria ?? {})}`
          : "",
        icpCriteria: (row.icpCriteria ?? {}) as IcpCriteria,
        valueProp: row.valueProp ?? scan?.summary ?? null,
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
            lt(accounts.trialEndsAt, now),
            sql`not exists (
              select 1 from public.account_members m
              join auth.users u on u.id = m.user_id
              where m.account_id = ${accounts.id}
                and m.role in ('owner', 'admin')
                and lower(u.email) = ${LIFECYCLE_ADMIN_EMAIL}
            )`
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

export interface DueAgent {
  id: string;
  accountId: string;
  kind: "scout" | "copy" | "intent";
  runAtTime: string | null;
  cadence: "daily" | "weekly" | "intraday" | null;
  timezone: string;
  /** Null while the account is still in onboarding — the scheduler holds those out. */
  onboardingCompletedAt: Date | null;
}

export interface SchedulerStore {
  /** Live agents whose schedule is due — the scheduled kinds (scout + intent) only. */
  getDueAgents(now: Date): Promise<DueAgent[]>;
  advanceSchedule(agentId: string, nextRunAt: Date): Promise<void>;
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

export function createAccountDeletionStore(db: Db): AccountDeletionStore {
  return {
    async listPendingDeletionRequests() {
      // createdAt is a timestamptz column → drizzle/postgres-js returns a Date directly.
      return db
        .select({
          accountId: accountDeletionRequests.accountId,
          requestedAt: accountDeletionRequests.createdAt,
        })
        .from(accountDeletionRequests)
        .where(eq(accountDeletionRequests.status, "pending"));
    },

    async listOrphanAccountIds() {
      // Zero members = the auth users were deleted outside the app (account_members cascades
      // on auth deletion, accounts do not). No one is left to file a deletion request.
      const rows = await db
        .select({ id: accounts.id })
        .from(accounts)
        .leftJoin(accountMembers, eq(accountMembers.accountId, accounts.id))
        .where(isNull(accountMembers.userId));
      return rows.map((r) => r.id);
    },

    async listAccountLinkedInRefs(accountId) {
      const rows = await db
        .select({ ref: linkedinAccounts.providerRef })
        .from(linkedinAccounts)
        .where(eq(linkedinAccounts.accountId, accountId));
      return rows.map((r) => r.ref).filter((r): r is string => !!r);
    },

    async pauseAccountUsage(accountId) {
      // Quarantine: stop agent runs (discovery + AI spend) and freeze outreach. Idempotent.
      await db
        .update(agents)
        .set({ status: "paused" })
        .where(and(eq(agents.accountId, accountId), eq(agents.status, "live")));
      await db.update(accounts).set({ outreachPaused: true }).where(eq(accounts.id, accountId));
    },

    async deleteAccount(accountId) {
      // Hard delete; FK cascades wipe all tenant data and the deletion-request row itself.
      await db.delete(accounts).where(eq(accounts.id, accountId));
    },
  };
}

// ── CRM activity sync (0041) ─────────────────────────────────────────────────────

/** Drizzle implementation of the activity-sync store. Service-role db (RLS-exempt);
 *  tenancy comes from the per-connection accountId the pipeline scopes every query with. */
export function createCrmActivityStore(db: Db): CrmActivityStore {
  const leadShape = {
    firstName: leads.firstName,
    lastName: leads.lastName,
    email: leads.email,
    title: leads.title,
    company: leads.companyName,
    linkedinUrl: leads.linkedinUrl,
  };

  return {
    async listActivityConnections(): Promise<ActivityConnectionRow[]> {
      const rows = await db
        .select()
        .from(crmConnections)
        .where(
          and(
            eq(crmConnections.status, "active"),
            sql`(${crmConnections.config} -> 'activity' ->> 'enabled') = 'true'`
          )
        );
      return rows.map((c) => ({
        id: c.id,
        accountId: c.accountId,
        provider: c.provider as ActivityConnectionRow["provider"],
        status: c.status,
        accessTokenEnc: c.accessTokenEnc,
        refreshTokenEnc: c.refreshTokenEnc,
        tokenExpiresAt: c.tokenExpiresAt ? c.tokenExpiresAt.toISOString() : null,
        externalAccountRef: c.externalAccountRef,
        config: (c.config ?? {}) as ActivityConnectionRow["config"],
      }));
    },

    async eventsSince(accountId, sinceIso, limit): Promise<LeadActivityEvent[]> {
      const since = new Date(sinceIso);

      const sends = await db
        .select({ occurredAt: outreachSends.sentAt, leadId: outreachSends.leadId, ...leadShape })
        .from(outreachSends)
        .innerJoin(leads, eq(outreachSends.leadId, leads.id))
        .where(and(eq(outreachSends.accountId, accountId), gt(outreachSends.sentAt, since)))
        .orderBy(asc(outreachSends.sentAt))
        .limit(limit);

      const replyRows = await db
        .select({
          occurredAt: replies.receivedAt,
          leadId: replies.leadId,
          excerpt: replies.body,
          ...leadShape,
        })
        .from(replies)
        .innerJoin(leads, eq(replies.leadId, leads.id))
        .where(and(eq(replies.accountId, accountId), gt(replies.receivedAt, since)))
        .orderBy(asc(replies.receivedAt))
        .limit(limit);

      const meetings = await db
        .select({ occurredAt: leads.closedAt, leadId: leads.id, ...leadShape })
        .from(leads)
        .where(
          and(
            eq(leads.accountId, accountId),
            eq(leads.status, "converted"),
            isNotNull(leads.closedAt),
            gt(leads.closedAt, since)
          )
        )
        .orderBy(asc(leads.closedAt))
        .limit(limit);

      type EventRow = {
        occurredAt: Date | null;
        leadId: string | null;
        excerpt?: string | null;
        firstName: string | null;
        lastName: string | null;
        email: string | null;
        title: string | null;
        company: string | null;
        linkedinUrl: string | null;
      };
      const toEvent = (row: EventRow, kind: LeadActivityEvent["kind"]): LeadActivityEvent | null =>
        row.leadId && row.occurredAt
          ? {
              leadId: row.leadId,
              kind,
              occurredAt: row.occurredAt.toISOString(),
              excerpt: row.excerpt ?? null,
              lead: {
                firstName: row.firstName,
                lastName: row.lastName,
                email: row.email,
                title: row.title,
                company: row.company,
                linkedinUrl: row.linkedinUrl,
              },
            }
          : null;

      return [
        ...sends.map((r) => toEvent(r, "outreach")),
        ...replyRows.map((r) => toEvent(r, "reply")),
        ...meetings.map((r) => toEvent(r, "meeting")),
      ]
        .filter((e): e is LeadActivityEvent => e !== null)
        .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))
        .slice(0, limit);
    },

    async getContactRef(connectionId, leadId) {
      const [row] = await db
        .select({ externalRef: crmContactRefs.externalRef })
        .from(crmContactRefs)
        .where(
          and(eq(crmContactRefs.connectionId, connectionId), eq(crmContactRefs.leadId, leadId))
        )
        .limit(1);
      return row?.externalRef ?? null;
    },

    async saveContactRef(args) {
      await db
        .insert(crmContactRefs)
        .values({
          accountId: args.accountId,
          connectionId: args.connectionId,
          leadId: args.leadId,
          externalRef: args.externalRef,
        })
        .onConflictDoUpdate({
          target: [crmContactRefs.connectionId, crmContactRefs.leadId],
          set: { externalRef: args.externalRef },
        });
    },

    async saveWatermark(connectionId, iso) {
      // Defensive double-set: create the activity object if a concurrent config write
      // dropped it, then stamp the watermark. jsonb_set never creates missing parents.
      await db
        .update(crmConnections)
        .set({
          config: sql`jsonb_set(
            jsonb_set(
              coalesce(${crmConnections.config}, '{}'::jsonb),
              '{activity}',
              coalesce(coalesce(${crmConnections.config}, '{}'::jsonb) -> 'activity', '{}'::jsonb),
              true
            ),
            '{activity,watermark}',
            to_jsonb(${iso}::text),
            true
          )`,
          lastSyncAt: new Date(),
        })
        .where(eq(crmConnections.id, connectionId));
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

    async markConnectionError(connectionId, error) {
      await db
        .update(crmConnections)
        .set({ status: "error", lastError: error })
        .where(eq(crmConnections.id, connectionId));
    },
  };
}

// ── Weekly summary (0042) ────────────────────────────────────────────────────────

const WEEKLY_QUALIFIED_MIN_SCORE = 70; // rule 06 default bar
const ACTIVE_PIPELINE_STATUSES = ["qualified", "enriched", "in_campaign", "replied"] as const;

/** Drizzle implementation of the weekly-summary store. Service-role db; recipients come
 *  from auth.users via raw SQL (the auth schema isn't modeled in Drizzle) — owner/admin
 *  emails only, never exposed to clients. */
export function createWeeklySummaryStore(db: Db): WeeklySummaryStore {
  return {
    async listAccountsForSummary(start, end): Promise<WeeklySummaryRow[]> {
      const accountRows = await db
        .select({
          id: accounts.id,
          name: accounts.name,
          enabled: accounts.weeklySummaryEnabled,
          goalCents: accounts.revenueGoalCents,
          avgDealValueCents: accounts.avgDealValueCents,
        })
        .from(accounts);

      const inWindow = (col: Parameters<typeof gt>[0]) => and(gt(col, start), lte(col, end));

      const [liveAgents, sends, replyCounts, meetings, intent, qualified, activePipeline] =
        await Promise.all([
          db
            .select({ accountId: agents.accountId, n: count() })
            .from(agents)
            .where(eq(agents.status, "live"))
            .groupBy(agents.accountId),
          db
            .select({ accountId: outreachSends.accountId, n: count() })
            .from(outreachSends)
            .where(inWindow(outreachSends.sentAt))
            .groupBy(outreachSends.accountId),
          db
            .select({ accountId: replies.accountId, n: count() })
            .from(replies)
            .where(inWindow(replies.receivedAt))
            .groupBy(replies.accountId),
          db
            .select({ accountId: leads.accountId, n: count() })
            .from(leads)
            .where(and(eq(leads.status, "converted"), inWindow(leads.closedAt)))
            .groupBy(leads.accountId),
          db
            .select({ accountId: leads.accountId, n: count() })
            .from(leads)
            .where(and(eq(leads.source, "intent"), inWindow(leads.createdAt)))
            .groupBy(leads.accountId),
          db
            .select({ accountId: leads.accountId, n: count() })
            .from(leads)
            .where(and(gte(leads.aiScore, WEEKLY_QUALIFIED_MIN_SCORE), inWindow(leads.scoredAt)))
            .groupBy(leads.accountId),
          db
            .select({ accountId: leads.accountId, n: count() })
            .from(leads)
            .where(inArray(leads.status, [...ACTIVE_PIPELINE_STATUSES]))
            .groupBy(leads.accountId),
        ]);

      // Owner + admin emails per account, straight from auth (service-role only).
      const recipientRows = await db.execute<{ account_id: string; email: string | null }>(sql`
        select m.account_id, u.email
        from public.account_members m
        join auth.users u on u.id = m.user_id
        where m.role in ('owner', 'admin')
      `);

      const byAccount = <T extends { accountId: string; n: number }>(rows: T[]) =>
        new Map(rows.map((r) => [r.accountId, r.n]));
      const liveMap = byAccount(liveAgents);
      const sentMap = byAccount(sends);
      const replyMap = byAccount(replyCounts);
      const meetingMap = byAccount(meetings);
      const intentMap = byAccount(intent);
      const qualifiedMap = byAccount(qualified);
      const pipelineMap = byAccount(activePipeline);
      const recipientMap = new Map<string, string[]>();
      for (const r of recipientRows) {
        if (!r.email) continue;
        const list = recipientMap.get(r.account_id) ?? [];
        list.push(r.email);
        recipientMap.set(r.account_id, list);
      }

      return accountRows.map((a) => ({
        accountId: a.id,
        accountName: a.name,
        weeklySummaryEnabled: a.enabled,
        liveAgents: liveMap.get(a.id) ?? 0,
        sent: sentMap.get(a.id) ?? 0,
        replies: replyMap.get(a.id) ?? 0,
        meetings: meetingMap.get(a.id) ?? 0,
        intentLeads: intentMap.get(a.id) ?? 0,
        qualified: qualifiedMap.get(a.id) ?? 0,
        pipelineValueCents:
          a.avgDealValueCents && a.avgDealValueCents > 0
            ? (pipelineMap.get(a.id) ?? 0) * a.avgDealValueCents
            : null,
        goalCents: a.goalCents,
        recipients: recipientMap.get(a.id) ?? [],
      }));
    },

    async stampLifecycleEmail(accountId: string, at: Date): Promise<void> {
      await db.update(accounts).set({ lifecycleLastEmailAt: at }).where(eq(accounts.id, accountId));
    },
  };
}

// ── LinkedIn connection health (account-health cron) ─────────────────────────

export function createAccountHealthStore(db: Db): AccountHealthStore {
  return {
    async listLinkedInAccounts() {
      const rows = await db
        .select({
          id: linkedinAccounts.id,
          accountId: linkedinAccounts.accountId,
          providerRef: linkedinAccounts.providerRef,
          status: linkedinAccounts.status,
          profileUrl: linkedinAccounts.profileUrl,
          createdAt: linkedinAccounts.createdAt,
        })
        .from(linkedinAccounts);
      const leadAgg = await db
        .select({ id: leads.linkedinAccountId, n: count() })
        .from(leads)
        .where(isNotNull(leads.linkedinAccountId))
        .groupBy(leads.linkedinAccountId);
      const assigned = new Map<string, number>();
      for (const r of leadAgg) if (r.id) assigned.set(r.id, r.n);
      return rows.map((r) => ({
        ...r,
        status: r.status as LinkedInAccountRow["status"],
        assignedLeads: assigned.get(r.id) ?? 0,
      }));
    },

    async setLinkedInAccountStatus(id, status) {
      await db
        .update(linkedinAccounts)
        .set(
          // a reconnect restarts the rule-04 ramp clock, same contract as the status webhook
          status === "active" ? { status, connectedAt: new Date() } : { status }
        )
        .where(eq(linkedinAccounts.id, id));
    },

    async reassignSenderHistory(fromIds, toId) {
      if (fromIds.length === 0) return;
      await db
        .update(leads)
        .set({ linkedinAccountId: toId })
        .where(inArray(leads.linkedinAccountId, fromIds));
      await db
        .update(outreachSends)
        .set({ linkedinAccountId: toId })
        .where(inArray(outreachSends.linkedinAccountId, fromIds));
    },

    async deleteLinkedInAccountRows(ids) {
      if (ids.length === 0) return;
      await db.delete(linkedinAccounts).where(inArray(linkedinAccounts.id, ids));
    },

    async repointLinkedInAccount(id, providerRef) {
      await db
        .update(linkedinAccounts)
        .set({ providerRef, status: "active", connectedAt: new Date() })
        .where(eq(linkedinAccounts.id, id));
    },

    async getAccountAdminEmails(accountId) {
      // Owner + admin emails straight from auth (service-role only) — same lane as the
      // weekly summary; alerts are product notifications, never cold outreach (rule 11 N/A).
      const rows = await db.execute<{ email: string | null }>(sql`
        select u.email
        from public.account_members m
        join auth.users u on u.id = m.user_id
        where m.account_id = ${accountId} and m.role in ('owner', 'admin')
      `);
      return [...new Set(rows.map((r) => r.email).filter((e): e is string => Boolean(e)))];
    },
  };
}

// Stale-reply safeguard — escalates orphaned respondable replies to needs_human (see reply-backlog.ts).
export function createReplyBacklogStore(db: Db): ReplyBacklogStore {
  return {
    async getStaleUnansweredReplies(now: Date, staleMs: number, lookbackMs: number) {
      const staleBefore = new Date(now.getTime() - staleMs);
      const lookbackAfter = new Date(now.getTime() - lookbackMs);
      return db
        .select({
          accountId: replies.accountId,
          leadId: replies.leadId,
          receivedAt: replies.receivedAt,
        })
        .from(replies)
        .where(
          and(
            inArray(replies.classification, ["interested", "neutral", "other"]),
            lt(replies.receivedAt, staleBefore),
            gt(replies.receivedAt, lookbackAfter),
            // no agent message delivered AFTER this reply (updated_at is markSent's delivery stamp)
            sql`not exists (select 1 from ${scheduledSends} s where s.lead_id = ${replies.leadId} and s.linkedin_stage = 'message' and s.status = 'sent' and s.updated_at > ${replies.receivedAt})`,
            // nothing queued/in-flight to answer it (a review-mode draft awaiting approval counts)
            sql`not exists (select 1 from ${scheduledSends} s where s.lead_id = ${replies.leadId} and s.linkedin_stage = 'message' and s.status in ('pending_review','approved','scheduled','sending'))`,
            // not human-handled (paused_reply) or terminal (converted win / stopped) for any run
            sql`not exists (select 1 from ${sequenceRuns} sr where sr.lead_id = ${replies.leadId} and sr.status in ('paused_reply','converted','stopped'))`,
            // no needs_human alert already raised since this reply — the once-per-reply idempotency guard
            sql`not exists (select 1 from ${leadNotifications} n where n.lead_id = ${replies.leadId} and n.kind = 'needs_human' and n.created_at >= ${replies.receivedAt})`
          )
        )
        .orderBy(desc(replies.receivedAt))
        .limit(500);
    },

    async insertLeadNotification(n) {
      await db.insert(leadNotifications).values({
        accountId: n.accountId,
        leadId: n.leadId,
        kind: n.kind,
        body: n.body,
      });
    },
  };
}

// Lifecycle outreach (0045). Operator-side — every method runs as service role; the
// lifecycle_touches table has no client policies by design.
export function createLifecycleStore(db: Db): LifecycleStore {
  const DAY = 86_400_000;
  const readSetting = async (key: string): Promise<unknown> => {
    const [row] = await db.select().from(appSettings).where(eq(appSettings.key, key));
    return row?.value;
  };

  // owner + profile + best LinkedIn URL for a set of accounts — shared by the scans
  const candidateSql = (where: ReturnType<typeof sql>) => sql`
    select m.user_id as "userId", a.id as "accountId", p.display_name as "displayName",
           coalesce(x.profile_url, a.onboarding_linkedin_url) as "linkedinUrl"
    from public.accounts a
    join public.account_members m on m.account_id = a.id and m.role = 'owner'
    left join public.user_profiles p on p.user_id = m.user_id
    left join lateral (
      select la.profile_url from public.linkedin_accounts la
      where la.account_id = a.id and la.profile_url is not null
      order by la.connected_at desc nulls last limit 1
    ) x on true
    where ${where}
  `;

  type ScanRow = { userId: string; accountId: string; displayName: string | null; linkedinUrl: string | null };

  return {
    async getLifecycleConfig() {
      const [enabled, senderRef, dailyCap, senderLocation, notifyEmail, lastRunAt] = await Promise.all([
        readSetting("lifecycle_outreach_enabled"),
        readSetting("lifecycle_sender_ref"),
        readSetting("lifecycle_daily_cap"),
        readSetting("lifecycle_sender_location"),
        readSetting("lifecycle_notify_email"),
        readSetting("lifecycle_last_run_at"),
      ]);
      return {
        enabled: enabled === true,
        senderRef: typeof senderRef === "string" && senderRef.length > 0 ? senderRef : null,
        dailyCap: typeof dailyCap === "number" && dailyCap >= 0 ? dailyCap : 10,
        senderLocation:
          typeof senderLocation === "string" && senderLocation.length > 0 ? senderLocation : "New York",
        notifyEmail: typeof notifyEmail === "string" && notifyEmail.length > 0 ? notifyEmail : null,
        lastRunAt: typeof lastRunAt === "string" ? new Date(lastRunAt) : null,
      };
    },

    async setLifecycleLastRun(now) {
      await db
        .insert(appSettings)
        .values({ key: "lifecycle_last_run_at", value: now.toISOString(), updatedAt: now })
        .onConflictDoUpdate({
          target: appSettings.key,
          set: { value: now.toISOString(), updatedAt: now },
        });
    },

    async isKillSwitchOn() {
      return (await readSetting("outreach_kill_switch")) === true;
    },

    async getSenderRow(providerRef) {
      const [row] = await db
        .select({
          accountId: linkedinAccounts.accountId,
          status: linkedinAccounts.status,
          connectedAt: linkedinAccounts.connectedAt,
        })
        .from(linkedinAccounts)
        .where(eq(linkedinAccounts.providerRef, providerRef));
      return row ?? null;
    },

    async getAccountOwnerEmails(accountId) {
      // admin-pin guard — same auth.users lane as getAccountAdminEmails, owners only
      const rows = await db.execute<{ email: string | null }>(sql`
        select u.email
        from public.account_members m
        join auth.users u on u.id = m.user_id
        where m.account_id = ${accountId} and m.role = 'owner'
      `);
      return [...new Set(rows.map((r) => r.email).filter((e): e is string => Boolean(e)))];
    },

    async scanStalledOnboarding(now, excludeAccountId) {
      // The onboarding wizard writes onboarding_icp + revenue_goal_cents atomically WITH
      // onboarding_completed_at (they land in the same final-step write) — so every stalled
      // account has onboarding_icp = null regardless of how far it actually got. Those columns
      // can't distinguish stall points; the only mid-wizard signal is whether a linkedin_accounts
      // row exists (a separate, earlier step), so that's the one fork we can honestly report.
      const rows = await db.execute<ScanRow & { hasLinkedin: boolean }>(
        sql`
          select m.user_id as "userId", a.id as "accountId", p.display_name as "displayName",
                 coalesce(x.profile_url, a.onboarding_linkedin_url) as "linkedinUrl",
                 exists(select 1 from public.linkedin_accounts la2 where la2.account_id = a.id) as "hasLinkedin"
          from public.accounts a
          join public.account_members m on m.account_id = a.id and m.role = 'owner'
          left join public.user_profiles p on p.user_id = m.user_id
          left join lateral (
            select la.profile_url from public.linkedin_accounts la
            where la.account_id = a.id and la.profile_url is not null
            order by la.connected_at desc nulls last limit 1
          ) x on true
          where a.onboarding_completed_at is null
            and a.created_at < ${new Date(now.getTime() - 2 * DAY)}
            and a.id <> ${excludeAccountId}
        `
      );
      return rows.map((r) => ({
        userId: r.userId,
        accountId: r.accountId,
        displayName: r.displayName,
        linkedinUrl: r.linkedinUrl,
        stalledStep: r.hasLinkedin ? "the final details step" : "connecting your LinkedIn",
      }));
    },

    async scanIdleAfterOnboarding(now, excludeAccountId) {
      // v1 proxy (no last-seen tracking exists): owner's last sign-in ≈ signup and the
      // account is >3 days old → they completed onboarding and never came back.
      const rows = await db.execute<ScanRow>(candidateSql(sql`
        a.onboarding_completed_at is not null
        and a.created_at < ${new Date(now.getTime() - 3 * DAY)}
        and a.id <> ${excludeAccountId}
        and exists (
          select 1 from auth.users u
          where u.id = m.user_id
            and u.last_sign_in_at is not null
            and u.last_sign_in_at < u.created_at + interval '24 hours'
        )
      `));
      return rows.map((r) => ({ ...r, stalledStep: null }));
    },

    async scanTrialLapsedBackfill(now, excludeAccountId) {
      // accounts that lapsed BEFORE this feature shipped; live lapses ride trial-expiry chaining
      // LOAD-BEARING: this scan runs EVERY run (not first-run-only). Re-enqueueing a lapsed user
      // is what triggers enqueueTouch's supersede for A/B rows created AFTER the C row (e.g. the
      // same-day idle scan) — do not optimize this to a one-shot.
      const rows = await db.execute<ScanRow>(candidateSql(sql`
        a.subscription_status = 'none' and a.plan = 'none' and a.stripe_subscription_id is null
        and a.trial_ends_at is not null
        and a.trial_ends_at < ${now} and a.trial_ends_at > ${new Date(now.getTime() - 60 * DAY)}
        and a.id <> ${excludeAccountId}
      `));
      return rows.map((r) => ({ ...r, stalledStep: null }));
    },

    async enqueueTouch(c, segment, touchNumber) {
      await db
        .insert(lifecycleTouches)
        .values({
          userId: c.userId,
          accountId: c.accountId,
          segment,
          touchNumber,
          linkedinUrl: c.linkedinUrl,
          displayName: c.displayName,
          stalledStep: c.stalledStep,
        })
        .onConflictDoNothing();

      if (segment === "trial_lapsed") {
        // carry a pending invite's state onto the C row so it waits for the acceptance instead of re-inviting
        await db.execute(sql`
          update public.lifecycle_touches c
          set invite_sent_at = coalesce(c.invite_sent_at, s.invite_sent_at),
              target_provider_ref = coalesce(c.target_provider_ref, s.target_provider_ref),
              connected_at = coalesce(c.connected_at, s.connected_at),
              status = case when c.status = 'pending' and s.status = 'invited' and s.connected_at is null then 'invited' else c.status end
          from public.lifecycle_touches s
          where c.user_id = s.user_id
            and c.segment = 'trial_lapsed' and c.touch_number = 1
            and s.segment <> 'trial_lapsed' and s.status in ('pending', 'invited')
            and c.user_id = ${c.userId}
        `);
        // C supersedes A/B (spec) — same rule as the trial-expiry chained path
        // runs even when the insert conflicts — that unconditional sweep is what cancels later-created A/B rows
        await db.execute(sql`
          update public.lifecycle_touches
          set status = 'canceled'
          where user_id = ${c.userId} and segment <> 'trial_lapsed' and status in ('pending', 'invited')
        `);
      }
    },

    async enqueueDueFollowUps(now) {
      const rows = await db.execute<{ id: string }>(sql`
        insert into public.lifecycle_touches
          (user_id, account_id, segment, touch_number, linkedin_url, target_provider_ref,
           display_name, stalled_step, connected_at)
        select t.user_id, t.account_id, t.segment, 2, t.linkedin_url, t.target_provider_ref,
               t.display_name, t.stalled_step, coalesce(t.connected_at, t.sent_at)
        from public.lifecycle_touches t
        where t.touch_number = 1 and t.status = 'sent' and t.replied_at is null
          and t.sent_at < ${new Date(now.getTime() - 4 * DAY)}
          and not exists (
            select 1 from public.lifecycle_touches t2
            where t2.user_id = t.user_id and t2.segment = t.segment and t2.touch_number = 2
          )
        on conflict do nothing
        returning id
      `);
      return rows.length;
    },

    async getDueTouches(now, limit) {
      // named interfaces have no implicit index signature (unlike object literals), so the
      // generic must be intersected with Record<string, unknown> to satisfy db.execute's constraint
      const rows = await db.execute<LifecycleDueTouch & Record<string, unknown>>(sql`
        select t.id, t.user_id as "userId", t.account_id as "accountId", t.segment,
               t.touch_number as "touchNumber", t.linkedin_url as "linkedinUrl",
               t.display_name as "displayName", t.stalled_step as "stalledStep",
               (t.invite_sent_at is not null) as "inviteSent",
               (t.connected_at is not null) as "connected",
               coalesce(l.total, 0)::int as "leadCount", coalesce(l.qualified, 0)::int as "qualifiedCount"
        from public.lifecycle_touches t
        left join lateral (
          select count(*)::int as total,
                 (count(*) filter (where ai_score >= 70))::int as qualified
          from public.leads where account_id = t.account_id
        ) l on true
        where t.status = 'pending'
          and not exists (
            -- replied ever = never auto-message again (global); the 30-day recency
            -- cooldown is CROSS-segment only, so a chain's own touch-1 never blocks its touch-2
            select 1 from public.lifecycle_touches x
            where x.user_id = t.user_id
              and (x.replied_at is not null
                   or (x.segment <> t.segment and x.sent_at is not null and x.sent_at > ${new Date(now.getTime() - 30 * DAY)}))
          )
        order by t.created_at asc
        limit ${limit}
      `);
      return [...rows];
    },

    async markTouchSent(id, patch) {
      await db
        .update(lifecycleTouches)
        .set({
          status: "sent",
          messageRef: patch.messageRef,
          messageBody: patch.body,
          sentAt: patch.sentAt,
          ...(patch.targetProviderRef ? { targetProviderRef: patch.targetProviderRef } : {}),
        })
        .where(eq(lifecycleTouches.id, id));
    },

    async markTouchInvited(id, targetProviderRef, now) {
      await db
        .update(lifecycleTouches)
        .set({
          status: "invited",
          inviteSentAt: now,
          ...(targetProviderRef ? { targetProviderRef } : {}),
        })
        .where(eq(lifecycleTouches.id, id));
    },

    async markTouchFailed(id, error) {
      // one retry on the next run, then park — never hammer a personal account
      await db.execute(sql`
        update public.lifecycle_touches
        set attempts = attempts + 1, error = ${error},
            status = case when attempts + 1 >= 2 then 'failed' else 'pending' end
        where id = ${id}
      `);
    },

    async markTouchSkipped(id) {
      await db.update(lifecycleTouches).set({ status: "skipped_no_linkedin" }).where(eq(lifecycleTouches.id, id));
    },

    async recordLifecycleReply(who, now) {
      const userId = await matchLifecycleUser(db, who);
      if (!userId) return null;
      await db
        .update(lifecycleTouches)
        .set({ repliedAt: now })
        .where(and(eq(lifecycleTouches.userId, userId), eq(lifecycleTouches.status, "sent")));
      await db
        .update(lifecycleTouches)
        .set({ status: "canceled" })
        .where(and(eq(lifecycleTouches.userId, userId), inArray(lifecycleTouches.status, ["pending", "invited"])));
      const [p] = await db
        .select({ displayName: userProfiles.displayName })
        .from(userProfiles)
        .where(eq(userProfiles.userId, userId));
      return { userId, displayName: p?.displayName ?? null };
    },

    async recordLifecycleAcceptance(who, now) {
      const userId = await matchLifecycleUser(db, who);
      if (!userId) return false;
      await db.update(lifecycleTouches).set({ connectedAt: now }).where(eq(lifecycleTouches.userId, userId));
      await db
        .update(lifecycleTouches)
        .set({ status: "pending" })
        .where(and(eq(lifecycleTouches.userId, userId), eq(lifecycleTouches.status, "invited")));
      return true;
    },

    async enqueueTrialLapsedForAccounts(accountIds) {
      if (accountIds.length === 0) return 0;
      const rows = await db.execute<{ id: string }>(sql`
        insert into public.lifecycle_touches
          (user_id, account_id, segment, touch_number, linkedin_url, display_name)
        select m.user_id, a.id, 'trial_lapsed', 1,
               coalesce(x.profile_url, a.onboarding_linkedin_url), p.display_name
        from public.accounts a
        join public.account_members m on m.account_id = a.id and m.role = 'owner'
        left join public.user_profiles p on p.user_id = m.user_id
        left join lateral (
          select la.profile_url from public.linkedin_accounts la
          where la.account_id = a.id and la.profile_url is not null
          order by la.connected_at desc nulls last limit 1
        ) x on true
        where a.id in (${sql.join(accountIds.map((id) => sql`${id}`), sql`, `)})
        on conflict do nothing
        returning id
      `);

      // carry a pending invite's state onto the C row so it waits for the acceptance instead of re-inviting
      await db.execute(sql`
        update public.lifecycle_touches c
        set invite_sent_at = coalesce(c.invite_sent_at, s.invite_sent_at),
            target_provider_ref = coalesce(c.target_provider_ref, s.target_provider_ref),
            connected_at = coalesce(c.connected_at, s.connected_at),
            status = case when c.status = 'pending' and s.status = 'invited' and s.connected_at is null then 'invited' else c.status end
        from public.lifecycle_touches s, public.account_members m
        where m.account_id in (${sql.join(accountIds.map((id) => sql`${id}`), sql`, `)})
          and m.role = 'owner'
          and c.user_id = m.user_id
          and c.user_id = s.user_id
          and c.segment = 'trial_lapsed' and c.touch_number = 1
          and s.segment <> 'trial_lapsed' and s.status in ('pending', 'invited')
      `);

      // C supersedes A/B (spec): a lapsed user's other-segment queue is dead copy now
      await db.execute(sql`
        update public.lifecycle_touches t
        set status = 'canceled'
        from public.account_members m
        where m.account_id in (${sql.join(accountIds.map((id) => sql`${id}`), sql`, `)})
          and m.role = 'owner'
          and t.user_id = m.user_id
          and t.segment <> 'trial_lapsed'
          and t.status in ('pending', 'invited')
      `);

      return rows.length;
    },
  };
}

/** Reply/acceptance → lifecycle user: provider ref first (strong key), normalized URL fallback. */
async function matchLifecycleUser(
  db: Db,
  who: { providerRef: string | null; profileUrl: string }
): Promise<string | null> {
  if (who.providerRef) {
    const [r] = await db
      .select({ userId: lifecycleTouches.userId })
      .from(lifecycleTouches)
      .where(eq(lifecycleTouches.targetProviderRef, who.providerRef))
      .limit(1);
    if (r) return r.userId;
  }
  const norm = normalizeLinkedInUrl(who.profileUrl);
  const candidates = await db
    .select({ userId: lifecycleTouches.userId, url: lifecycleTouches.linkedinUrl })
    .from(lifecycleTouches)
    .where(isNotNull(lifecycleTouches.linkedinUrl));
  return candidates.find((c) => c.url && normalizeLinkedInUrl(c.url) === norm)?.userId ?? null;
}

/** L3 lead-event emails: pref + owner/admin recipients + lead display name (one query lane). */
export function createLeadEventEmailStore(db: Db) {
  return {
    async getTargets(accountId: string, leadId: string) {
      const rows = await db.execute<{ email: string | null; enabled: boolean; name: string | null }>(sql`
        select u.email, a.lead_event_emails_enabled as enabled,
               (select nullif(trim(concat(l.first_name, ' ', l.last_name)), '') from public.leads l where l.id = ${leadId}) as name
        from public.accounts a
        join public.account_members m on m.account_id = a.id and m.role in ('owner','admin')
        join auth.users u on u.id = m.user_id
        where a.id = ${accountId}
      `);
      const list = [...rows];
      return {
        enabled: list.length > 0 && list[0]?.enabled !== false,
        leadName: list[0]?.name ?? "A prospect",
        emails: [...new Set(list.map((r) => r.email).filter((e): e is string => Boolean(e)))],
      };
    },
    async stampLifecycleEmail(accountId: string, at: Date): Promise<void> {
      // Same idiom as createTrialEndingStore.markTrialEndingNotified / createWeeklySummaryStore /
      // createPullbackStore.stampLifecycleEmail — feeds the pull-back collision guard (spec
      // 2026-07-18): a "meeting booked" email must block a "buyers matched your ICP" pull-back for
      // the next 48h, same as every other lifecycle sender.
      await db.update(accounts).set({ lifecycleLastEmailAt: at }).where(eq(accounts.id, accountId));
    },
  };
}

/** R5 trial-ending emails: due trials + owner/admin recipients + idempotence stamp. */
export function createTrialEndingStore(db: Db) {
  return {
    async getTrialEndingAccounts(now: Date, withinMs: number): Promise<TrialEndingAccount[]> {
      const until = new Date(now.getTime() + withinMs);
      const rows = await db.execute<{
        id: string;
        trial_ends_at: string;
        email: string | null;
        plan: string | null;
        has_card: boolean;
      }>(sql`
        select a.id, a.trial_ends_at, u.email, a.plan,
          (a.stripe_subscription_id is not null) as has_card
        from public.accounts a
        join public.account_members m on m.account_id = a.id and m.role in ('owner','admin')
        join auth.users u on u.id = m.user_id
        where a.subscription_status = 'trialing'
          and a.trial_ends_at is not null
          and a.trial_ends_at > ${now.toISOString()}
          and a.trial_ends_at <= ${until.toISOString()}
          and a.trial_ending_notified_at is null
          and a.lifecycle_emails_enabled = true
      `);
      const byId = new Map<string, TrialEndingAccount>();
      for (const r of [...rows]) {
        const cur = byId.get(r.id) ?? {
          id: r.id,
          trialEndsAt: r.trial_ends_at,
          emails: [],
          plan: r.plan ?? null,
          hasCard: Boolean(r.has_card),
        };
        if (r.email && !cur.emails.includes(r.email)) cur.emails.push(r.email);
        byId.set(r.id, cur);
      }
      return [...byId.values()];
    },
    /**
     * The idempotence write, and ONLY the idempotence write. Nothing else may ride along in this
     * UPDATE: runTrialEnding calls it after the emails have already gone out, so if this statement
     * throws, trial_ending_notified_at never lands and the agent-scheduler tick re-sends the same
     * trial-ending email every 15 minutes, forever. The pull-back collision-guard stamp used to be
     * folded in here — one unapplied migration (0060) away from turning `column
     * "lifecycle_last_email_at" does not exist` into exactly that outage. It now lives in its own
     * statement below.
     */
    async markTrialEndingNotified(ids: string[]): Promise<void> {
      if (ids.length === 0) return;
      await db
        .update(accounts)
        .set({ trialEndingNotifiedAt: new Date() })
        .where(inArray(accounts.id, ids));
    },
    /**
     * Collision-guard bookkeeping for the pull-back email (spec 2026-07-18): pull-back yields to
     * this email for 48h. A separate statement from the idempotence write above, and best-effort
     * at the call site — a failure here costs at worst one extra pull-back email, versus an
     * infinite re-send loop if it could take markTrialEndingNotified down with it.
     */
    async stampLifecycleEmails(ids: string[], at: Date): Promise<void> {
      if (ids.length === 0) return;
      await db.update(accounts).set({ lifecycleLastEmailAt: at }).where(inArray(accounts.id, ids));
    },
  };
}

/**
 * Pull-back email (spec 2026-07-18): stalled owners/admins with real drafts or leads waiting.
 * `drafts_waiting` outranks `leads_waiting` — a `leads_agg` account with any pending_review
 * scheduled_send is excluded from the leads branch. Ledger dedupe filters on
 * `channel = 'email'` so an armed LinkedIn lifecycle DM (0045) never blocks this email, and vice
 * versa. Same execute+group-into-Map idiom as getTrialEndingAccounts/getTargets above.
 *
 * Deviations from the task-4 brief's draft SQL (verified against the live schema, prod project
 * `batyjchztbrqzkcvhkmk`, and packages/db/src/schema.ts — see task-4-report.md for the full list):
 *   - `leads` has no `name`/`company` columns — built from `first_name`/`last_name` (matching
 *     getTargets' `concat` idiom above) and `company_name`.
 *   - The touch-number lateral was structurally wrong: it dropped a user's touch-1 row from its
 *     own WHERE clause once >72h old (neither `touch_number = 2` nor "recent"), which made
 *     `coalesce(next_touch, 1)` re-select touch 1 forever instead of ever advancing to touch 2.
 *     Rewritten as `touch_state`: derives touch_number directly from what's actually been sent
 *     (bool_or per touch_number) rather than filtering rows out of the aggregate first.
 *   - `leads_agg` was unfiltered by status — it would have counted rejected/in_campaign leads as
 *     "buyers that matched your ICP" (rule 06). Filtered to `status = 'qualified'`, keyed off
 *     `scored_at` (the moment a lead actually became "matched"); a drafted lead's status has
 *     already flipped to `in_campaign` by copy-draft, so this excludes it without needing to
 *     reference scheduled_sends directly.
 *   - Previews were a single generic "any 3 leads in the account" lateral shared by both
 *     segments — could name a rejected lead as a qualified "buyer", or a lead with no relation to
 *     the actual pending drafts. Split into two segment-scoped laterals (drafts: leads with a
 *     pending_review send, oldest first; leads: qualified leads, oldest-scored first).
 *   - `last_sign_in_at` is coalesced against `-infinity` before the never-returned comparison (now
 *     inside `account_return`) — a NULL (no recorded sign-in) must count as "never returned", not
 *     silently drop the row via NULL < timestamp.
 *
 * Fix round 1 (2026-07-18) — two defects that both broke "two touches, ever" on multi-seat or
 * multi-account setups (latent in prod today: 0 accounts have a second owner/admin, but team seats
 * are a shipped feature). Full rationale at each site below:
 *   - ledger identity per account was non-deterministic (the grouping loop took user_id from
 *     whichever owner/admin row the plan emitted first) — now pinned by `canonical_user`.
 *   - `touch_state` now scopes the ledger join by `account_id`, matching migration 0060's
 *     email-lane index `(user_id, account_id, segment, touch_number) where channel = 'email'`.
 *
 * Fix round 2 (2026-07-18) — round 1 fixed ledger identity by collapsing `owner_users` to
 * `distinct on (account_id)`, which was never required and cost real reach. RESTORED: `owner_users`
 * is again ALL owner/admin members with an email, per the spec's "recipient selection follows
 * createTrialEndingStore / createLeadEventEmailStore" (and matching that sibling store, which never
 * collapsed). Determinism is now carried by a SEPARATE `canonical_user` CTE used for ledger
 * identity only — same total order round 1 established. Two admins therefore receive 2 emails while
 * the account still spends exactly 1 of its 2 touches: every guard in the spec (24h artifact floor,
 * 48h collision window, "two touches, ever") is account-scoped, not recipient-scoped. This matters
 * because `deps.send` is Resend-shaped — a dead address is accepted and bounces asynchronously
 * rather than throwing, so a single-recipient query burns a touch on mail nobody reads while a
 * reachable admin sits right there. See `account_return` for the matching never-returned decision.
 */
export function createPullbackStore(db: Db) {
  async function getPullbackCandidates(now: Date): Promise<PullbackRow[]> {
    const touch2Cutoff = new Date(now.getTime() - 72 * 3_600_000).toISOString();
    const rows = await db.execute<{
      account_id: string;
      user_id: string;
      email: string | null;
      segment: PullbackSegment;
      touch_number: number;
      item_count: number;
      oldest_at: string;
      draft_excerpt: string | null;
      lifecycle_emails_enabled: boolean;
      lifecycle_last_email_at: string | null;
      preview_name: string | null;
      preview_title: string | null;
      preview_company: string | null;
    }>(sql`
      with owner_users as (
        -- RECIPIENTS: every owner/admin of the account, per the spec ("recipient selection follows
        -- createTrialEndingStore / createLeadEventEmailStore: join account_members.role IN
        -- ('owner','admin') and auth.users.email"). Round 1 collapsed this to one user per account
        -- to make ledger identity deterministic; that goal is real but is met by canonical_user
        -- below, and collapsing here cost reach for nothing. deps.send is Resend-shaped — a dead
        -- address is ACCEPTED and bounces asynchronously instead of throwing — so a single-recipient
        -- query silently burns one of the account's only two touches on mail nobody reads, while a
        -- reachable second admin is right there. Emailing both costs the account nothing: the 24h
        -- artifact floor, the 48h collision window and the two-touch ceiling are all ACCOUNT-scoped.
        --
        -- Users with no email address are excluded here rather than downstream — they can never be
        -- a recipient, and (still true) one must never be able to win the canonical pick and
        -- silence an account that has a perfectly reachable second admin.
        --
        -- role_rank/joined_at are carried so canonical_user can order without re-reading the table.
        select m.account_id, m.user_id, u.email, u.last_sign_in_at,
               (case when m.role = 'owner' then 0 else 1 end) as role_rank,
               m.created_at as joined_at
        from public.account_members m
        join auth.users u on u.id = m.user_id
        where m.role in ('owner','admin')
          and u.email is not null
      ),
      canonical_user as (
        -- LEDGER IDENTITY ONLY — never recipient selection. The original Critical: the grouping
        -- loop keyed rows by account+segment but took user_id from whichever owner/admin row the
        -- plan emitted first, so on a two-seat account one ledger row was written under an
        -- arbitrary user and the OTHER user still read as "no touch 1" on the next tick — the
        -- account was re-sent touch 1, breaking "two touches, ever".
        --
        -- Pinning exactly one user per account closes that with no product change: it is the row
        -- key for touch_state, the lifecycle_touches write, and the unsubscribe token's signed
        -- userId (opt-out is account-scoped via accounts.lifecycle_emails_enabled, so a single
        -- signed identity is correct however many people were emailed). The order is total and
        -- plan-independent:
        --   1. owner before admin  — the account's actual principal
        --   2. earliest joined     — the founding seat when there are two owners
        --   3. user_id ascending   — the final tiebreak; two members can share a created_at
        --                            (same-transaction seeding), and (account_id, user_id) is the
        --                            account_members PK, so this can never tie.
        select distinct on (o.account_id) o.account_id, o.user_id
        from owner_users o
        order by o.account_id, o.role_rank, o.joined_at asc, o.user_id asc
      ),
      account_return as (
        -- NEVER-RETURNED PREDICATE, evaluated per ACCOUNT across ALL owner/admins (fix round 2).
        -- Round 1 evaluated it against the canonical user alone, which silently narrowed the
        -- product: an account whose owner returned but whose admin did not stopped being emailed.
        -- Both narrowings are wrong, but in opposite directions, so the question has to be answered
        -- deliberately rather than inherited from whichever row survived a distinct-on.
        --
        -- DECISION: "nobody came back" means NO owner/admin came back — max(last_sign_in_at) across
        -- the account's owner/admins. If ANY of them signed in after the artifact appeared, the
        -- value WAS seen inside the account and no pull-back is owed; emailing the other seats then
        -- would be telling people about something a colleague has already looked at. That is the
        -- least-spammy correct reading and matches the spec's premise ("the value already exists
        -- and was never shown"). max() over the coalesced value keeps NULL = never signed in =
        -- '-infinity' rather than letting a NULL swallow the aggregate.
        select o.account_id,
               max(coalesce(o.last_sign_in_at, '-infinity'::timestamptz)) as last_return_at
        from owner_users o
        group by o.account_id
      ),
      drafts as (
        select s.account_id, count(*)::int as item_count, min(s.created_at) as oldest_at
        from public.scheduled_sends s
        where s.status = 'pending_review'
        group by s.account_id
      ),
      leads_agg as (
        select l.account_id, count(*)::int as item_count, min(l.scored_at) as oldest_at
        from public.leads l
        where l.status = 'qualified'
        group by l.account_id
      ),
      base as (
        -- One row per (account, segment, RECIPIENT). user_id is the canonical user, so every row
        -- of a group carries the same ledger identity while email varies — that is exactly what
        -- lets the grouping loop below build a multi-address emails array off a stable userId.
        select a.id as account_id, c.user_id, o.email,
               'drafts_waiting'::text as segment,
               d.item_count, d.oldest_at,
               a.lifecycle_emails_enabled, a.lifecycle_last_email_at
        from public.accounts a
        join owner_users o on o.account_id = a.id
        join canonical_user c on c.account_id = a.id
        join account_return r on r.account_id = a.id
        join drafts d on d.account_id = a.id
        where r.last_return_at < d.oldest_at
        union all
        select a.id, c.user_id, o.email,
               'leads_waiting'::text,
               g.item_count, g.oldest_at,
               a.lifecycle_emails_enabled, a.lifecycle_last_email_at
        from public.accounts a
        join owner_users o on o.account_id = a.id
        join canonical_user c on c.account_id = a.id
        join account_return r on r.account_id = a.id
        join leads_agg g on g.account_id = a.id
        where r.last_return_at < g.oldest_at
          and not exists (select 1 from drafts d where d.account_id = a.id)
      ),
      touch_state as (
        -- ACCOUNT-SCOPED LEDGER (fix, 2026-07-18). The join used to match on user+segment+channel
        -- only, while everything around it is keyed per ACCOUNT. A user who owns two accounts
        -- therefore shared one ledger state across both: both accounts emailed on the same tick,
        -- recordTouch fired twice, and the second insert was silently discarded by
        -- onConflictDoNothing against a user-only unique index — leaving account B un-ledgered and
        -- eligible forever. Migration 0060's email-lane index is (user_id, account_id, segment,
        -- touch_number) so the write survives; this predicate is the read side of the same fix.
        -- Keyed off canonical_user (one row per account/segment), NOT owner_users: the ledger is
        -- account state, so a second admin must not get his own independent touch-1 allowance.
        select c.account_id, c.user_id, seg.segment,
          case
            when not coalesce(bool_or(lt.touch_number = 1), false) then 1
            when not coalesce(bool_or(lt.touch_number = 2), false)
                 and max(lt.sent_at) filter (where lt.touch_number = 1) < ${touch2Cutoff}
              then 2
            else null
          end::int as touch_number
        from canonical_user c
        cross join (values ('drafts_waiting'), ('leads_waiting')) as seg(segment)
        left join public.lifecycle_touches lt
          on lt.user_id = c.user_id
         and lt.account_id = c.account_id
         and lt.segment = seg.segment
         and lt.channel = 'email'
        group by c.account_id, c.user_id, seg.segment
      )
      select b.account_id, b.user_id, b.email, b.segment,
             ts.touch_number,
             b.item_count, b.oldest_at,
             b.lifecycle_emails_enabled, b.lifecycle_last_email_at,
             (select s.body
                from public.scheduled_sends s
                where s.account_id = b.account_id and s.status = 'pending_review'
                order by (case when s.linkedin_stage = 'message' then 0 else 1 end), s.created_at asc
                limit 1) as draft_excerpt,
             coalesce(p.name, p2.name) as preview_name,
             coalesce(p.title, p2.title) as preview_title,
             coalesce(p.company, p2.company) as preview_company
      from base b
      join touch_state ts
        on ts.account_id = b.account_id and ts.user_id = b.user_id and ts.segment = b.segment
      left join lateral (
        select nullif(trim(concat(l.first_name, ' ', l.last_name)), '') as name,
               l.title, l.company_name as company, min(s.created_at) as sort_at
        from public.scheduled_sends s
        join public.leads l on l.id = s.lead_id
        where s.account_id = b.account_id and s.status = 'pending_review' and b.segment = 'drafts_waiting'
        group by l.id, l.first_name, l.last_name, l.title, l.company_name
        order by min(s.created_at) asc
        limit 3
      ) p on true
      left join lateral (
        select nullif(trim(concat(l.first_name, ' ', l.last_name)), '') as name,
               l.title, l.company_name as company, l.scored_at as sort_at
        from public.leads l
        where l.account_id = b.account_id and l.status = 'qualified' and b.segment = 'leads_waiting'
        order by l.scored_at asc
        limit 3
      ) p2 on true
      where ts.touch_number is not null
      -- A lateral's internal ORDER BY does not survive the join, so the previews array was built in
      -- whatever order the plan emitted — the same email could name the same three people in a
      -- different order on touch 1 and touch 2. Ordering by the lateral's own sort key (oldest
      -- artifact first, the order each lateral already picked its 3 rows in) makes the composed
      -- copy reproducible. Not a correctness bug like the two above, but the same class of
      -- "incidental plan order leaked into output".
      --
      -- b.email is the final tiebreak (fix round 2). With recipients restored, each (account,
      -- segment) group emits one row per recipient PER preview; both laterals are recipient-
      -- independent, so without this the N recipient rows sharing a preview key came back in plain
      -- plan order and the emails array was assembled non-deterministically. (account_id,
      -- segment, preview name, email) is unique, so the full key is now total.
      order by b.account_id, b.segment,
               coalesce(p.sort_at, p2.sort_at) asc nulls last,
               coalesce(p.name, p2.name) asc nulls last,
               b.email asc
    `);

    const byKey = new Map<string, PullbackRow>();
    for (const r of [...rows]) {
      const key = `${r.account_id}:${r.segment}`;
      const cur =
        byKey.get(key) ??
        ({
          accountId: r.account_id,
          userId: r.user_id,
          emails: [],
          segment: r.segment,
          touchNumber: (r.touch_number === 2 ? 2 : 1) as 1 | 2,
          itemCount: r.item_count,
          previews: [],
          draftExcerpt: r.draft_excerpt,
          oldestArtifactAt: r.oldest_at,
          lifecycleEmailsEnabled: r.lifecycle_emails_enabled,
          lifecycleLastEmailAt: r.lifecycle_last_email_at,
        } satisfies PullbackRow);
      if (r.email && !cur.emails.includes(r.email)) cur.emails.push(r.email);
      if (r.preview_name && !cur.previews.some((p) => p.name === r.preview_name)) {
        cur.previews.push({
          name: r.preview_name,
          title: r.preview_title,
          company: r.preview_company,
        });
      }
      byKey.set(key, cur);
    }
    return [...byKey.values()];
  }

  return {
    getPullbackCandidates,
    async recordTouch(touch: PullbackTouch): Promise<void> {
      await db
        .insert(lifecycleTouches)
        .values({
          userId: touch.userId,
          accountId: touch.accountId,
          segment: touch.segment,
          touchNumber: touch.touchNumber,
          channel: "email",
          status: "sent",
          messageBody: touch.messageBody,
          sentAt: new Date(),
        })
        .onConflictDoNothing();
    },
    async stampLifecycleEmail(accountId: string, at: Date): Promise<void> {
      await db
        .update(accounts)
        .set({ lifecycleLastEmailAt: at })
        .where(eq(accounts.id, accountId));
    },
  };
}

/**
 * Thread sync (0073) store — the rotation over contacted leads' LinkedIn threads. Service role,
 * cross-tenant by design (a system job, like the scheduler): every row carries its own accountId
 * and the inbound handler re-derives the tenant from the connected identity anyway.
 */
export function createThreadSyncStore(db: Db): ThreadSyncStore {
  return {
    async listThreadSyncCandidates(perAccount: number) {
      // The lead's assigned sender seat when it has one; else its tenant's ONLY active seat (a
      // lead matched by an inbound message before any send). Ambiguous → skipped, never guessed.
      const rows = (await db.execute(sql`
        with cand as (
          select l.id as lead_id, l.account_id, l.linkedin_provider_ref as attendee,
            coalesce(
              (select la.provider_ref from ${linkedinAccounts} la
                where la.id = l.linkedin_account_id and la.status = 'active'),
              (select min(la.provider_ref) from ${linkedinAccounts} la
                where la.account_id = l.account_id and la.status = 'active'
                having count(*) = 1)
            ) as seat,
            l.linkedin_thread_synced_at as synced_at
          from ${leads} l
          where l.linkedin_provider_ref is not null
        ), ranked as (
          select *, row_number() over (partition by seat order by synced_at asc nulls first, lead_id) as rn
          from cand where seat is not null
        )
        select lead_id, account_id, attendee, seat from ranked where rn <= ${perAccount}
      `)) as unknown as { lead_id: string; account_id: string; attendee: string; seat: string }[];
      return rows.map((r) => ({
        leadId: r.lead_id,
        accountId: r.account_id,
        attendeeProviderRef: r.attendee,
        connectedAccountRef: r.seat,
      }));
    },

    async markThreadSynced(leadId: string, at: Date) {
      await db.update(leads).set({ linkedinThreadSyncedAt: at }).where(eq(leads.id, leadId));
    },
  };
}

/**
 * Conversation intelligence store (0074). Service role, cross-tenant by design like the other
 * pipeline stores: every call carries its own accountId and every write re-states it.
 */
export function createConversationStore(db: Db): ConversationStore {
  const MODES: readonly ConversationMode[] = ["off", "shadow", "live_replies", "live"];
  type PriorRow = {
    level: PriorCell["level"];
    phase: string;
    archetype: string;
    move: string;
    count: number;
    n: number;
    positives: number;
    rewardSum: number;
    rewardSq: number;
  };
  const toCell = (r: PriorRow, source: PriorCell["source"]): PriorCell => ({
    level: r.level,
    move: r.move as PriorCell["move"],
    phase: r.phase as PriorCell["phase"],
    archetype: r.archetype as PriorCell["archetype"],
    source,
    count: r.count,
    n: r.n,
    positives: r.positives,
    rewardSum: r.rewardSum,
    rewardSq: r.rewardSq,
  });

  return {
    async getConversationPolicyMode() {
      const [row] = await db.select().from(appSettings).where(eq(appSettings.key, "conversation_policy"));
      const v = row?.value;
      return typeof v === "string" && (MODES as readonly string[]).includes(v) ? (v as ConversationMode) : "off";
    },

    async getConversationState(accountId, leadId) {
      const [row] = await db
        .select({ state: conversationStates.state, ref: conversationStates.lastMessageRef })
        .from(conversationStates)
        .where(and(eq(conversationStates.accountId, accountId), eq(conversationStates.leadId, leadId)));
      return row ? { state: row.state as ConversationState, lastMessageRef: row.ref } : null;
    },

    async saveConversationState(accountId, leadId, state, lastMessageRef) {
      await db
        .insert(conversationStates)
        .values({ accountId, leadId, state, lastMessageRef })
        .onConflictDoUpdate({
          target: conversationStates.leadId,
          set: { state, lastMessageRef, updatedAt: new Date() },
          setWhere: eq(conversationStates.accountId, accountId),
        });
    },

    async listThreadTurns(accountId, leadId) {
      // Agent touches ordered by DELIVERY time, as getResponderBundle does.
      const sent = await db
        .select({
          id: scheduledSends.id,
          body: scheduledSends.body,
          stage: scheduledSends.linkedinStage,
          at: sql<Date>`coalesce((select max(o.sent_at) from ${outreachSends} o where o.scheduled_send_id = ${scheduledSends.id}), ${scheduledSends.updatedAt})`.mapWith(scheduledSends.updatedAt),
        })
        .from(scheduledSends)
        .where(
          and(
            eq(scheduledSends.accountId, accountId),
            eq(scheduledSends.leadId, leadId),
            inArray(scheduledSends.linkedinStage, ["invite", "message"]),
            eq(scheduledSends.status, "sent")
          )
        );
      const native = await db
        .select({ id: nativeMessages.id, body: nativeMessages.body, at: nativeMessages.sentAt })
        .from(nativeMessages)
        .where(and(eq(nativeMessages.accountId, accountId), eq(nativeMessages.leadId, leadId)));
      const got = await db
        .select({ id: replies.id, body: replies.body, at: replies.receivedAt })
        .from(replies)
        .where(
          and(
            eq(replies.accountId, accountId),
            eq(replies.leadId, leadId),
            // auto-responders aren't conversation
            or(isNull(replies.classification), ne(replies.classification, "out_of_office"))
          )
        );
      return turnsFromRows(
        sent.map((r) => ({ ...r, stage: r.stage as "invite" | "message" | null })),
        native,
        got
      );
    },

    async insertDecision(d) {
      const [row] = await db
        .insert(conversationDecisions)
        .values({
          ...(d.id ? { id: d.id } : {}),
          accountId: d.accountId,
          leadId: d.leadId,
          scheduledSendId: d.scheduledSendId,
          mode: d.mode,
          trigger: d.trigger,
          phase: d.phase,
          archetype: d.archetype,
          move: d.move,
          styleKey: d.styleKey,
          propensity: d.propensity,
          seed: d.seed,
          // legal_moves is an object { moves, degraded } so the policy's degraded reason rides
          // along without a new column; only the learner and the readout read the decision log.
          legalMoves: { moves: d.legalMoves, degraded: d.degraded },
          vetoes: d.vetoes,
          stateSnapshot: d.stateSnapshot,
          composedBody: d.composedBody,
          policyVersion: d.policyVersion,
          promptHash: d.promptHash,
        })
        .returning({ id: conversationDecisions.id });
      return row!.id;
    },

    async insertScheduledSendReturningId(send) {
      const [row] = await db
        .insert(scheduledSends)
        .values({ ...toRow(send), scheduledFor: send.notBefore ?? null })
        .returning({ id: scheduledSends.id });
      return row!.id;
    },

    async readPriors(accountId) {
      const acct = await db.select().from(conversationPriors).where(eq(conversationPriors.accountId, accountId));
      const glob = await db.select().from(conversationPriorsGlobal);
      return mergePriorTables(
        acct.map((r) => toCell(r, "real")),
        glob.map((r) => toCell(r, r.source))
      );
    },

    async upsertPriors(accountId, cells) {
      if (cells.length === 0) return;
      const now = new Date();
      const vals = (c: PriorCell) => ({
        level: c.level,
        phase: c.phase,
        archetype: c.archetype,
        move: c.move,
        count: c.count,
        n: c.n,
        positives: c.positives,
        rewardSum: c.rewardSum,
        rewardSq: c.rewardSq,
        updatedAt: now,
      });
      const replace = (c: PriorCell) => ({
        count: c.count,
        n: c.n,
        positives: c.positives,
        rewardSum: c.rewardSum,
        rewardSq: c.rewardSq,
        updatedAt: now,
      });
      await db.transaction(async (tx) => {
        for (const c of cells) {
          if (accountId) {
            await tx
              .insert(conversationPriors)
              .values({ accountId, ...vals(c) })
              .onConflictDoUpdate({
                target: [
                  conversationPriors.accountId,
                  conversationPriors.level,
                  conversationPriors.phase,
                  conversationPriors.archetype,
                  conversationPriors.move,
                ],
                set: replace(c),
              });
          } else {
            await tx
              .insert(conversationPriorsGlobal)
              .values({ ...vals(c), source: c.source })
              .onConflictDoUpdate({
                target: [
                  conversationPriorsGlobal.level,
                  conversationPriorsGlobal.phase,
                  conversationPriorsGlobal.archetype,
                  conversationPriorsGlobal.move,
                  conversationPriorsGlobal.source,
                ],
                set: replace(c),
              });
          }
        }
      });
    },

    async listUnscoredDecisions(olderThan, limit) {
      const rows = await db
        .select({
          id: conversationDecisions.id,
          accountId: conversationDecisions.accountId,
          leadId: conversationDecisions.leadId,
          scheduledSendId: conversationDecisions.scheduledSendId,
          decidedAt: conversationDecisions.decidedAt,
          move: conversationDecisions.move,
          phase: conversationDecisions.phase,
          archetype: conversationDecisions.archetype,
          propensity: conversationDecisions.propensity,
          composedBody: conversationDecisions.composedBody,
          sentBody: scheduledSends.body,
          sentAt: sql<Date | null>`(select max(o.sent_at) from ${outreachSends} o where o.scheduled_send_id = ${conversationDecisions.scheduledSendId})`.mapWith(outreachSends.sentAt),
        })
        .from(conversationDecisions)
        .leftJoin(scheduledSends, eq(scheduledSends.id, conversationDecisions.scheduledSendId))
        .where(
          and(
            eq(conversationDecisions.mode, "live"),
            isNull(conversationDecisions.scoredAt),
            lte(conversationDecisions.decidedAt, olderThan)
          )
        )
        .orderBy(asc(conversationDecisions.decidedAt))
        .limit(limit);
      return rows.map((r) => ({
        ...r,
        move: r.move as ScorableDecision["move"],
        phase: r.phase as ScorableDecision["phase"],
        archetype: r.archetype as ScorableDecision["archetype"],
        sentAt: r.sentAt ?? null,
      }));
    },

    async scoreDecision(id, outcome, reward) {
      await db
        .update(conversationDecisions)
        .set({ outcome, reward, scoredAt: new Date() })
        .where(eq(conversationDecisions.id, id));
    },

    async listConnectedWithoutFirstMessage(limit, { includeParked, decidedSince }) {
      // Every cheap exclusion lives in SQL, BEFORE the limit, so a stuck tail can never starve the
      // batch (the core's in-memory skips — no bundle, human-handled, suppressed — are defence only).
      // Guarantees, per returned lead:
      //  - connected (linkedin_connected_at set), newest acceptance first, under a live Outreach agent;
      //  - its NEWEST active sequence run supplies the campaign (one row per lead via the lateral join:
      //    sequence_runs is only unique on (campaign_id, lead_id));
      //  - no first_message decision at or after decidedSince (the cooldown: shadow and a live `wait`
      //    leave no message row, so without it the lead would be re-decided every tick);
      //  - the prospect has not spoken since our last delivered invite/message (non-OOO replies; the
      //    reply path answers those);
      //  - no message-stage row (excluding canceled) — or, with includeParked, none sent/sending, so
      //    a parked legacy draft still gets its shadow decision.
      const messageBlock = includeParked
        ? sql`s.status in ('sent', 'sending')`
        : sql`s.status <> 'canceled'`;
      const rows = (await db.execute(sql`
        select l.account_id, l.id as lead_id, sr.campaign_id
        from ${leads} l
        join lateral (
          select r.campaign_id from ${sequenceRuns} r
          where r.lead_id = l.id and r.account_id = l.account_id and r.status = 'active'
          order by r.created_at desc
          limit 1
        ) sr on true
        where l.linkedin_connected_at is not null
          and not exists (
            select 1 from ${scheduledSends} s
            where s.account_id = l.account_id and s.lead_id = l.id and s.linkedin_stage = 'message'
              and ${messageBlock}
          )
          and not exists (
            select 1 from ${conversationDecisions} d
            where d.account_id = l.account_id and d.lead_id = l.id and d.trigger = 'first_message'
              and d.decided_at >= ${decidedSince.toISOString()}::timestamptz
          )
          and not exists (
            select 1 from ${replies} rp
            where rp.account_id = l.account_id and rp.lead_id = l.id
              and (rp.classification is null or rp.classification <> 'out_of_office')
              and rp.received_at > coalesce((
                select max(coalesce(
                  (select max(o.sent_at) from ${outreachSends} o where o.scheduled_send_id = ss.id),
                  ss.updated_at
                ))
                from ${scheduledSends} ss
                where ss.account_id = l.account_id and ss.lead_id = l.id and ss.status = 'sent'
                  and ss.linkedin_stage in ('invite', 'message')
              ), '-infinity'::timestamptz)
          )
          and exists (
            select 1 from ${agents} a
            where a.account_id = l.account_id and a.kind = 'copy' and a.status = 'live'
          )
        order by l.linkedin_connected_at desc
        limit ${limit}
      `)) as unknown as { account_id: string; lead_id: string; campaign_id: string }[];
      return rows.map((r) => ({ accountId: r.account_id, leadId: r.lead_id, campaignId: r.campaign_id }));
    },
  };
}
