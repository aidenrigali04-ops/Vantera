import { applyRulesGate, isScanStale } from "@vantera/agent-brains";
import type { RankCandidate, WebsiteScan, LeadInsights, RankContext } from "@vantera/agent-brains";
import {
  icpCriteriaToFilters,
  type EnrichedProspect,
  type IcpCriteria,
  type ProspectDataSource,
} from "@vantera/prospect-data";
import {
  SCOUT_DEFAULTS,
  TRIAL_LEAD_CAP,
  WORST_CASE_CREDITS_PER_PROSPECT,
  type CopyDraftPayload,
  type CopyDraftSummary,
  type FreshLead,
  type ScoutContext,
  type ScoutStore,
} from "./types";
import { mapWithConcurrency } from "./concurrency";

/** In-flight DB writes when persisting the batch (same bound as the Scout; pool max is 10). */
const WRITE_CONCURRENCY = 8;

/**
 * The pre-payment fast pass (journey v2, blueprint §6.2): one capped, read-only scan that
 * builds the Reveal — discovery → rules gate → enrichment → AI rank → the top-5 drafts via
 * the EXISTING copy-draft path (suppression-tested; drafts land 'pending_review' and can
 * never dispatch pre-approval). Agent-less: it runs off the account's onboarding ICP rows,
 * so no scout agent (and no cron discovery) exists before payment. Every stage writes a
 * reveal_runs patch — that ledger IS the Reveal screen's poll feed.
 */

export interface FastPassCaps {
  /** candidates evaluated (discovery pull), across all onboarding ICPs */
  discoveryCap: number;
  /** drafts generated via the copy path (only ONE is ever shown pre-payment — enforced at the read API) */
  draftCap: number;
  minScore: number;
}

export const FAST_PASS_DEFAULTS: FastPassCaps = {
  discoveryCap: 50,
  draftCap: 5,
  minScore: SCOUT_DEFAULTS.minScore,
};

/** Matches surfaced to the Reveal — a READ-side cap (api/reveal/status LIMIT), not a scan cap. */
export const REVEAL_SURFACED_CAP = 15;

/** getScoutContext minus the agent block — the fast pass has no agent. */
export interface FastPassContext {
  icps: { id: string; name: string; criteria: IcpCriteria }[];
  account: ScoutContext["account"];
}

export interface RevealRunPatch {
  status?: "scanning" | "ranking" | "drafting" | "done" | "failed";
  scanned?: number;
  gatePassed?: number;
  matched?: number;
  drafted?: number;
  error?: string | null;
  startedAt?: Date;
  firstMatchAt?: Date;
  fullDraftAt?: Date;
  finishedAt?: Date;
}

export type FastPassStore = Pick<
  ScoutStore,
  | "countAccountLeads"
  | "saveWebsiteScan"
  | "upsertLeads"
  | "markRulesGate"
  | "saveEnrichment"
  | "saveScore"
  | "getLiveCopyAgent"
> & {
  getFastPassContext(accountId: string): Promise<FastPassContext | null>;
  updateRevealRun(revealRunId: string, patch: RevealRunPatch): Promise<void>;
};

export interface FastPassDeps {
  store: FastPassStore;
  prospectData: ProspectDataSource;
  scanFn: (url: string) => Promise<WebsiteScan>;
  rankFn: (candidates: RankCandidate[], ctx: RankContext) => Promise<LeadInsights[]>;
  /**
   * The EXISTING copy path (runCopyDraft), invoked INLINE — 'done' must truthfully mean
   * the draft exists, because a human is watching a progress screen (unlike the Scout's
   * fire-and-forget chain).
   */
  runDrafts: (payload: CopyDraftPayload) => Promise<CopyDraftSummary>;
  caps?: Partial<FastPassCaps>;
  now?: () => Date;
}

export interface FastPassSummary {
  status: "completed" | "failed";
  reason?: "no_icp" | "low_credits";
  scanned: number;
  gatePassed: number;
  matched: number;
  drafted: number;
}

