import { and, asc, count, desc, eq, gt, gte, inArray, isNotNull, isNull, lt, lte, max, or, sql } from "drizzle-orm";
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
  leadSignals,
  leads,
  lifecycleTouches,
  linkedinAccounts,
  outreachSends,
  proofPoints,
  replies,
  scheduledSends,
  sequenceRuns,
  suppressionEntries,
  appSettings,
  userProfiles,
  webhookEvents,
  optimizationExperiments,
  optimizationPlaybook,
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
  FunnelStageKey,
  LeadOutcomeFlags,
  ExperimentStatus,
} from "@vantera/agent-brains";
import {
  ALPHA_EARN_ON_CONCLUSION,
  ALPHA_WEALTH_CAP,
  ALPHA_WEALTH_START,
  buildTargetingProfile,
  describeStrategy,
  rankByTilt,
  toStoredInsights,
  wealthAfterConclusion,
  wealthAfterLaunch,
  type LeadInsights,
  type ProofPoint,
  type TargetingRow,
  type WebsiteScan,
} from "@vantera/agent-brains";
import { resolveEntitlements, TRIAL_DAYS, type EntitlementSnapshot } from "@vantera/billing";
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
  type ActiveExperiment,
  type ConversionStore,
  type ConnectionSyncStore,
  type OptimizeStore,
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
  type SendContext,
  type SendDispatchStore,
  type SequenceRunPatch,
  type SequenceStore,
  type SequenceTouchStore,
} from "./types";
import { normalizeLinkedInUrl } from "./copy-draft";
import { resolveSequenceConfig } from "./sequence-config";
import type { RefreshLeadLoad, RefreshLeadStore } from "./refresh-lead";
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
 * The account's most recent sent-message openers (first line, clipped) — injected into draft
 * prompts as "do not reuse" so a batch of drafts can't converge on one scaffold (69% of sends
 * had shared the same opener before this; AI-detectable templating is the category's #1
 * churn driver). Never used as grounding — see avoidBlock in @vantera/agent-brains.
 */
