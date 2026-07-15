import { applyRulesGate } from "@vantera/agent-brains";
import type {
  LeadInsights,
  RankCandidate,
  RankContext,
  RulesGateResult,
} from "@vantera/agent-brains";
import type { IcpCriteria } from "@vantera/prospect-data";

/**
 * Minimal data the core needs to qualify one lead the user added by hand.
 * Built by loadLeadForQualify in pg-store.ts.
 */
export interface QualifyLeadLoad {
  /** already gated+ranked (scored_at set) — qualifying again would overwrite Vera's verdict */
  alreadyScored: boolean;
  minScore: number;
  accountIndustry: string | null;
  /** e.g. `${icp.name}: ${JSON.stringify(icp.criteria)}` — "" when the lead has no ICP */
  icpDescription: string;
  icpCriteria: IcpCriteria;
  candidate: {
    companyName: string | null;
    companySize: string | null;
    industry: string | null;
    location: string | null;
    title: string | null;
  };
}

export interface QualifyLeadStore {
  loadLeadForQualify(accountId: string, leadId: string): Promise<QualifyLeadLoad | null>;
  markRulesGate(leadId: string, result: RulesGateResult): Promise<void>;
  saveScore(leadId: string, insights: LeadInsights, qualified: boolean): Promise<void>;
}

export interface QualifyLeadDeps {
  store: QualifyLeadStore;
  rankFn: (candidates: RankCandidate[], ctx: RankContext) => Promise<LeadInsights[]>;
}

export type QualifyLeadOutcome = "qualified" | "rejected" | "gated" | "skipped";

/**
 * R6 manual-add path: run ONE hand-added lead through the exact discovery gate — deterministic
 * rules gate first, then the AI rank against the same min_score (rule 06: manual entry is an
 * origin label, never a bypass). No enrichment stage: a manual lead has no provider externalRef,
 * so the rank judges the fields the user supplied (the gate defers on missing fields by design).
 *
 * Pure (no Trigger.dev, no drizzle) — side-effects injected so tests run with in-memory fakes.
 */
export async function runQualifyLead(
  accountId: string,
  leadId: string,
  deps: QualifyLeadDeps
): Promise<QualifyLeadOutcome> {
  const lead = await deps.store.loadLeadForQualify(accountId, leadId);
  if (!lead || lead.alreadyScored) return "skipped";

  const gate = applyRulesGate(
    {
      externalRef: "",
      companyName: lead.candidate.companyName ?? "",
      companySize: lead.candidate.companySize ?? undefined,
      industry: lead.candidate.industry ?? undefined,
      location: lead.candidate.location ?? undefined,
      title: lead.candidate.title ?? undefined,
    },
    lead.icpCriteria
  );
  await deps.store.markRulesGate(leadId, gate);
  if (!gate.passed) return "gated";

  const [insight] = await deps.rankFn(
    [
      {
        leadId,
        companyName: lead.candidate.companyName ?? undefined,
        companySize: lead.candidate.companySize ?? undefined,
        industry: lead.candidate.industry ?? undefined,
        location: lead.candidate.location ?? undefined,
        title: lead.candidate.title ?? undefined,
      },
    ],
    {
      accountIndustry: lead.accountIndustry,
      valueProp: null,
      icpDescription: lead.icpDescription,
    }
  );
  if (!insight) return "skipped";

  const qualified = insight.score >= lead.minScore;
  await deps.store.saveScore(leadId, insight, qualified);
  return qualified ? "qualified" : "rejected";
}
