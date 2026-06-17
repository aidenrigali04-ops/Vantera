import type { EnrichedProspect, ProspectDataSource } from "@vantera/prospect-data";
import type { LeadInsights, RankCandidate, RankContext } from "@vantera/agent-brains";

/**
 * Minimal data the core needs to re-rank a single lead.
 * Built by loadLeadForRefresh in pg-store.ts.
 */
export interface RefreshLeadLoad {
  externalRef: string;
  minScore: number;
  accountIndustry: string | null;
  /** e.g. `${icp.name}: ${JSON.stringify(icp.criteria)}` */
  icpDescription: string;
  candidate: {
    companyName: string | null;
    companySize: string | null;
    industry: string | null;
    location: string | null;
    title: string | null;
  };
}

export interface RefreshLeadStore {
  loadLeadForRefresh(accountId: string, leadId: string): Promise<RefreshLeadLoad | null>;
  saveEnrichment(leadId: string, accountId: string, enriched: EnrichedProspect): Promise<void>;
  saveScore(leadId: string, insights: LeadInsights, qualified: boolean): Promise<void>;
}

export interface RefreshLeadDeps {
  store: RefreshLeadStore;
  prospectData: Pick<ProspectDataSource, "enrichProspects">;
  rankFn: (candidates: RankCandidate[], ctx: RankContext) => Promise<LeadInsights[]>;
}

/**
 * Re-enrich + re-rank one lead before a delayed email touch.
 *
 * Returns "ok"     — lead still qualifies (or was not found); the caller proceeds to draft.
 * Returns "dropped" — re-rank score fell below min_score; the caller must exit the sequence.
 *
 * The function is pure (no Trigger.dev, no direct drizzle) — all side-effects are injected
 * so tests run with in-memory fakes (rule 13 brain-purity convention applied to pipeline cores).
 */
export async function runRefreshLead(
  accountId: string,
  leadId: string,
  deps: RefreshLeadDeps
): Promise<"ok" | "dropped"> {
  const lead = await deps.store.loadLeadForRefresh(accountId, leadId);
  if (!lead) return "ok"; // nothing to refresh — let the normal draft proceed

  // businessId isn't persisted on the lead, so a refresh re-enriches contacts only (no
  // firmographics call); the initial scout run is where firmographics are captured.
  const [enriched] = await deps.prospectData.enrichProspects([{ externalRef: lead.externalRef }]);
  if (enriched) await deps.store.saveEnrichment(leadId, accountId, enriched);

  const [insight] = await deps.rankFn(
    [
      {
        leadId,
        companyName: lead.candidate.companyName ?? undefined,
        companySize: lead.candidate.companySize ?? undefined,
        industry: lead.candidate.industry ?? undefined,
        location: lead.candidate.location ?? undefined,
        title: lead.candidate.title ?? undefined,
        technographics: enriched?.technographics,
        signals: enriched?.signals,
      },
    ],
    {
      accountIndustry: lead.accountIndustry,
      valueProp: null,
      icpDescription: lead.icpDescription,
    }
  );

  if (!insight) return "ok";

  const qualified = insight.score >= lead.minScore;
  await deps.store.saveScore(leadId, insight, qualified);
  return qualified ? "ok" : "dropped";
}