const AVOID_PHRASES_LIMIT = 10;
async function recentSendOpeners(db: Db, accountId: string): Promise<string[]> {
  const rows = await db
    .select({ body: scheduledSends.body })
    .from(scheduledSends)
    .where(
      and(
        eq(scheduledSends.accountId, accountId),
        eq(scheduledSends.status, "sent"),
        isNotNull(scheduledSends.body)
      )
    )
    .orderBy(desc(scheduledSends.updatedAt))
    .limit(AVOID_PHRASES_LIMIT);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of rows) {
    const opener = (r.body ?? "").split("\n")[0]!.slice(0, 70).trim();
    if (opener.length < 12 || seen.has(opener.toLowerCase())) continue;
    seen.add(opener.toLowerCase());
    out.push(opener);
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
    .where(and(eq(leads.accountId, accountId), isNotNull(leads.linkedinInvitedAt)));
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

/** The account's running experiment (self-optimizing loop, Phase 3), or null. Extracted to a plain
 *  function (rather than `this.getActiveExperiment`) so getResponderBundle can call it directly —
 *  this file's object-literal store never references sibling methods via `this`. */
async function fetchActiveExperiment(db: Db, accountId: string): Promise<ActiveExperiment | null> {
  const [row] = await db
    .select({
      id: optimizationExperiments.id,
      allocationPct: optimizationExperiments.allocationPct,
      challengerStrategy: optimizationExperiments.challengerStrategy,
    })
    .from(optimizationExperiments)
    .where(
      and(
        eq(optimizationExperiments.accountId, accountId),
        eq(optimizationExperiments.status, "running")
      )
    )
    .limit(1);
  if (!row) return null;
  return {
    id: row.id,
    allocationPct: row.allocationPct,
    challengerStrategy: (row.challengerStrategy ?? {}) as CopyStrategy,
  };
}

/** The account's adopted champion strategy + playbook version; {strategy:{}, version:null} when no
 *  playbook exists yet. Same extraction reason as fetchActiveExperiment above. */
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

/** The callback-argument type of `Db["transaction"]` — a `PgTransaction`, structurally close to
 *  `Db` but NOT assignable to it (it lacks `$client`). `debitAlphaWealth`/`creditAlphaWealth` are
 *  only ever called with the `tx` handed to a `db.transaction(...)` callback, never with plain
 *  `db`, so they're typed against this instead of `Db`. */
type OptimizeTx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/**
 * Debit `spend` from the account's alpha-investing wealth (Task 7 / WS-1.1). Upserts the playbook
 * row when this is the account's first-ever experiment (starting from `ALPHA_WEALTH_START` BEFORE
 * the debit — `wealthAfterLaunch`, mirroring `startExperiment`'s "never risked past what a fresh
 * account has" semantics); otherwise decrements the existing balance in SQL so the debit reads and
 * writes atomically against a concurrent credit. Callers always run this inside the SAME
 * transaction as the experiment insert (`startExperiment`) — a rolled-back insert (the one-live
 * 23505 conflict) rolls this debit back too, never leaving a spend with no experiment to show for it.
 */
async function debitAlphaWealth(tx: OptimizeTx, accountId: string, spend: number): Promise<void> {
  await tx
    .insert(optimizationPlaybook)
    .values({
      accountId,
      championStrategy: {},
      alphaWealth: wealthAfterLaunch(ALPHA_WEALTH_START, spend),
    })
    .onConflictDoUpdate({
      target: optimizationPlaybook.accountId,
      set: { alphaWealth: sql`${optimizationPlaybook.alphaWealth} - ${spend}` },
    });
}

/**
 * Credit `ALPHA_EARN_ON_CONCLUSION` back to the account's alpha-investing wealth on a DECISIVE
 * conclusion (Task 7 / WS-1.1), capped at `ALPHA_WEALTH_CAP`. Called from `concludeExperiment`
 * (discard only — halts are safety stops, not statistical conclusions, and do NOT earn; matching
 * calibration.test.ts's calibrated applyEarn rule) and `adoptChallenger`, and ONLY when the
 * caller's own status-guarded UPDATE actually returned a row (the experiment really did
 * transition out of running/ready_to_adopt) — a repeat call on an already-terminal experiment
 * never reaches here, which is what keeps the credit to exactly once per experiment. Upserts the
 * playbook row for the rare case an experiment was started outside this pipeline's debit path
 * (e.g. the manual web "start test" action) with no playbook row yet.
 */
async function creditAlphaWealth(tx: OptimizeTx, accountId: string): Promise<void> {
  await tx
    .insert(optimizationPlaybook)
    .values({
      accountId,
      championStrategy: {},
      alphaWealth: wealthAfterConclusion(ALPHA_WEALTH_START),
    })
    .onConflictDoUpdate({
      target: optimizationPlaybook.accountId,
      set: {
        alphaWealth: sql`least(${ALPHA_WEALTH_CAP}, ${optimizationPlaybook.alphaWealth} + ${ALPHA_EARN_ON_CONCLUSION})`,
      },
    });
}

/** Drizzle-backed store used by the Trigger.dev tasks (service-role DATABASE_URL). */
export function createPgStore(db: Db): ScoutStore & CopyDraftStore & SchedulerStore & RetentionStore & TrialStore & SendDispatchStore & OutreachSendStore & InboundStore & SequenceStore & SequenceTouchStore & ConversionStore & RefreshLeadStore & QualifyLeadStore & IntentScanStore & ConnectionSyncStore & OptimizeStore & AgentRunStore {
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
        .select({ id: agents.id })
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

    async upsertIntentLead(accountId, candidate) {
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
        })
        .returning({ id: leads.id });
      return { leadId: inserted!.id };
    },

    async saveIntentSignal(leadId, accountId, signal) {
      await db
        .insert(leadSignals)
        .values({
          accountId,
          leadId,
          kind: "intent",
          label: signal.label,
          detail: signal.detail,
          level: "active",
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
      // Stage 2: ordering = ai_score + the bounded outcome tilt (rankByTilt) so buyers like the
      // ones who actually replied/booked drain first. Ordering ONLY — the qualification gate and
      // the draft budget are unchanged, and an empty profile keeps pure score order.
      const rows = await db
        .select({
          id: leads.id,
          title: leads.title,
          industry: leads.industry,
          aiScore: leads.aiScore,
        })
        .from(leads)
        .where(and(eq(leads.accountId, accountId), eq(leads.status, "qualified")))
        .orderBy(desc(leads.aiScore), desc(leads.scoredAt));
      const targeting: TargetingRow[] = (await invitedOutcomeRows(db, accountId)).map((r) => ({
        title: r.title,
        industry: r.industry,
        flags: r.flags,
      }));
      const profile = buildTargetingProfile(targeting);
      return rankByTilt(rows, profile)
        .slice(0, limit)
        .map((r) => r.id);
    },

    async getIcpOutcomeRows(accountId: string) {
      return (await invitedOutcomeRows(db, accountId))
        .filter((r): r is typeof r & { icpId: string } => r.icpId != null)
        .map((r) => ({ icpId: r.icpId, flags: r.flags }));
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
        },
        avoidPhrases: await recentSendOpeners(db, agent.accountId),
        winningOpeners: await winningOpeners(db, agent.accountId),
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
      // back one from wherever it is, floored at 0. Exhausted/stopped runs come back active;
      // converted runs stay converted (the win is never reopened).
      //
      // paused_reply is EXCLUDED: that status means a human took the thread over (manual reply).
      // A later prospect reply must never silently re-arm automation on a human-driven thread —
      // only an explicit "resume automation" does that. (Human-takeover fix, 2026-07-10.)
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
            inArray(sequenceRuns.status, ["active", "exhausted", "stopped"])
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

    async getActiveExperiment(accountId) {
      return fetchActiveExperiment(db, accountId);
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

    async stampLeadExperiment(leadId, experimentId, variant) {
      await db
        .update(leads)
        .set({ experimentId, strategyVariant: variant })
        .where(eq(leads.id, leadId));
    },

    // ── OptimizeStore (decide pipeline) ──────────────────────────────────────

    async getRunningExperiments() {
      const rows = await db
        .select({
          id: optimizationExperiments.id,
          accountId: optimizationExperiments.accountId,
          stageKey: optimizationExperiments.stageKey,
          minSample: optimizationExperiments.minSample,
          championStrategy: optimizationExperiments.championStrategy,
          challengerStrategy: optimizationExperiments.challengerStrategy,
          alphaSpent: optimizationExperiments.alphaSpent,
        })
        .from(optimizationExperiments)
        .where(eq(optimizationExperiments.status, "running"));
      return rows.map((r) => ({
        id: r.id,
        accountId: r.accountId,
        stageKey: r.stageKey as FunnelStageKey,
        minSample: r.minSample,
        championStrategy: (r.championStrategy ?? {}) as CopyStrategy,
        challengerStrategy: (r.challengerStrategy ?? {}) as CopyStrategy,
        alphaSpent: r.alphaSpent,
      }));
    },

    async getArmFlags(experimentId, variant): Promise<LeadOutcomeFlags[]> {
      const armLeads = await db
        .select({
          id: leads.id,
          invitedAt: leads.linkedinInvitedAt,
          connectedAt: leads.linkedinConnectedAt,
          bookedAt: leads.meetingBookedAt,
          status: leads.status,
        })
        .from(leads)
        .where(and(eq(leads.experimentId, experimentId), eq(leads.strategyVariant, variant)));
      if (armLeads.length === 0) return [];
      const ids = armLeads.map((l) => l.id);
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
      return armLeads.map((l) => ({
        invited: l.invitedAt != null,
        accepted: l.connectedAt != null,
        interested: interested.has(l.id),
        negative: negative.has(l.id),
        booked: l.bookedAt != null,
        converted: l.status === "converted",
      }));
    },

    async getStampedOutcomes() {
      // Stage 1b collective prior: every SENT first-touch invite with a Stage-1 recipe stamp,
      // across ALL accounts (service role) — aggregate patterns only (strategy knobs + outcome
      // booleans). Message text and lead identity never leave this method.
      const rows = await db
        .select({
          strategy: sql<CopyStrategy | null>`${scheduledSends.recipe} -> 'strategy'`,
          leadId: scheduledSends.leadId,
          invitedAt: leads.linkedinInvitedAt,
          connectedAt: leads.linkedinConnectedAt,
          bookedAt: leads.meetingBookedAt,
          status: leads.status,
        })
        .from(scheduledSends)
        .innerJoin(leads, eq(leads.id, scheduledSends.leadId))
        .where(
          and(
            eq(scheduledSends.status, "sent"),
            eq(scheduledSends.linkedinStage, "invite"),
            sql`${scheduledSends.recipe} ->> 'brain' = 'first_touch'`
          )
        );
      if (rows.length === 0) return [];
      const ids = [...new Set(rows.map((r) => r.leadId).filter((v): v is string => Boolean(v)))];
      const replyRows = ids.length
        ? await db
            .select({ leadId: replies.leadId, classification: replies.classification })
            .from(replies)
            .where(inArray(replies.leadId, ids))
        : [];
      const interested = new Set<string>();
      const negative = new Set<string>();
      for (const r of replyRows) {
        if (r.classification === "interested") interested.add(r.leadId);
        else if (r.classification === "not_interested" || r.classification === "unsubscribe")
          negative.add(r.leadId);
      }
      return rows.map((r) => ({
        strategy: (r.strategy ?? {}) as CopyStrategy,
        flags: {
          invited: r.invitedAt != null,
          accepted: r.connectedAt != null,
          interested: r.leadId ? interested.has(r.leadId) : false,
          negative: r.leadId ? negative.has(r.leadId) : false,
          booked: r.bookedAt != null,
          converted: r.status === "converted",
        },
      }));
    },

    async getRecentConclusions(accountId, limit) {
      const rows = await db
        .select({
          challengerStrategy: optimizationExperiments.challengerStrategy,
          status: optimizationExperiments.status,
        })
        .from(optimizationExperiments)
        .where(
          and(
            eq(optimizationExperiments.accountId, accountId),
            inArray(optimizationExperiments.status, ["adopted", "discarded", "halted"])
          )
        )
        .orderBy(desc(optimizationExperiments.concludedAt))
        .limit(limit);
      return rows.map((r) => ({
        label: describeStrategy((r.challengerStrategy ?? {}) as CopyStrategy),
        status: r.status,
      }));
    },

    async concludeExperiment(id, status: ExperimentStatus, reason, opts) {
      // Task 7 / WS-1.1: credit the account's alpha-investing wealth on a DECISIVE conclusion —
      // guarded by the UPDATE's own `returning()` so a repeat call on an already-terminal
      // experiment (idempotency) credits nothing a second time. Two exclusions:
      //   - Halts do NOT earn: the calibrated family-wise evidence (calibration.test.ts's CHAINED
      //     FAMILY gate) defined "decisive" as the e-process actually reaching an adopt/discard
      //     conclusion — a breaker halt is a safety stop, not a statistical conclusion, and
      //     crediting it was measured to fund ~5.6-5.8 of 10 chain experiments vs the calibrated
      //     ~4.0 (the guarantee would stop describing production).
      //   - `opts.credit === false` (default true): the caller marks the conclusion
      //     ADMINISTRATIVE — the identical-arm heal path discards as cleanup, not as a verdict,
      //     and typically closes an unfunded manual experiment (crediting it would mint free
      //     wealth). See OptimizeStore.concludeExperiment's doc in types.ts.
      await db.transaction(async (tx) => {
        const [row] = await tx
          .update(optimizationExperiments)
          .set({ status, decisionReason: reason, concludedAt: new Date() })
          .where(
            and(
              eq(optimizationExperiments.id, id),
              inArray(optimizationExperiments.status, ["running", "ready_to_adopt"])
            )
          )
          .returning({ accountId: optimizationExperiments.accountId });
        if (row && status !== "halted" && opts?.credit !== false) {
          await creditAlphaWealth(tx, row.accountId);
        }
      });
    },

    async markReadyToAdopt(experimentId, reason) {
      // Mark only — no concludedAt, so the one-live-experiment unique index (which counts
      // ready_to_adopt as live) keeps the slot occupied until the owner's manual adopt action
      // applies the win. GATE 1 / WS-3.2: also stamps `readiedAt = now()` (migration 0059) — the
      // moment this mark happened, which starts the 24h auto-adopt grace clock
      // `getMatureReadyToAdopt` reads. A repeat mark (shouldn't happen in practice — an experiment
      // only ever gets one decisive verdict) would reset the clock, which is the correct behavior
      // if it ever did: the grace window is about time-since-suggested, not time-since-first-mark.
      await db
        .update(optimizationExperiments)
        .set({ status: "ready_to_adopt", decisionReason: reason, readiedAt: new Date() })
        .where(eq(optimizationExperiments.id, experimentId));
    },

    async adoptChallenger(experimentId, reason): Promise<CopyStrategy | null> {
      // Autonomous adoption (spec 2026-07-14): playbook champion ← challenger, version-bumped;
      // experiment → 'adopted'. Mirrors the manual adopt action's writes, run by the service role.
      //
      // Claim-first ordering (WS-3.2 race-condition fix, 2026-07-18): the status-guarded UPDATE
      // runs FIRST and is the only thing that decides whether this call writes anything at all.
      // The original ordering wrote the playbook unconditionally (guarded only by `if (exp)`,
      // true for ANY existing row regardless of status) and gated only the wealth credit on the
      // claim — so a race against the owner's manual dashboard actions (which also race this same
      // tick) could commit the playbook write (challenger becomes champion — real outreach copy
      // changes) even though the claim itself failed. Returning null means someone else already
      // transitioned the row in the exact tick window; the caller must treat the owner's action as
      // authoritative and write nothing.
      //
      // Task 7 / WS-1.1: also credits alpha-investing wealth — guarded the same way as
      // concludeExperiment (only reached once the claim above actually transitioned the row).
      return db.transaction(async (tx) => {
        const [claimed] = await tx
          .update(optimizationExperiments)
          .set({ status: "adopted", decisionReason: reason, concludedAt: new Date() })
          .where(
            and(
              eq(optimizationExperiments.id, experimentId),
              inArray(optimizationExperiments.status, ["running", "ready_to_adopt"])
            )
          )
          .returning({
            accountId: optimizationExperiments.accountId,
            challengerStrategy: optimizationExperiments.challengerStrategy,
          });
        if (!claimed) return null;

        const newChampion = ((claimed.challengerStrategy as CopyStrategy | null) ?? {}) as CopyStrategy;
        const [cur] = await tx
          .select({ version: optimizationPlaybook.version })
          .from(optimizationPlaybook)
          .where(eq(optimizationPlaybook.accountId, claimed.accountId))
          .limit(1);
        await tx
          .insert(optimizationPlaybook)
          .values({
            accountId: claimed.accountId,
            championStrategy: newChampion,
            version: (cur?.version ?? 0) + 1,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: optimizationPlaybook.accountId,
            set: {
              championStrategy: newChampion,
              version: (cur?.version ?? 0) + 1,
              updatedAt: new Date(),
            },
          });
        await creditAlphaWealth(tx, claimed.accountId);
        return newChampion;
      });
    },

    async startExperiment(input): Promise<boolean> {
      // The chained next test. The one-live-experiment partial unique index guards double-starts;
      // a conflict means another experiment is already live for the account — skip, never throw.
      // Task 7 / WS-1.1: debits alpha-investing wealth in the SAME transaction as the insert, so a
      // 23505 conflict (caught below) rolls the debit back too — never a spend with no experiment.
      try {
        await db.transaction(async (tx) => {
          await tx.insert(optimizationExperiments).values({
            accountId: input.accountId,
            stageKey: input.stageKey,
            championStrategy: input.champion,
            challengerStrategy: input.challenger,
            allocationPct: 25,
            minSample: 30,
            status: "running",
            alphaSpent: input.alphaSpent,
          });
          await debitAlphaWealth(tx, input.accountId, input.alphaSpent);
        });
        return true;
      } catch (err) {
        if ((err as { code?: string }).code === "23505") return false;
        throw err;
      }
    },

    async getAlphaWealth(accountId: string): Promise<number> {
      // Task 7 / WS-1.1: a missing playbook row means the account has never adopted anything —
      // that's the same "never tested before" state as a fresh account, so it gets the classical
      // single-test alpha rather than null/zero (which would look exhausted and pause forever).
      const [row] = await db
        .select({ alphaWealth: optimizationPlaybook.alphaWealth })
        .from(optimizationPlaybook)
        .where(eq(optimizationPlaybook.accountId, accountId))
        .limit(1);
      return row?.alphaWealth ?? ALPHA_WEALTH_START;
    },

    // ── GATE 1 auto-adopt (enterprise-grade-brain spec, WS-3.2) ───────────────

    async getAdoptionMode(): Promise<"auto" | "manual"> {
      // Global rollout knob — same appSettings/eq-by-key pattern as getBestOfN/isKillSwitchOn
      // above/below. 'manual' (suggest-only-forever, GATE 0's posture) is the default whenever
      // the row is absent OR holds anything other than the literal string 'auto' — an owner must
      // explicitly opt in for the auto-adopt pass to ever run.
      const [row] = await db.select().from(appSettings).where(eq(appSettings.key, "adoption_mode"));
      return row?.value === "auto" ? "auto" : "manual";
    },

    async getMatureReadyToAdopt(graceMs: number) {
      const cutoff = new Date(Date.now() - graceMs);
      const rows = await db
        .select({
          id: optimizationExperiments.id,
          accountId: optimizationExperiments.accountId,
          stageKey: optimizationExperiments.stageKey,
          minSample: optimizationExperiments.minSample,
          championStrategy: optimizationExperiments.championStrategy,
          challengerStrategy: optimizationExperiments.challengerStrategy,
          alphaSpent: optimizationExperiments.alphaSpent,
        })
        .from(optimizationExperiments)
        .where(
          and(
            eq(optimizationExperiments.status, "ready_to_adopt"),
            isNotNull(optimizationExperiments.readiedAt),
            lte(optimizationExperiments.readiedAt, cutoff)
          )
        );
      return rows.map((r) => ({
        id: r.id,
        accountId: r.accountId,
        stageKey: r.stageKey as FunnelStageKey,
        minSample: r.minSample,
        championStrategy: (r.championStrategy ?? {}) as CopyStrategy,
        challengerStrategy: (r.challengerStrategy ?? {}) as CopyStrategy,
        alphaSpent: r.alphaSpent,
      }));
    },

    // ── Live A/A canary (enterprise-grade-brain spec, WS-1.8) ─────────────────

    async getCanaryAccountId(): Promise<string | null> {
      const [row] = await db.select().from(appSettings).where(eq(appSettings.key, "aa_canary_account_id"));
      const v = row?.value;
      return typeof v === "string" && v.length > 0 ? v : null;
    },

    async ensureCanaryExperiment(accountId): Promise<boolean> {
      // Champion vs an IDENTICAL challenger — zero user-facing difference; 50/50 split for power.
      // Idempotent via the one-live unique index (23505 → already live, skip). Occupies the
      // account's single experiment slot by design (runs GATE 0 → GATE 1 on the pilot account).
      const [pb] = await db
        .select({ championStrategy: optimizationPlaybook.championStrategy })
        .from(optimizationPlaybook)
        .where(eq(optimizationPlaybook.accountId, accountId))
        .limit(1);
      const champion = ((pb?.championStrategy as CopyStrategy | null) ?? {}) as CopyStrategy;
      try {
        await db.insert(optimizationExperiments).values({
          accountId,
          stageKey: "reply",
          championStrategy: champion,
          challengerStrategy: champion,
          allocationPct: 50,
          minSample: 30,
          status: "running",
        });
        return true;
      } catch (err) {
        if ((err as { code?: string }).code === "23505") return false;
        throw err;
      }
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
        })
        .from(agents)
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
          or(
            eq(scheduledSends.status, "approved"),
            and(eq(scheduledSends.status, "scheduled"), lt(scheduledSends.scheduledFor, staleCutoff))
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
        subscriptionStatus: r.subscriptionStatus,
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

      const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      const since7 = new Date(now.getTime() - 7 * 86_400_000);

      // One scan of this tenant's last-7d LinkedIn sends (bounded: ≤ ~100/wk per account),
      // aggregated per sender in JS — today/7d invites, today messages, last-used recency.
      const sends = await db
        .select({
          liId: outreachSends.linkedinAccountId,
          stage: scheduledSends.linkedinStage,
          sentAt: outreachSends.sentAt,
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

      return accts.map((a) => {
        const mine = sends.filter((s) => s.liId === a.id);
        const sentToday = mine.filter((s) => s.stage === "invite" && s.sentAt >= dayStart).length;
        const last7d = mine.filter((s) => s.stage === "invite").length;
        const sentTodayMessages = mine.filter((s) => s.stage === "message" && s.sentAt >= dayStart).length;
        const lastAssignedAt = mine.reduce((m, s) => Math.max(m, s.sentAt.getTime()), 0);
        const ageDays = a.connectedAt
          ? Math.floor((now.getTime() - a.connectedAt.getTime()) / 86_400_000)
          : 0;
        return {
          linkedinAccountId: a.id,
          ageDays,
          sentToday,
          last7d,
          sentTodayMessages,
          lastAssignedAt,
          healthy: true, // only active accounts were selected
        };
      });
    },

    async assignLeadSender(leadId: string, linkedinAccountId: string): Promise<void> {
      await db.update(leads).set({ linkedinAccountId }).where(eq(leads.id, leadId));
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
        channel: r.channel as "linkedin",
        linkedinStage: r.linkedinStage as "invite" | "message" | null,
        status: r.status,
        subject: r.subject,
        body: r.body,
        campaignStatus: r.campaignStatus,
        accountPaused: r.accountPaused,
        lead: { linkedinUrl: r.leadLinkedinUrl },
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
      // Trial-on-activation (owner decision 2026-07-15): the 7-day clock starts at the FIRST
      // active LinkedIn connect, not at signup. Idempotent: only when trialing and unset.
      if (e.status === "active") {
        await db
          .update(accounts)
          .set({ trialEndsAt: new Date(Date.now() + TRIAL_DAYS * 86_400_000) })
          .where(
            and(
              eq(accounts.id, e.vanteraAccountId),
              eq(accounts.subscriptionStatus, "trialing"),
              isNull(accounts.trialEndsAt)
            )
          );
      }

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
        .returning({ id: replies.id });
      if (row) return { id: row.id, created: true };
      if (!r.providerMessageRef) throw new Error("failed to insert reply");
      const [existing] = await db
        .select({ id: replies.id })
        .from(replies)
        .where(
          and(
            eq(replies.accountId, r.accountId),
            eq(replies.providerMessageRef, r.providerMessageRef)
          )
        )
        .limit(1);
      if (!existing) throw new Error("failed to insert reply");
      return { id: existing.id, created: false };
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
      _campaignId: string | null
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

      // Self-optimizing loop (Phase 3 / WS-3.1): resolve once which strategy shapes THIS message.
      // Locked rule: a lead drafts with the challenger strategy ONLY while its own experiment is
      // still the account's LIVE (running) one; a lead from a concluded/superseded experiment
      // falls back to the current champion — never a stale challenger. playbookVersion is always
      // the champion's version (null when no playbook has been adopted yet).
      const [experiment, champion] = await Promise.all([
        fetchActiveExperiment(db, accountId),
        fetchChampion(db, accountId),
      ]);
      const onLiveChallenger =
        lead.strategyVariant === "challenger" &&
        lead.experimentId != null &&
        experiment != null &&
        lead.experimentId === experiment.id;
      const strategy = onLiveChallenger ? experiment.challengerStrategy : champion.strategy;

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
      const sent = await db
        .select({
          body: scheduledSends.body,
          stage: scheduledSends.linkedinStage,
          at: scheduledSends.createdAt,
          deliveredAt: scheduledSends.updatedAt, // markSent stamps updated_at ⇒ delivery-time proxy
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
      const got = await db
        .select({ body: replies.body, at: replies.receivedAt })
        .from(replies)
        .where(eq(replies.leadId, leadId));
      const thread = [
        ...sent.map((s) => ({ role: "agent" as const, text: s.body ?? "", at: s.at })),
        ...got.map((r) => ({ role: "lead" as const, text: r.body ?? "", at: r.at })),
      ]
        .filter((t) => t.text.trim() !== "")
        .sort((a, b) => a.at.getTime() - b.at.getTime())
        .map(({ role, text }) => ({ role, text }));

      // Turn cap + delivery gap count MESSAGES only — the invite is thread context, not a turn.
      const sentMessages = sent.filter((s) => s.stage === "message");
      const lastAgentMessageAt = sentMessages.reduce<Date | null>(
        (max, r) => (max === null || r.deliveredAt > max ? r.deliveredAt : max),
        null
      );

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
          valueProp: scan?.summary ?? null,
          avoidPhrases: await recentSendOpeners(db, accountId),
          // Citable proof/pricing/FAQ facts — lets the responder answer evidence/price questions
          // truthfully instead of deflecting or getting flagged for a fabricated number (0046).
          proofPoints: await loadProofPoints(db, accountId),
          // WS-3.1: conversation drafting (replies + follow-ups) becomes strategy-aware — same
          // resolved strategy as the attribution stamp below, so the prompt and the recipe never
          // disagree about what shaped the message.
          strategy,
        },
        thread,
        agentTurns: sentMessages.length,
        newestUnsentMessageCreatedAt: pending?.createdAt ?? null,
        lastAgentMessageAt,
        humanHandled: paused !== undefined,
        attribution: {
          experimentId: lead.experimentId ?? null,
          variant: (lead.strategyVariant as "champion" | "challenger" | null) ?? null,
          strategy,
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
      await db.update(leads).set({ status: "replied" }).where(eq(leads.id, leadId));
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
          linkedinUrl: leads.linkedinUrl,
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
        },
        channels: {
          linkedinUrl: r.linkedinUrl,
        },
        config: resolveSequenceConfig(
          (r.sequenceConfig ?? null) as Parameters<typeof resolveSequenceConfig>[0]
        ),
        accountPaused: r.accountPaused,
        leadReplied: r.leadReplied,
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

      return {
        alreadyScored: row.scoredAt != null,
        minScore,
        accountIndustry: row.accountIndustry,
        icpDescription: row.icpName
          ? `${row.icpName}: ${JSON.stringify(row.icpCriteria ?? {})}`
          : "",
        icpCriteria: (row.icpCriteria ?? {}) as IcpCriteria,
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

export interface DueAgent {
  id: string;
  accountId: string;
  kind: "scout" | "copy" | "intent";
  runAtTime: string | null;
  cadence: "daily" | "weekly" | null;
  timezone: string;
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
      const rows = await db.execute<{ id: string; trial_ends_at: string; email: string | null }>(sql`
        select a.id, a.trial_ends_at, u.email
        from public.accounts a
        join public.account_members m on m.account_id = a.id and m.role in ('owner','admin')
        join auth.users u on u.id = m.user_id
        where a.subscription_status = 'trialing'
          and a.trial_ends_at is not null
          and a.trial_ends_at > ${now.toISOString()}
          and a.trial_ends_at <= ${until.toISOString()}
          and a.trial_ending_notified_at is null
          and a.lifecycle_emails_enabled = true
          and a.stripe_subscription_id is null
      `);
      const byId = new Map<string, TrialEndingAccount>();
      for (const r of [...rows]) {
        const cur = byId.get(r.id) ?? { id: r.id, trialEndsAt: r.trial_ends_at, emails: [] };
        if (r.email && !cur.emails.includes(r.email)) cur.emails.push(r.email);
        byId.set(r.id, cur);
      }
      return [...byId.values()];
    },
    async markTrialEndingNotified(ids: string[]): Promise<void> {
      if (ids.length === 0) return;
      const now = new Date();
      await db
        .update(accounts)
        // lifecycle_last_email_at feeds the pull-back collision guard (spec 2026-07-18):
        // pull-back yields to this email for 48h.
        .set({ trialEndingNotifiedAt: now, lifecycleLastEmailAt: now })
        .where(inArray(accounts.id, ids));
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
