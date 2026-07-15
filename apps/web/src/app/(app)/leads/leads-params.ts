/**
 * Shared /leads URL state (R4) — NO "use client": these are called by BOTH the server page
 * and the client table. (Exporting them from the client module made them client references;
 * calling one in the server component threw at runtime — the 2026-07-15 /leads outage.)
 */
export type LeadsSort = "newest" | "score" | "company" | "activity";

export type LeadsFilters = {
  industry: string;
  min: number | null;
  days: number | null;
  intent: boolean;
};

export const EMPTY_FILTERS: LeadsFilters = { industry: "", min: null, days: null, intent: false };

/** One place to build /leads URLs so every link (tabs, sort, filters, pages) preserves the rest. */
export function leadsHref(opts: {
  tab: string;
  q: string;
  sort: LeadsSort;
  page?: number;
  per?: number;
  filters?: LeadsFilters;
}): string {
  const params = new URLSearchParams();
  if (opts.tab !== "all") params.set("tab", opts.tab);
  if (opts.q) params.set("q", opts.q);
  if (opts.sort !== "newest") params.set("sort", opts.sort);
  if (opts.page && opts.page > 1) params.set("page", String(opts.page));
  if (opts.per && opts.per !== 25) params.set("per", String(opts.per));
  const f = opts.filters;
  if (f?.industry) params.set("industry", f.industry);
  if (f?.min) params.set("min", String(f.min));
  if (f?.days) params.set("days", String(f.days));
  if (f?.intent) params.set("intent", "1");
  const query = params.toString();
  return query ? `/leads?${query}` : "/leads";
}
