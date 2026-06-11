import type { IcpCriteria, ProspectFilters } from "./types";

function clean(values: unknown): string[] | undefined {
  if (!Array.isArray(values)) return undefined;
  const out = values
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
  return out.length > 0 ? out : undefined;
}

/** ICP criteria (icps.criteria jsonb) → provider-agnostic discovery filters. */
export function icpCriteriaToFilters(criteria: IcpCriteria): ProspectFilters {
  const filters: ProspectFilters = {};
  const industries = clean(criteria.industries);
  const companySizes = clean(criteria.companySizes);
  const titles = clean(criteria.titles);
  const seniorities = clean(criteria.seniorities);
  const geos = clean(criteria.geos);
  const techStack = clean(criteria.techStack);
  if (industries) filters.industries = industries;
  if (companySizes) filters.companySizes = companySizes;
  if (titles) filters.titles = titles;
  if (seniorities) filters.seniorities = seniorities;
  if (geos) filters.geos = geos;
  if (techStack) filters.techStack = techStack;
  return filters;
}
