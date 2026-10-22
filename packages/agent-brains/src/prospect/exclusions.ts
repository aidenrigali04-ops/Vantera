import type { ProspectCandidate } from "@vantera/prospect-data";

/**
 * ML-5 steerable targeting: the user's own exclusions + free-text guidance, stored on the Scout
 * agent (`agents.config.targeting`, rule 13 — no new columns). Exclusions are deterministic and run
 * with the rules gate, before any enrichment or AI spend; guidance rides into the rank prompt.
 * They apply to every way a person enters the funnel (Scout discovery and the Intent agent). Pure.
 */

export type TargetingRules = {
  /** agencies, consultancies, consultants */
  excludeAgencies: boolean;
  /** freelancers, self-employed, independent contractors */
  excludeFreelancers: boolean;
  competitors: string[];
  customers: string[];
  companies: string[];
  keywords: string[];
  /** "who to prioritize / avoid" in the user's own words — rank-prompt context, never a gate */
  guidance: string | null;
};

export const EMPTY_TARGETING: TargetingRules = {
  excludeAgencies: false,
  excludeFreelancers: false,
  competitors: [],
  customers: [],
  companies: [],
  keywords: [],
  guidance: null,
};

export const TARGETING_LIST_MAX = 50;
export const TARGETING_ENTRY_MAX = 80;
export const TARGETING_GUIDANCE_MAX = 500;

function cleanList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of raw) {
    if (typeof v !== "string") continue;
    const t = v.trim().replace(/\s+/g, " ");
    if (!t || t.length > TARGETING_ENTRY_MAX || seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase());
    out.push(t);
    if (out.length === TARGETING_LIST_MAX) break;
  }
  return out;
}

/** Defensive read of `agents.config.targeting` (jsonb) — anything malformed becomes "no rule". */
export function normalizeTargetingRules(raw: unknown): TargetingRules {
  if (!raw || typeof raw !== "object") return { ...EMPTY_TARGETING };
  const r = raw as Record<string, unknown>;
  const guidance = typeof r.guidance === "string" ? r.guidance.trim().slice(0, TARGETING_GUIDANCE_MAX) : "";
  return {
    excludeAgencies: r.excludeAgencies === true,
    excludeFreelancers: r.excludeFreelancers === true,
    competitors: cleanList(r.competitors),
    customers: cleanList(r.customers),
    companies: cleanList(r.companies),
    keywords: cleanList(r.keywords),
    guidance: guidance || null,
  };
}

const AGENCY = [/\bagenc(?:y|ies)\b/i, /\bconsult(?:ant|ants|ing|ancy)\b/i];
const FREELANCER = [/\bfreelanc/i, /\bself[\s-]?employed\b/i, /\bindependent (?:contractor|professional)\b/i, /\bcontractor\b/i];

const LEGAL_SUFFIX = new Set(["inc", "llc", "ltd", "limited", "corp", "corporation", "co", "company", "gmbh", "plc", "sa", "bv", "ag", "the"]);

/** "Acme, Inc." → "acme"; "The Globex Corporation" → "globex". */
function normCompany(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter((w) => w && !LEGAL_SUFFIX.has(w))
    .join(" ");
}

const normDomain = (d: string) => d.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
const looksLikeDomain = (s: string) => /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(normDomain(s));

/** Same company: equal normalized names, the candidate's name extends the entry by whole words
 *  ("Acme" ↔ "Acme Labs", never "Acmeworks"), or the domains match. */
function sameCompany(entry: string, c: ProspectCandidate): boolean {
  if (looksLikeDomain(entry)) {
    const d = normDomain(entry);
    if (c.companyDomain && normDomain(c.companyDomain) === d) return true;
    entry = d.split(".")[0]!;
  }
  const e = normCompany(entry);
  const n = c.companyName ? normCompany(c.companyName) : "";
  return !!e && !!n && (n === e || n.startsWith(`${e} `));
}

const wordStart = (text: string, term: string) =>
  new RegExp(`(?<![a-z0-9])${term.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(text.toLowerCase());

/** The reason a candidate is excluded by the user's rules, or null. */
export function applyExclusions(c: ProspectCandidate, rules: TargetingRules): string | null {
  const who = [c.title, c.companyName].filter(Boolean).join(" ");
  if (rules.excludeAgencies && AGENCY.some((re) => re.test(who))) return "excluded: agency or consultant";
  if (rules.excludeFreelancers && FREELANCER.some((re) => re.test(who))) return "excluded: freelancer";
  for (const e of rules.competitors) if (sameCompany(e, c)) return `excluded: competitor (${e})`;
  for (const e of rules.customers) if (sameCompany(e, c)) return `excluded: existing customer (${e})`;
  for (const e of rules.companies) if (sameCompany(e, c)) return `excluded company (${e})`;
  const text = [c.title, c.companyName, c.industry].filter(Boolean).join(" ");
  for (const k of rules.keywords) if (wordStart(text, k)) return `excluded keyword (${k})`;
  return null;
}
