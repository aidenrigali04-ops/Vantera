import { applyRulesGate, isScanStale } from "@vantera/agent-brains";
import { computeRunTarget, computeDiscoveryTarget, dailyOutreachCapacity } from "./capacity";
import type { RankCandidate } from "@vantera/agent-brains";
import { companyKey, icpCriteriaToFilters, type CompanyRef, type ProspectSignal } from "@vantera/prospect-data";
import {
  SCOUT_DEFAULTS,
  TRIAL_LEAD_CAP,
  WORST_CASE_CREDITS_PER_PROSPECT,
  type FreshLead,
  type ScoutDeps,
  type ScoutRunSummary,
} from "./types";

/** "Strike now" signal kinds worth a notification — the high-value timing events (rule 05). */
const HOT_SIGNAL_KINDS = new Set(["funding", "intent", "exec_hire", "m_and_a"]);

/** A qualified lead's top high-value signal label, or null — drives the hot-signal notification. */
export function pickHotSignal(signals: ProspectSignal[] | undefined): string | null {
  const s = signals?.find((x) => HOT_SIGNAL_KINDS.has(x.kind));
  return s ? (s.label ?? s.detail) : null;
}

/**
 * One Scout (Prospect) Agent run, two phases (rule 06 + rule 05):
 *  1. DISCOVERY (overscan): pull a cost-capped batch to refill the qualified pool → rules gate →
 *     enrich survivors → AI rank → persist scores. Decoupled from send capacity, so Leads fills
 *     with a big pool of qualified prospects; idles once the pool target is reached (cost cap).
 *  2. DRAFT (paced, best-first): hand the top-scored qualified leads to the Copy agent up to the
 *     send-paced budget, so the review queue never runs ahead of what the account can actually send.
 */
