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
 * fields. Cheap, explainable, zero AI cost. A criterion the candidate has no data
 * for fails closed ("only high-quality leads" — unknowns don't pass).
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
    if (!value) {
      reasons.push(`missing ${label}`);
    } else if (!containsAny(value, wanted)) {
      reasons.push(`${label} "${value}" outside ICP (${wanted.join(", ")})`);
    }
  }

  return { passed: reasons.length === 0, reasons };
}
