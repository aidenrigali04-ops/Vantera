import type { IcpCriteria, ProspectCandidate } from "@vantera/prospect-data";
import { titleMatchesAny } from "./title-match";

export interface RulesGateResult {
  passed: boolean;
  reasons: string[];
}

/**
 * A wanted term matches only where it starts a word ("cto" in "CTO & Co-founder", not in
 * "director"; "us" not in "Austin"). Suffixes still match ("engineer" → "Engineering").
 */
function containsAny(value: string, wanted: string[]): boolean {
  const v = value.toLowerCase();
  return wanted.some((w) => {
    const term = w.toLowerCase().trim();
    if (!term) return false;
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(?<![a-z0-9])${escaped}`).test(v);
  });
}

/**
 * Headline phrases that mean the person is looking for a job — never a buyer, whatever the ICP.
 * Anchored to job-search wording ("looking for a new role", "seeking new opportunities") so a
 * buyer who is "looking for great engineers" or "hiring" is never caught.
 */
const JOB_SEEKER = [
  /open[\s-]?to[\s-]?work/i,
  /\bseeking (?:a |my )?(?:new |next )?(?:role|position|opportunit|job)/i,
  /\blooking for (?:a |my )?(?:new |next )(?:role|position|opportunit|job|challenge)/i,
  /\bactively (?:looking|seeking)\b/i,
  /\bin transition\b/i,
  /\bavailable for (?:hire|new roles?)\b/i,
];

export function isJobSeeker(headline: string | undefined): boolean {
  return !!headline && JOB_SEEKER.some((re) => re.test(headline));
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
  if (isJobSeeker(candidate.title)) reasons.push(`job seeker ("${candidate.title}")`);

  // Titles/seniorities match by words in any order with abbreviations expanded (title-match.ts);
  // the other fields keep phrase matching.
  const checks: {
    wanted?: string[];
    value?: string;
    label: string;
    match: (value: string, wanted: string[]) => boolean;
  }[] = [
    { wanted: criteria.industries, value: candidate.industry, label: "industry", match: containsAny },
    { wanted: criteria.companySizes, value: candidate.companySize, label: "company size", match: containsAny },
    { wanted: criteria.titles, value: candidate.title, label: "title", match: titleMatchesAny },
    { wanted: criteria.seniorities, value: candidate.title, label: "seniority", match: titleMatchesAny },
    { wanted: criteria.geos, value: candidate.location, label: "geo", match: containsAny },
  ];

  for (const { wanted, value, label, match } of checks) {
    if (!wanted || wanted.length === 0) continue;
    if (!value) continue; // provider gave no value at discovery → defer to discovery filter + AI rank
    if (!match(value, wanted)) {
      reasons.push(`${label} "${value}" outside ICP (${wanted.join(", ")})`);
    }
  }

  return { passed: reasons.length === 0, reasons };
}
