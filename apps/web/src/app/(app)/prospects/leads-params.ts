/**
 * Shared /prospects URL state (R4) — NO "use client": these are called by BOTH the server page
 * and the client table. (Exporting them from the client module made them client references;
 * calling one in the server component threw at runtime — the 2026-07-15 /prospects outage.)
 */
export type LeadsSort = "newest" | "score" | "company" | "activity";

export type LeadsFilters = {
  industry: string;
  min: number | null;
  days: number | null;
  intent: boolean;
  /** lead_signals.kind to require, or "" */
  signal: string;
};

export const EMPTY_FILTERS: LeadsFilters = { industry: "", min: null, days: null, intent: false, signal: "" };

export const LEADS_TABS = ["all", "intent", "qualified", "scheduled", "in_campaign", "replied", "rejected"] as const;
export type LeadsTab = (typeof LEADS_TABS)[number];
export type TabCounts = Record<LeadsTab, number>;

/** What a tab filters on: pipeline statuses, entry source, or "has an active sequence run". */
export function tabPredicate(tab: LeadsTab): { statuses: string[] | null; source: string | null; scheduled: boolean } {
  switch (tab) {
    case "intent":
      return { statuses: null, source: "intent", scheduled: false };
    case "qualified":
      return { statuses: ["qualified", "enriched"], source: null, scheduled: false };
    case "scheduled":
      return { statuses: null, source: null, scheduled: true };
    case "in_campaign":
      return { statuses: ["in_campaign"], source: null, scheduled: false };
    case "replied":
      return { statuses: ["replied", "converted"], source: null, scheduled: false };
    case "rejected":
      return { statuses: ["rejected"], source: null, scheduled: false };
    default:
      return { statuses: null, source: null, scheduled: false };
  }
}

/** One place to build /prospects URLs so every link (tabs, sort, filters, pages) preserves the rest. */
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
  if (f?.signal) params.set("signal", f.signal);
  const query = params.toString();
  return query ? `/prospects?${query}` : "/prospects";
}
