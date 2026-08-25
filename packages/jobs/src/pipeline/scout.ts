import { applyRulesGate, isScanStale, allocateDiscovery } from "@vantera/agent-brains";
import { computeRunTarget, computeDiscoveryTarget, dailyOutreachCapacity } from "./capacity";
import { rankWithCompleteness } from "./rank-complete";
import type { RankCandidate, LeadOutcomeFlags } from "@vantera/agent-brains";
import { companyKey, icpCriteriaToFilters, type CompanyRef, type EnrichedProspect, type IcpCriteria, type ProspectSignal } from "@vantera/prospect-data";
import {
  SCOUT_DEFAULTS,
  TRIAL_LEAD_CAP,
  WORST_CASE_CREDITS_PER_PROSPECT,
  type FreshLead,
  type ScoutDeps,
  type ScoutRunSummary,
} from "./types";
import { mapWithConcurrency } from "./concurrency";

/** In-flight DB writes when persisting a discovery batch (gate / enrichment / score). Pool max is 10. */
const WRITE_CONCURRENCY = 8;

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
const EMPTY_SUMMARY = {
  discoveryTarget: 0,
  criteriaDerived: 0,
  criteriaPending: 0,
  discovered: 0,
  gatePassed: 0,
  qualified: 0,
  chained: false,
  rankMissed: 0,
  rankErrors: 0,
  websiteScanError: false,
  companySignalsError: false,
} as const;

/** An ICP has usable discovery filters (the wizard stores free text with empty criteria). */
const hasFilters = (criteria: IcpCriteria) => Object.keys(icpCriteriaToFilters(criteria)).length > 0;