export async function runScout(agentId: string, deps: ScoutDeps): Promise<ScoutRunSummary> {
  const now = deps.now ?? (() => new Date());
  const ctx = await deps.store.getScoutContext(agentId);
  if (!ctx || ctx.agent.status !== "live" || ctx.icps.length === 0) {
    return { status: "skipped", discovered: 0, gatePassed: 0, qualified: 0, chained: false };
  }
  const { accountId } = ctx.agent;
  const config = { ...SCOUT_DEFAULTS, ...ctx.agent.config };
  const cadenceDays = ctx.agent.cadence === "weekly" ? 7 : 1;

  // refresh the seller's website scan when missing, stale, or pointing at a new URL
  let scan = ctx.account.websiteScan;
  const url = ctx.account.websiteUrl;
  if (url && isScanStale(ctx.account.websiteScannedAt, scan?.url ?? null, url, now())) {
    try {
      scan = { ...(await deps.scanFn(url)), url };
      await deps.store.saveWebsiteScan(accountId, url, scan);
    } catch {
      // a broken website never blocks prospecting; rank just runs without scan context
    }
  }

  const capacity = await deps.store.getOutreachCapacity(accountId);
  const totalLeads = await deps.store.countAccountLeads(accountId);

  // ── Phase 1: discovery (overscan) ──────────────────────────────────────────
  // Decoupled from send capacity — pull a cost-capped, cadence-scaled batch to refill the qualified
  // pool until it reaches the target, then idle. Trial accounts are bounded by TRIAL_LEAD_CAP; with
  // no channel connected we source only a small bounded preview so prospects still land.
  let discoveryTarget = computeDiscoveryTarget({
    dailyCapacity: dailyOutreachCapacity(capacity),
    qualifiedPool: await deps.store.countQualifiedPool(accountId),
    cadenceDays,
    totalLeads,
  });
  if (ctx.account.subscriptionStatus === "trialing") {
    discoveryTarget = Math.min(discoveryTarget, Math.max(0, TRIAL_LEAD_CAP - totalLeads));
  }

  let discovered = 0;
  let gatePassed = 0;
  let qualifiedThisRun = 0;

  if (discoveryTarget > 0) {
    // Platform COGS guard: the prospect-data credit pool is shared across tenants. Confirm it can
    // cover this run's worst case BEFORE spending; a null/unknown balance fails OPEN (Apify bills
    // per-run, not per-lead, so it returns null → guard skipped). We do NOT completeRun on a skip:
    // the scheduler already advanced next_run_at, so the agent retries on its normal cadence.
    const balance = await deps.prospectData.getCreditBalance();
    if (balance && balance.remaining < discoveryTarget * WORST_CASE_CREDITS_PER_PROSPECT) {
      return { status: "skipped", reason: "low_credits", discovered: 0, gatePassed: 0, qualified: 0, chained: false };
    }

    const perIcp = Math.max(1, Math.floor(discoveryTarget / ctx.icps.length));
    const fresh: FreshLead[] = [];
    for (const icp of ctx.icps) {
      const candidates = await deps.prospectData.discoverProspects(icpCriteriaToFilters(icp.criteria), perIcp);
      discovered += candidates.length;
      fresh.push(...(await deps.store.upsertLeads(accountId, icp.id, candidates)));
    }

    // stage 1: deterministic rules gate — before any enrichment or AI spend
    const criteriaById = new Map(ctx.icps.map((i) => [i.id, i.criteria]));
    const survivors: FreshLead[] = [];
    for (const lead of fresh) {
      const result = applyRulesGate(lead.candidate, criteriaById.get(lead.icpId) ?? {});
      await deps.store.markRulesGate(lead.leadId, result);
      if (result.passed) survivors.push(lead);
    }
    gatePassed = survivors.length;

    // enrichment is spent on survivors only (rule 05; Apify-only is a no-op)
    const enrichedByRef = new Map(
      (
        await deps.prospectData.enrichProspects(
          survivors.map((s) => ({ externalRef: s.candidate.externalRef, businessId: s.candidate.businessId }))
        )
      ).map((e) => [e.externalRef, e])
    );
    // Company-event signals (Phase 15) — only on Intent-entitled plans (Growth/Scale). Fetched once
    // per company for this run's survivors, attached to the rank (a fresh event can lift the score,
    // rule 06) and persisted to lead_signals for the "why now" display. Fail-open: any error → no
    // signals, the run still completes (rule 04 — prospecting never halts on a signal read).
    const companySignalsByKey = new Map<string, ProspectSignal[]>();
    if (ctx.account.intentEnabled && deps.companySignals) {
      const seen = new Set<string>();
      const companies: CompanyRef[] = [];
      for (const s of survivors) {
        if (!s.candidate.companyName) continue;
        const key = companyKey({ name: s.candidate.companyName, domain: s.candidate.companyDomain });
        if (seen.has(key)) continue;
        seen.add(key);
        companies.push({ name: s.candidate.companyName, domain: s.candidate.companyDomain });
      }
      if (companies.length > 0) {
        try {
          const map = await deps.companySignals.getCompanySignals(companies);
          for (const [k, v] of map) companySignalsByKey.set(k, v);
        } catch {
          /* fail open */
        }
      }
    }

    const rankCandidates: RankCandidate[] = [];
    for (const lead of survivors) {
      const enriched = enrichedByRef.get(lead.candidate.externalRef);
      const companySignals = lead.candidate.companyName
        ? companySignalsByKey.get(companyKey({ name: lead.candidate.companyName, domain: lead.candidate.companyDomain }))
        : undefined;
      // Company events augment any enrichment signals (Apify-only has none, so they stand alone).
      const merged = [...(enriched?.signals ?? []), ...(companySignals ?? [])];
      const signals = merged.length > 0 ? merged : undefined;
      if (enriched)
        await deps.store.saveEnrichment(lead.leadId, accountId, companySignals?.length ? { ...enriched, signals: merged } : enriched);
      else if (companySignals && companySignals.length > 0)
        await deps.store.saveEnrichment(lead.leadId, accountId, { ...lead.candidate, signals: companySignals });
      rankCandidates.push({
        leadId: lead.leadId,
        companyName: lead.candidate.companyName,
        // firmographics arrive at enrichment (by business_id), not discovery — prefer the
        // enriched industry/size so the AI rank can actually judge fit (rule 06).
        companySize: enriched?.companySize ?? lead.candidate.companySize,
        industry: enriched?.industry ?? lead.candidate.industry,
        location: enriched?.location ?? lead.candidate.location,
        title: lead.candidate.title,
        technographics: enriched?.technographics,
        signals,
      });
    } // end survivors loop

    // stage 2: batched AI rank → persist scores (qualified = score >= min_score)
    const qualifiedThisRunIds: string[] = [];
    if (rankCandidates.length > 0) {
      const insights = await deps.rankFn(rankCandidates, {
        accountIndustry: ctx.account.industry,
        valueProp: scan ? `${scan.summary} Value props: ${scan.value_props.join("; ")}` : null,
        icpDescription: ctx.icps.map((i) => `${i.name}: ${JSON.stringify(i.criteria)}`).join(" | "),
      });
      for (const insight of insights) {
        const qualified = insight.score >= config.minScore;
        await deps.store.saveScore(insight.lead_id, insight, qualified);
        if (qualified) qualifiedThisRunIds.push(insight.lead_id);
      }
    }
    qualifiedThisRun = qualifiedThisRunIds.length;

    // Anticipation hook: a freshly-qualified lead carrying a fresh, high-value buying signal earns
    // a notification — an unpredictable, high-value reason to come back and work it now.
    if (qualifiedThisRunIds.length > 0) {
      const refByLeadId = new Map(survivors.map((s) => [s.leadId, s.candidate.externalRef]));
      const hotItems = qualifiedThisRunIds
        .map((leadId) => {
          const label = pickHotSignal(enrichedByRef.get(refByLeadId.get(leadId) ?? "")?.signals);
          return label ? { leadId, label } : null;
        })
        .filter((x): x is { leadId: string; label: string } => x !== null);
      if (hotItems.length > 0) await deps.store.notifyHotSignals(accountId, hotItems);
    }
  }

  // ── Phase 2: draft (paced, best-first) ─────────────────────────────────────
  // Drain the qualified pool into outreach up to the send-paced budget, best-scored first — across
  // this run's fresh qualified AND any backlog from prior overscan runs. The drafted-backlog clamp
  // in computeRunTarget keeps the review queue from running ahead of what the account can send.
  const draftBudget = computeRunTarget(capacity, {
    cadenceDays,
    currentBacklog: await deps.store.countUncontactedLeads(accountId),
    bufferFactor: config.bufferFactor,
    floor: config.floor,
    ceiling: config.prospectsPerRun * cadenceDays,
  });
  let chained = false;
  if (draftBudget > 0) {
    const copyAgent = await deps.store.getLiveCopyAgent(accountId);
    if (copyAgent) {
      const leadIds = await deps.store.getTopQualifiedLeadIds(accountId, draftBudget);
      if (leadIds.length > 0) {
        await deps.triggerCopyDraft({ copyAgentId: copyAgent.id, accountId, leadIds });
        chained = true;
      }
    }
  }

  await deps.store.completeRun(agentId, now());

  return { status: "completed", discovered, gatePassed, qualified: qualifiedThisRun, chained };
}
