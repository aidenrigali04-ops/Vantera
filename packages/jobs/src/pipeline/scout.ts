import { applyRulesGate, isScanStale } from "@vantera/agent-brains";
import { computeRunTarget } from "./capacity";
import type { RankCandidate } from "@vantera/agent-brains";
import { icpCriteriaToFilters, type ProspectSignal } from "@vantera/prospect-data";
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
 * One Scout (Prospect) Agent run: discover → rules gate → enrich survivors only →
 * AI rank → persist scores/insights → chain the Copy agent (rule 06 + rule 05).
 */
export async function runScout(agentId: string, deps: ScoutDeps): Promise<ScoutRunSummary> {
  const now = deps.now ?? (() => new Date());
  const ctx = await deps.store.getScoutContext(agentId);
  if (!ctx || ctx.agent.status !== "live" || ctx.icps.length === 0) {
    return { status: "skipped", discovered: 0, gatePassed: 0, qualified: 0, chained: false };
  }
  const { accountId } = ctx.agent;
  const config = { ...SCOUT_DEFAULTS, ...ctx.agent.config };

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

  const cadenceDays = ctx.agent.cadence === "weekly" ? 7 : 1;

  // The per-run ceiling scales with cadence: config.prospectsPerRun is a PER-DAY budget, so a weekly
  // run sources up to a full week of it in one batch (~7x) — weekly users get real outreach volume
  // without the per-run cost of daily runs. computeRunTarget still clamps to actual send capacity
  // below this, so we never source more than the account can contact (no wasted credits, rule 05).
  let ceiling = config.prospectsPerRun * cadenceDays;

  // Trial COGS guard: a trialing account sources at most TRIAL_LEAD_CAP leads total. Clamp the run
  // ceiling to the remaining trial budget; the run no-ops once the cap is hit (before any spend).
  if (ctx.account.subscriptionStatus === "trialing") {
    const alreadySourced = await deps.store.countAccountLeads(accountId);
    ceiling = Math.min(ceiling, Math.max(0, TRIAL_LEAD_CAP - alreadySourced));
    if (ceiling === 0) {
      return { status: "skipped", discovered: 0, gatePassed: 0, qualified: 0, chained: false };
    }
  }

  // discover per ICP and keep only new-or-unscored leads (store dedupes by external_ref).
  // The effective pull = min(cadence-scaled ceiling, outreach capacity, trial budget).
  const capacity = await deps.store.getOutreachCapacity(accountId);
  const runTarget = computeRunTarget(capacity, {
    cadenceDays,
    currentBacklog: await deps.store.countUncontactedLeads(accountId),
    bufferFactor: config.bufferFactor,
    floor: config.floor,
    ceiling,
  });
  if (runTarget === 0) {
    await deps.store.completeRun(agentId, now());
    return { status: "completed", discovered: 0, gatePassed: 0, qualified: 0, chained: false };
  }

  // Platform COGS guard: the prospect-data credit pool is shared across every tenant. Before
  // spending on discovery + enrichment, confirm the pool can cover this run's worst case (every
  // discovered prospect surviving the gate → full waterfall). A null/failed balance read fails
  // OPEN — this improves safety, it is not a correctness gate, and the provider's own insufficient-
  // credit error stays the backstop. Skipping here (before any spend) turns a messy mid-run hard-
  // stop into a clean, observable skip an operator can act on (top up the pool). We intentionally
  // do NOT completeRun: the scheduler already advanced next_run_at at trigger time, so the agent
  // simply retries on its normal cadence — no tight 15-min loop.
  const balance = await deps.prospectData.getCreditBalance();
  if (balance && balance.remaining < runTarget * WORST_CASE_CREDITS_PER_PROSPECT) {
    return { status: "skipped", reason: "low_credits", discovered: 0, gatePassed: 0, qualified: 0, chained: false };
  }

  const perIcp = Math.max(1, Math.floor(runTarget / ctx.icps.length));
  const fresh: FreshLead[] = [];
  let discovered = 0;
  for (const icp of ctx.icps) {
    const candidates = await deps.prospectData.discoverProspects(
      icpCriteriaToFilters(icp.criteria),
      perIcp
    );
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

  // enrichment is spent on survivors only (rule 05)
  const enrichedByRef = new Map(
    (
      await deps.prospectData.enrichProspects(
        survivors.map((s) => ({ externalRef: s.candidate.externalRef, businessId: s.candidate.businessId }))
      )
    ).map((e) => [e.externalRef, e])
  );
  const rankCandidates: RankCandidate[] = [];
  for (const lead of survivors) {
    const enriched = enrichedByRef.get(lead.candidate.externalRef);
    if (enriched) await deps.store.saveEnrichment(lead.leadId, accountId, enriched);
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
      signals: enriched?.signals,
    });
  }

  // stage 2: batched AI rank
  const qualifiedIds: string[] = [];
  if (rankCandidates.length > 0) {
    const insights = await deps.rankFn(rankCandidates, {
      accountIndustry: ctx.account.industry,
      valueProp: scan ? `${scan.summary} Value props: ${scan.value_props.join("; ")}` : null,
      icpDescription: ctx.icps.map((i) => `${i.name}: ${JSON.stringify(i.criteria)}`).join(" | "),
    });
    for (const insight of insights) {
      const qualified = insight.score >= config.minScore;
      await deps.store.saveScore(insight.lead_id, insight, qualified);
      if (qualified) qualifiedIds.push(insight.lead_id);
    }
  }

  // Anticipation hook (Surface A): a qualified lead carrying a fresh, high-value buying signal
  // earns a notification — an unpredictable, high-value reason to come back and work it now.
  if (qualifiedIds.length > 0) {
    const refByLeadId = new Map(survivors.map((s) => [s.leadId, s.candidate.externalRef]));
    const hotItems = qualifiedIds
      .map((leadId) => {
        const label = pickHotSignal(enrichedByRef.get(refByLeadId.get(leadId) ?? "")?.signals);
        return label ? { leadId, label } : null;
      })
      .filter((x): x is { leadId: string; label: string } => x !== null);
    if (hotItems.length > 0) await deps.store.notifyHotSignals(accountId, hotItems);
  }

  await deps.store.completeRun(agentId, now());

  // hand qualified leads to the Copy agent, if one is live
  let chained = false;
  if (qualifiedIds.length > 0) {
    const copyAgent = await deps.store.getLiveCopyAgent(accountId);
    if (copyAgent) {
      await deps.triggerCopyDraft({ copyAgentId: copyAgent.id, accountId, leadIds: qualifiedIds });
      chained = true;
    }
  }

  // hand qualified leads to the Caller agent, if one is live (parallel chain)
  if (qualifiedIds.length > 0) {
    const callerAgent = await deps.store.getLiveCallerAgent(accountId);
    if (callerAgent) {
      await deps.triggerCallBrief({ callerAgentId: callerAgent.id, accountId, leadIds: qualifiedIds });
    }
  }

  return {
    status: "completed",
    discovered,
    gatePassed: survivors.length,
    qualified: qualifiedIds.length,
    chained,
  };
}
