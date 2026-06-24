export * from "./types";
export { icpCriteriaToFilters } from "./icp-filters";
export { InMemoryProspectData, makeCandidate } from "./in-memory";
export { ApifyProspectData } from "./apify";
export {
  companyKey,
  classifyCompanyEvent,
  InMemoryCompanySignals,
} from "./company-signals";
export type { CompanyRef, CompanySignalSource } from "./company-signals";
export { ApifyCompanySignals } from "./apify-company-signals";
// Explorium is retired as the live source (LinkedIn-search via Apify, 2026-06-22) but kept
// exported + dormant for historical reads / a possible enrichment re-add.
export { ExploriumProspectData } from "./explorium";
