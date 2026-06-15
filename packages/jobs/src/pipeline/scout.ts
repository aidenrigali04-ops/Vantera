import { applyRulesGate, isScanStale } from "@vantera/agent-brains";
import { computeRunTarget } from "./capacity";
import type { RankCandidate } from "@vantera/agent-brains";
import { icpCriteriaToFilters } from "@vantera/prospect-data";
import {
  SCOUT_DEFAULTS,
  type FreshLead,
  type ScoutDeps,
  type ScoutRunSummary,
} from "./types";

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

  // discover per ICP and keep only new-or-unscored leads (store dedupes by external_ref)
  const capacity = await deps.store.getOutreachCapacity(accountId);
  const runTarget = computeRunTarget(capacity, {
    cadenceDays: ctx.agent.cadence === "weekly" ? 7 : 1,
    currentBacklog: await deps.store.countUncontactedLeads(accountId),
    bufferFactor: config.bufferFactor,
    floor: config.floor,
    ceiling: config.prospectsPerRun,
  });
  if (runTarget === 0) {
    await deps.store.completeRun(agentId, now());
    return { status: "completed", discovered: 0, gatePassed: 0, qualified: 0, chained: false };
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
    (await deps.prospectData.enrichProspects(survivors.map((s) => s.candidate.externalRef))).map(
      (e) => [e.externalRef, e]
    )
  );
  const rankCandidates: RankCandidate[] = [];
  for (const lead of survivors) {
    const enriched = enrichedByRef.get(lead.candidate.externalRef);
    if (enriched) await deps.store.saveEnrichment(lead.leadId, accountId, enriched);
    rankCandidates.push({
      leadId: lead.leadId,
      companyName: lead.candidate.companyName,
      companySize: lead.candidate.companySize,
      industry: lead.candidate.industry,
      location: lead.candidate.location,
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