export async function runScout(agentId: string, deps: ScoutDeps): Promise<ScoutRunSummary> {
  const now = deps.now ?? (() => new Date());
  const ctx = await deps.store.getScoutContext(agentId);
  if (!ctx || ctx.agent.status !== "live" || ctx.icps.length === 0) {
    return { status: "skipped", ...EMPTY_SUMMARY };
  }
  const { accountId } = ctx.agent;
  const config = { ...SCOUT_DEFAULTS, ...ctx.agent.config };
  const cadenceDays = ctx.agent.cadence === "weekly" ? 7 : 1;
  let websiteScanError = false;
  let companySignalsError = false;

  // refresh the seller's website scan when missing, stale, or pointing at a new URL
  let scan = ctx.account.websiteScan;
  const url = ctx.account.websiteUrl;
  if (url && isScanStale(ctx.account.websiteScannedAt, scan?.url ?? null, url, now())) {
    try {
      scan = { ...(await deps.scanFn(url)), url };
      await deps.store.saveWebsiteScan(accountId, url, scan);
    } catch {
      websiteScanError = true;
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
  let criteriaDerived = 0;
  let criteriaPending = 0;
  let rankMissed = 0;
  let rankErrors = 0;
  // Healed working set: ICPs whose criteria are usable this run (see the self-heal below).
  let icps = ctx.icps;

  if (discoveryTarget > 0) {
    // Platform COGS guard: the prospect-data credit pool is shared across tenants. Confirm it can
    // cover this run's worst case BEFORE spending; a null/unknown balance fails OPEN (Apify bills
    // per-run, not per-lead, so it returns null → guard skipped). We do NOT completeRun on a skip:
    // the scheduler already advanced next_run_at, so the agent retries on its normal cadence.
    const balance = await deps.prospectData.getCreditBalance();
    if (balance && balance.remaining < discoveryTarget * WORST_CASE_CREDITS_PER_PROSPECT) {
      return { status: "skipped", reason: "low_credits", ...EMPTY_SUMMARY };
    }

    // Criteria self-heal: the wizard stores the ICP as free text with EMPTY criteria, and an
    // empty-criteria ICP searches with an empty input — zero results, reported as a healthy
    // "completed" run (the 2026-07-08 dead-scout incident). Derive the filters from the text
    // once and persist them; a failed or empty derivation parks that ICP for this run
    // (criteriaPending in the summary) and retries on the next cadence tick.
    const usable: typeof ctx.icps = [];
    for (const icp of ctx.icps) {
      if (hasFilters(icp.criteria)) {
        usable.push(icp);
        continue;
      }
      try {
        const derived = await deps.deriveCriteriaFn(icp.name, {
          accountIndustry: ctx.account.industry,
          valueProp: scan?.summary ?? null,
        });
        if (!hasFilters(derived)) {
          criteriaPending += 1;
          continue;
        }
        await deps.store.saveIcpCriteria(icp.id, derived);
        usable.push({ ...icp, criteria: derived });
        criteriaDerived += 1;
      } catch {
        criteriaPending += 1;
      }
    }
    icps = usable;

    const fresh: FreshLead[] = [];
    if (icps.length > 0) {
      // Stage 2: the split learns from outcomes — Thompson on deep conversion (interested/booked
      // among invited) with a 40% equal exploration floor so no ICP is ever starved. No outcome
      // data ⇒ identical to the old equal split. The TOTAL discovery target is never raised.
      const outcomeRows = await deps.store.getIcpOutcomeRows(accountId);
      const flagsByIcp = new Map<string, LeadOutcomeFlags[]>();
      for (const r of outcomeRows) {
        const list = flagsByIcp.get(r.icpId) ?? [];
        list.push(r.flags);
        flagsByIcp.set(r.icpId, list);
      }
      const quotas = allocateDiscovery(
        discoveryTarget,
        icps.map((icp) => ({ id: icp.id, flags: flagsByIcp.get(icp.id) ?? [] })),
        deps.rand ?? Math.random
      );
      for (const icp of icps) {
        const quota = quotas.get(icp.id) ?? 0;
        if (quota <= 0) continue;
        const candidates = await deps.prospectData.discoverProspects(icpCriteriaToFilters(icp.criteria), quota);
        discovered += candidates.length;
        fresh.push(...(await deps.store.upsertLeads(accountId, icp.id, candidates)));
      }
    }

    // stage 1: deterministic rules gate — before any enrichment or AI spend
    const criteriaById = new Map(icps.map((i) => [i.id, i.criteria]));
    // pure gate decisions first (deterministic order), then persist them concurrently
    const gated = fresh.map((lead) => ({
      lead,
      result: applyRulesGate(lead.candidate, criteriaById.get(lead.icpId) ?? {}),
    }));
    await mapWithConcurrency(gated, WRITE_CONCURRENCY, ({ lead, result }) =>
      deps.store.markRulesGate(lead.leadId, result)
    );
    const survivors = gated.filter((g) => g.result.passed).map((g) => g.lead);
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
          companySignalsError = true;
        }
      }
    }

    const rankCandidates: RankCandidate[] = [];
    const enrichmentWrites: { leadId: string; enriched: EnrichedProspect }[] = [];
    for (const lead of survivors) {
      const enriched = enrichedByRef.get(lead.candidate.externalRef);
      const companySignals = lead.candidate.companyName
        ? companySignalsByKey.get(companyKey({ name: lead.candidate.companyName, domain: lead.candidate.companyDomain }))
        : undefined;
      // Company events augment any enrichment signals (Apify-only has none, so they stand alone).
      const merged = [...(enriched?.signals ?? []), ...(companySignals ?? [])];
      const signals = merged.length > 0 ? merged : undefined;
      if (enriched)
        enrichmentWrites.push({ leadId: lead.leadId, enriched: companySignals?.length ? { ...enriched, signals: merged } : enriched });
      else if (companySignals && companySignals.length > 0)
        enrichmentWrites.push({ leadId: lead.leadId, enriched: { ...lead.candidate, signals: companySignals } });
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
    // persist enrichment concurrently (independent per-lead UPDATE + enrichment_results inserts)
    await mapWithConcurrency(enrichmentWrites, WRITE_CONCURRENCY, (w) =>
      deps.store.saveEnrichment(w.leadId, accountId, w.enriched)
    );

    // stage 2: batched AI rank → persist scores (qualified = score >= min_score)
    const qualifiedThisRunIds: string[] = [];
    if (rankCandidates.length > 0) {
      const rankCtx = {
        accountIndustry: ctx.account.industry,
        valueProp: scan ? `${scan.summary} Value props: ${scan.value_props.join("; ")}` : null,
        icpDescription: icps.map((i) => `${i.name}: ${JSON.stringify(i.criteria)}`).join(" | "),
      };
      const ranked = await rankWithCompleteness(deps.rankFn, rankCandidates, rankCtx);
      rankMissed = ranked.rankMissed;
      rankErrors = ranked.rankErrors;
      const scored = ranked.insights.map((insight) => ({ insight, qualified: insight.score >= config.minScore }));
      await mapWithConcurrency(scored, WRITE_CONCURRENCY, ({ insight, qualified }) =>
        deps.store.saveScore(insight.lead_id, insight, qualified)
      );
      for (const s of scored) if (s.qualified) qualifiedThisRunIds.push(s.insight.lead_id);
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

  return {
    status: "completed",
    discoveryTarget,
    criteriaDerived,
    criteriaPending,
    discovered,
    gatePassed,
    qualified: qualifiedThisRun,
    chained,
    rankMissed,
    rankErrors,
    websiteScanError,
    companySignalsError,
  };
}
