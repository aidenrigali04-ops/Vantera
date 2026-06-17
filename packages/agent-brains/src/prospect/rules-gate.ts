import type { IcpCriteria, ProspectCandidate } from "@vantera/prospect-data";

export interface RulesGateResult {
  passed: boolean;
  reasons: string[];
}

function containsAny(value: string, wanted: string[]): boolean {
  const v = value.toLowerCase();
  return wanted.some((w) => v.includes(w.toLowerCase()));
}

/**
 * Stage 1 of the scoring gate (rule 06): deterministic ICP-fit checks on discovery
 * fields. Cheap, explainable, zero AI cost. Rejects on a *positive* mismatch — a
 * field the candidate has whose value falls outside the ICP. A field the discovery
 * provider didn't return (company_size/company_industry are not in the /prospects
 * response) is deferred, not rejected: size/industry are enforced by the discovery
 * query filter and the AI rank, so failing closed here would reject every lead.
 * Tech-stack criteria are applied at the discovery filter, not here: discovery
 * rows don't carry technographics (enrichment is spent on survivors only).
 */
export function applyRulesGate(
  candidate: ProspectCandidate,
  criteria: IcpCriteria
): RulesGateResult {
  const reasons: string[] = [];

  const checks: { wanted?: string[]; value?: string; label: string }[] = [
    { wanted: criteria.industries, value: candidate.industry, label: "industry" },
    { wanted: criteria.companySizes, value: candidate.companySize, label: "company size" },
    { wanted: criteria.titles, value: candidate.title, label: "title" },
    { wanted: criteria.seniorities, value: candidate.title, label: "seniority" },
    { wanted: criteria.geos, value: candidate.location, label: "geo" },
  ];

  for (const { wanted, value, label } of checks) {
    if (!wanted || wanted.length === 0) continue;
    if (!value) continue; // provider gave no value at discovery → defer to discovery filter + AI rank
    if (!containsAny(value, wanted)) {
      reasons.push(`${label} "${value}" outside ICP (${wanted.join(", ")})`);
    }
  }

  return { passed: reasons.length === 0, reasons };
}