export async function runFastPass(
  payload: { accountId: string; revealRunId: string },
  deps: FastPassDeps
): Promise<FastPassSummary> {
  const now = deps.now ?? (() => new Date());
  const caps = { ...FAST_PASS_DEFAULTS, ...deps.caps };
  const { accountId, revealRunId } = payload;
  const ZERO: Omit<FastPassSummary, "status" | "reason"> = {
    scanned: 0,
    gatePassed: 0,
    matched: 0,
    drafted: 0,
  };

  await deps.store.updateRevealRun(revealRunId, { status: "scanning", startedAt: now() });

  const ctx = await deps.store.getFastPassContext(accountId);
  if (!ctx || ctx.icps.length === 0) {
    await deps.store.updateRevealRun(revealRunId, {
      status: "failed",
      error: "no_icp",
      finishedAt: now(),
    });
    return { status: "failed", reason: "no_icp", ...ZERO };
  }

  // refresh the seller's website scan when missing/stale — fail-open, same as the Scout
  let scan = ctx.account.websiteScan;
  const url = ctx.account.websiteUrl;
  if (url && isScanStale(ctx.account.websiteScannedAt, scan?.url ?? null, url, now())) {
    try {
      scan = { ...(await deps.scanFn(url)), url };
      await deps.store.saveWebsiteScan(accountId, url, scan);
    } catch {
      // a broken website never blocks the scan; rank runs without seller context
    }
  }

  // ── Discovery, capped ──────────────────────────────────────────────────────
  // The trial-headroom clamp applies unconditionally: the claim flow starts every new
  // workspace on the trial, and the fast pass must never source past TRIAL_LEAD_CAP.
  const totalLeads = await deps.store.countAccountLeads(accountId);
  const discoveryTarget = Math.min(caps.discoveryCap, Math.max(0, TRIAL_LEAD_CAP - totalLeads));
  if (discoveryTarget <= 0) {
    await deps.store.updateRevealRun(revealRunId, {
      status: "done",
      finishedAt: now(),
    });
    return { status: "completed", ...ZERO };
  }

  // Platform COGS guard, checked BEFORE any spend. Unlike the Scout (which retries on its
  // cadence), a human is watching this run — so a starved credit pool fails loudly and the
  // Reveal shows a graceful fallback rather than silently waiting for a retry.
  const balance = await deps.prospectData.getCreditBalance();
  if (balance && balance.remaining < discoveryTarget * WORST_CASE_CREDITS_PER_PROSPECT) {
    await deps.store.updateRevealRun(revealRunId, {
      status: "failed",
      error: "low_credits",
      finishedAt: now(),
    });
    return { status: "failed", reason: "low_credits", ...ZERO };
  }

  const perIcp = Math.max(1, Math.floor(discoveryTarget / ctx.icps.length));
  const fresh: FreshLead[] = [];
  let scanned = 0;
  for (const icp of ctx.icps) {
    const candidates = await deps.prospectData.discoverProspects(
      icpCriteriaToFilters(icp.criteria),
      perIcp
    );
    scanned += candidates.length;
    fresh.push(...(await deps.store.upsertLeads(accountId, icp.id, candidates)));
  }
  await deps.store.updateRevealRun(revealRunId, { scanned });

  // ── Rules gate (deterministic, before any AI/enrichment spend) ─────────────
  const criteriaById = new Map(ctx.icps.map((i) => [i.id, i.criteria]));
  const gated = fresh.map((lead) => ({
    lead,
    result: applyRulesGate(lead.candidate, criteriaById.get(lead.icpId) ?? {}),
  }));
  await mapWithConcurrency(gated, WRITE_CONCURRENCY, ({ lead, result }) =>
    deps.store.markRulesGate(lead.leadId, result)
  );
  const survivors = gated.filter((g) => g.result.passed).map((g) => g.lead);
  await deps.store.updateRevealRun(revealRunId, {
    gatePassed: survivors.length,
    status: "ranking",
  });

  // ── Enrichment on survivors only (rule 05) ─────────────────────────────────
  // Company-event signals are deliberately skipped: that block is Intent-entitlement-gated
  // and belongs to the paid Scout; the fast pass stays minimal and fast.
  const enrichedByRef = new Map(
    (
      await deps.prospectData.enrichProspects(
        survivors.map((s) => ({
          externalRef: s.candidate.externalRef,
          businessId: s.candidate.businessId,
        }))
      )
    ).map((e) => [e.externalRef, e])
  );
  const enrichmentWrites: { leadId: string; enriched: EnrichedProspect }[] = [];
  const rankCandidates: RankCandidate[] = [];
  for (const lead of survivors) {
    const enriched = enrichedByRef.get(lead.candidate.externalRef);
    if (enriched) enrichmentWrites.push({ leadId: lead.leadId, enriched });
    rankCandidates.push({
      leadId: lead.leadId,
      companyName: lead.candidate.companyName,
      companySize: enriched?.companySize ?? lead.candidate.companySize,
      industry: enriched?.industry ?? lead.candidate.industry,
      location: enriched?.location ?? lead.candidate.location,
      title: lead.candidate.title,
      technographics: enriched?.technographics,
      signals: enriched?.signals?.length ? enriched.signals : undefined,
    });
  }
  await mapWithConcurrency(enrichmentWrites, WRITE_CONCURRENCY, (w) =>
    deps.store.saveEnrichment(w.leadId, accountId, w.enriched)
  );

  // ── AI rank → persist scores; stamp ttf_match on the first qualified save ──
  const qualified: { leadId: string; score: number }[] = [];
  if (rankCandidates.length > 0) {
    const insights = await deps.rankFn(rankCandidates, {
      accountIndustry: ctx.account.industry,
      valueProp: scan ? `${scan.summary} Value props: ${scan.value_props.join("; ")}` : null,
      icpDescription: ctx.icps.map((i) => `${i.name}: ${JSON.stringify(i.criteria)}`).join(" | "),
    });
    const scored = insights.map((insight) => ({
      insight,
      qualified: insight.score >= caps.minScore,
    }));
    await mapWithConcurrency(scored, WRITE_CONCURRENCY, ({ insight, qualified: q }) =>
      deps.store.saveScore(insight.lead_id, insight, q)
    );
    for (const s of scored)
      if (s.qualified) qualified.push({ leadId: s.insight.lead_id, score: s.insight.score });
  }
  qualified.sort((a, b) => b.score - a.score);
  await deps.store.updateRevealRun(revealRunId, {
    matched: qualified.length,
    status: "drafting",
    ...(qualified.length > 0 ? { firstMatchAt: now() } : {}),
  });

  // ── Draft the top-N via the existing copy path (inline, suppression-tested) ─
  let drafted = 0;
  if (qualified.length > 0) {
    const copyAgent = await deps.store.getLiveCopyAgent(accountId);
    if (copyAgent) {
      const leadIds = qualified.slice(0, caps.draftCap).map((q) => q.leadId);
      const summary = await deps.runDrafts({ copyAgentId: copyAgent.id, accountId, leadIds });
      drafted = summary.drafted;
    }
  }

  await deps.store.updateRevealRun(revealRunId, {
    drafted,
    status: "done",
    finishedAt: now(),
    ...(drafted > 0 ? { fullDraftAt: now() } : {}),
  });

  return {
    status: "completed",
    scanned,
    gatePassed: survivors.length,
    matched: qualified.length,
    drafted,
  };
}
