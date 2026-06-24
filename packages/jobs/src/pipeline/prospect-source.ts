import {
  ApifyCompanySignals,
  ApifyProspectData,
  InMemoryProspectData,
  makeCandidate,
  type CompanySignalSource,
  type ProspectDataSource,
} from "@vantera/prospect-data";

/** Dev pool so end-to-end dry runs work without a provider key. */
export function seedPool() {
  const industries = ["saas", "fintech", "logistics", "healthcare", "devtools"];
  const titles = ["CTO", "VP Sales", "Head of Growth", "CEO", "VP Operations"];
  return Array.from({ length: 40 }, (_, i) =>
    makeCandidate({
      externalRef: `seed_${i}`,
      companyName: `Seedco ${i}`,
      industry: industries[i % industries.length],
      title: titles[i % titles.length],
      companySize: i % 2 === 0 ? "11-50" : "51-200",
      location: "united states",
    })
  );
}

/** Live adapter when configured, deterministic seeded fake otherwise. */
export function createProspectData(): ProspectDataSource {
  // LinkedIn-search via Apify is the live discovery source (2026-06-22). Needs both the token and a
  // configured actor; without them, dev/preview runs on the deterministic seeded pool.
  if (process.env.APIFY_TOKEN && process.env.APIFY_LINKEDIN_ACTOR) {
    return new ApifyProspectData();
  }
  return new InMemoryProspectData(seedPool());
}

/**
 * Company-event signal source for Intent plans (Phase 15). Returns the live Apify company-news
 * adapter only when both the token and a company-news actor are configured; otherwise `undefined`,
 * which the Scout treats as a no-op (no company signals, nothing breaks). The Scout also gates the
 * fetch on the account's Intent entitlement, so this never runs for Starter.
 */
export function createCompanySignals(): CompanySignalSource | undefined {
  if (process.env.APIFY_TOKEN && process.env.APIFY_COMPANY_NEWS_ACTOR) {
    return new ApifyCompanySignals({
      token: process.env.APIFY_TOKEN,
      actorId: process.env.APIFY_COMPANY_NEWS_ACTOR,
    });
  }
  return undefined;
}
