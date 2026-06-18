import type {
  EnrichedProspect,
  ProspectCandidate,
  ProspectDataSource,
  ProspectFilters,
  ProspectRef,
} from "./types";

let seq = 0;

/** Convenience builder for tests and seed pools. */
export function makeCandidate(overrides: Partial<ProspectCandidate> = {}): ProspectCandidate {
  const n = ++seq;
  return {
    externalRef: `cand_${n}`,
    companyName: `Acme ${n}`,
    companyDomain: `acme${n}.example.com`,
    companySize: "11-50",
    industry: "saas",
    location: "united states",
    firstName: "Pat",
    lastName: `Lee${n}`,
    title: "CTO",
    linkedinUrl: `https://linkedin.com/in/pat-lee-${n}`,
    ...overrides,
  };
}

function matches(value: string | undefined, wanted: string[] | undefined): boolean {
  if (!wanted || wanted.length === 0) return true;
  if (!value) return false;
  const v = value.toLowerCase();
  return wanted.some((w) => v.includes(w.toLowerCase()));
}

/** Test/dev double. Also the reference behavior for real adapters. */
export class InMemoryProspectData implements ProspectDataSource {
  readonly discoverCalls: { filters: ProspectFilters; limit: number }[] = [];
  readonly enrichCalls: ProspectRef[][] = [];

  constructor(private readonly pool: ProspectCandidate[] = []) {}

  async discoverProspects(filters: ProspectFilters, limit: number): Promise<ProspectCandidate[]> {
    this.discoverCalls.push({ filters, limit });
    return this.pool
      .filter(
        (c) =>
          matches(c.industry, filters.industries) &&
          matches(c.companySize, filters.companySizes) &&
          matches(c.title, filters.titles) &&
          matches(c.location, filters.geos)
      )
      .slice(0, limit);
  }

  async enrichProspects(refs: ProspectRef[]): Promise<EnrichedProspect[]> {
    this.enrichCalls.push(refs);
    const wanted = new Set(refs.map((r) => r.externalRef));
    return this.pool
      .filter((c) => wanted.has(c.externalRef))
      .map((c) => ({
        ...c,
        email: `${c.externalRef}@enriched.example.com`,
        emailStatus: "valid" as const,
        phone: "+15555550100",
        phoneStatus: "valid" as const,
        firmographics: { employees: 42 },
        technographics: ["salesforce", "hubspot"],
        signals: [
          { kind: "hiring", label: "Actively hiring", detail: "3 open SDR roles", observedAt: "2026-06-01" },
        ],
      }));
  }
}
