"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowDown, Flame, Rows3, Search, SlidersHorizontal, Snowflake, Zap } from "lucide-react";
import { PANEL_SURFACE, Eyebrow } from "@/components/ui/panel";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ScoreBadge, SourceBadge, WhyNowLine } from "@/components/lead-why-now";
import { LeadProfileSheet } from "@/components/lead-profile";
import { bulkArchiveLeads, bulkSuppressLeads, type BulkResult } from "./bulk-actions";
import { cn } from "@/lib/utils";
import { EMPTY_FILTERS, leadsHref, type LeadsFilters, type LeadsSort } from "./leads-params";

export type { LeadsFilters, LeadsSort } from "./leads-params";
import {
  coolingState,
  lastActivity,
  leadSignalLine,
  projectedRevenue,
  type LeadSignalView,
} from "./lead-value";

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export interface LeadInsightsView {
  pain_points?: string[];
  triggers?: string[];
  motivations?: string[];
  value_angle?: string;
  aha_moment?: string;
  summary?: string;
}

export interface LeadRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  title: string | null;
  company_name: string | null;
  company_size: string | null;
  industry: string | null;
  location: string | null;
  tech_stack: string[] | null;
  status: string;
  source: string;
  ai_score: number | null;
  ai_rationale: string | null;
  ai_insights: LeadInsightsView | null;
  rules_gate_reasons: string[] | null;
  scored_at?: string | null;
  email: string | null;
  email_status: string;
  phone: string | null;
  phone_status: string;
  linkedin_url: string | null;
  created_at: string;
  replies?: ReplyView[] | null;
  lead_signals?: LeadSignalView[] | null;
}

export interface ReplyView {
  channel: "email" | "linkedin";
  classification: string | null;
  classification_rationale: string | null;
  body: string | null;
  received_at: string;
}


function latestReply(lead: LeadRow): ReplyView | null {
  const replies = lead.replies ?? [];
  if (replies.length === 0) return null;
  return [...replies].sort((a, b) => b.received_at.localeCompare(a.received_at))[0];
}

const STATUS_LABELS: Record<string, string> = {
  sourced: "Sourced",
  rejected: "Filtered out",
  qualified: "Qualified",
  enriched: "Enriched",
  in_campaign: "In outreach",
  replied: "Replied",
  converted: "Converted",
  archived: "Archived",
};

// Color grade: one positive green (the app-wide --positive) = a win, neutral foreground = in
// motion, muted = dead. A won deal reads solid; everything else steps down. Two hues only — never
// a rainbow, no glow (the fill carries the emphasis on its own).
const STATUS_CLASS: Record<string, string> = {
  converted: "bg-[var(--positive)] text-white",
  replied:
    "bg-[var(--positive-tint)] text-[var(--positive)] ring-1 ring-inset ring-[var(--positive-line)]",
  in_campaign: "bg-foreground/10 text-foreground ring-1 ring-inset ring-border",
  qualified: "bg-foreground/10 text-foreground ring-1 ring-inset ring-border",
  enriched: "bg-foreground/10 text-foreground ring-1 ring-inset ring-border",
  sourced: "text-muted-foreground ring-1 ring-inset ring-border",
  rejected: "text-muted-foreground ring-1 ring-inset ring-border",
  archived: "text-muted-foreground ring-1 ring-inset ring-border",
};

function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium",
        STATUS_CLASS[status] ?? "text-muted-foreground ring-1 ring-inset ring-border"
      )}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

// SourceBadge / WhyNowLine / ScoreBadge live in @/components/lead-why-now — the shared
// intent vocabulary, reused by the dashboard Hot-leads panel and Approvals.

function leadName(lead: LeadRow): string {
  return [lead.first_name, lead.last_name].filter(Boolean).join(" ") || "Unknown";
}

/** Loss-aversion marker: a warm reply left waiting (the warm pipeline going cold). */
function CoolingChip({ lead }: { lead: LeadRow }) {
  const cooling = coolingState(lead.status, latestReply(lead)?.received_at ?? null);
  if (!cooling) return null;
  return (
    <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-500/12 px-2 py-0.5 text-[11px] font-medium text-amber-700 ring-1 ring-inset ring-amber-500/30 dark:text-amber-300">
      <Snowflake className="size-3" aria-hidden />
      {cooling.label}
    </span>
  );
}

/**
 * "Hot right now" — the freshest, highest-fit prospects pulled to the top as a scannable opportunity
 * feed (retention: variable reward — the reason to open Prospects daily). Cards open the same profiler
 * as the table, so the strip is a shortcut, never a second code path. Hidden when there's nothing hot.
 */
function HotNowStrip({
  hotLeads,
  onSelect,
  avgDealValueCents,
  goalCents,
}: {
  hotLeads: LeadRow[];
  onSelect: (lead: LeadRow) => void;
  avgDealValueCents: number | null;
  goalCents: number | null;
}) {
  if (hotLeads.length === 0) return null;
  return (
    <section className="mb-4" data-copilot="hot-leads">
      <div className="mb-2 flex items-center gap-1.5">
        <Flame className="size-4 text-[var(--positive)]" aria-hidden />
        <Eyebrow>Hot right now</Eyebrow>
        <span className="text-xs text-muted-foreground">— your strongest-fit prospects to work today</span>
      </div>
      {/* Compact cards — one screen is the page's contract, so the strip stays shallow. */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {hotLeads.map((lead) => (
          <button
            key={lead.id}
            type="button"
            onClick={() => onSelect(lead)}
            className={cn(
              PANEL_SURFACE,
              "group flex min-w-0 flex-col gap-1 p-3 text-left shadow-none ring-1 ring-inset ring-[var(--positive-line)] transition-colors hover:ring-[var(--positive)]"
            )}
          >
            <div className="flex min-w-0 items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-1.5">
                <p className="truncate font-medium">{leadName(lead)}</p>
                <SourceBadge source={lead.source} />
              </div>
              <ScoreBadge score={lead.ai_score} />
            </div>
            <p className="truncate text-xs text-muted-foreground">
              {[lead.title, lead.company_name].filter(Boolean).join(" · ") || "—"}
            </p>
            {(() => {
              const signal = leadSignalLine(lead.lead_signals, lead.ai_insights);
              const proj = projectedRevenue(avgDealValueCents, goalCents, lead.ai_score);
              if (!signal && !proj) return null;
              return (
                <p className="flex min-w-0 items-center gap-1 text-xs">
                  {signal ? (
                    <>
                      <Zap className="size-3 shrink-0 text-[var(--positive)]" aria-hidden />
                      <span className="min-w-0 truncate text-[var(--positive)]">{signal}</span>
                    </>
                  ) : (
                    <span className="truncate text-muted-foreground">
                      Worth{" "}
                      <span className="font-data font-semibold text-foreground">
                        {usd.format(proj!.valueCents / 100)}
                      </span>
                      {proj!.dealsToGoal != null && <> · 1 of ~{proj!.dealsToGoal} to your goal</>}
                    </span>
                  )}
                </p>
              );
            })()}
          </button>
        ))}
      </div>
    </section>
  );
}

const DENSITY_KEY = "vantera:leads-density";
type Density = "comfortable" | "compact";

// Density is a per-user viewing preference held in localStorage and read through
// useSyncExternalStore — hydration-safe (server snapshot is the default) and no
// setState-in-effect. Local listeners make same-tab toggles re-render instantly.
let densityListeners: Array<() => void> = [];
function subscribeDensity(cb: () => void): () => void {
  densityListeners.push(cb);
  window.addEventListener("storage", cb);
  return () => {
    densityListeners = densityListeners.filter((l) => l !== cb);
    window.removeEventListener("storage", cb);
  };
}
function readDensity(): Density {
  return window.localStorage.getItem(DENSITY_KEY) === "compact" ? "compact" : "comfortable";
}
function writeDensity(next: Density) {
  window.localStorage.setItem(DENSITY_KEY, next);
  for (const l of densityListeners) l();
}

/** R4: sortable column header — module scope (components created during render trip the
 *  react-hooks lint). Active column shows a solid arrow; clicking again returns to newest. */
function SortHeaderLink({
  active,
  href,
  children,
}: {
  active: boolean;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-1 transition-colors hover:text-foreground",
        active && "text-foreground"
      )}
    >
      {children}
      <ArrowDown className={cn("size-3", !active && "opacity-30")} aria-hidden />
    </Link>
  );
}

/** Column header cell — the table's one place for th styling so the row reads as one system. */
function Th({
  children,
  className,
  first = false,
  last = false,
}: {
  children?: React.ReactNode;
  className?: string;
  first?: boolean;
  last?: boolean;
}) {
  return (
    <th
      className={cn(
        "bg-[var(--tint)] px-4 py-2.5 font-medium",
        first && "rounded-tl-xl",
        last && "rounded-tr-xl",
        className
      )}
    >
      {children}
    </th>
  );
}

export function LeadsTable({
  leads,
  hotLeads = [],
  avgDealValueCents,
  goalCents,
  tab = "all",
  q = "",
  sort = "newest",
  per = 25,
  filters = EMPTY_FILTERS,
  industries = [],
}: {
  leads: LeadRow[];
  hotLeads?: LeadRow[];
  avgDealValueCents: number | null;
  goalCents: number | null;
  tab?: string;
  q?: string;
  sort?: LeadsSort;
  per?: number;
  filters?: LeadsFilters;
  industries?: string[];
}) {
  const [peek, setPeek] = useState<LeadRow | null>(null);
  // R4 bulk selection — page-scoped; every bulk op confirms and toasts its outcome.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkPending, startBulk] = useTransition();
  const density = useSyncExternalStore(subscribeDensity, readDensity, () => "comfortable" as const);
  const toggleDensity = writeDensity;

  const open = (lead: LeadRow) => setPeek(lead);
  const cellY = density === "compact" ? "py-1.5" : "py-3";

  const pageIds = leads.map((l) => l.id);
  const allSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(pageIds));
  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const runBulk = (
    action: (ids: string[]) => Promise<BulkResult>,
    verb: string
  ) => {
    const ids = [...selected];
    startBulk(async () => {
      const res = await action(ids);
      if (res.error) toast.error(res.error);
      else {
        toast.success(
          `${verb} ${res.done} prospect${res.done === 1 ? "" : "s"}${
            res.skipped ? ` · ${res.skipped} skipped` : ""
          }.`
        );
        setSelected(new Set());
      }
    });
  };

  // Sort toggles ride the URL (server-ordered), preserving tab + search + filters + page size.
  const sortHref = (field: LeadsSort) =>
    leadsHref({ tab, q, sort: sort === field ? "newest" : field, per, filters });

  const activeFilterCount =
    (filters.industry ? 1 : 0) + (filters.min ? 1 : 0) + (filters.days ? 1 : 0) + (filters.intent ? 1 : 0);

  return (
    // Fills the page's one-screen column: toolbar pinned, the region below scrolls
    // internally (the Hot strip scrolls away with it; the thead sticks to the region top).
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Toolbar — search + filters on the left, density on the right. */}
      <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <form action="/prospects" method="get" role="search" className="relative">
            {tab !== "all" && <input type="hidden" name="tab" value={tab} />}
            {sort !== "newest" && <input type="hidden" name="sort" value={sort} />}
            {per !== 25 && <input type="hidden" name="per" value={per} />}
            {filters.industry && <input type="hidden" name="industry" value={filters.industry} />}
            {filters.min && <input type="hidden" name="min" value={filters.min} />}
            {filters.days && <input type="hidden" name="days" value={filters.days} />}
            {filters.intent && <input type="hidden" name="intent" value="1" />}
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/60"
              aria-hidden
            />
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Search name, company, title…"
              aria-label="Search prospects"
              className="h-9 w-64 rounded-lg border border-[var(--hairline)] bg-white pl-9 pr-3 text-sm shadow-[var(--shadow-sm)] placeholder:text-muted-foreground/60 focus-visible:border-[var(--cyan-line)] focus-visible:outline-none sm:w-80"
            />
          </form>

          {/* R4 filters — a GET form: every filter is URL state, shareable and back-safe. */}
          <details className="relative">
            <summary
              className={cn(
                "inline-flex h-9 cursor-pointer list-none items-center gap-1.5 rounded-lg border border-[var(--hairline)] bg-white px-3 text-sm font-medium shadow-[var(--shadow-sm)] transition-colors hover:bg-[var(--tint)] [&::-webkit-details-marker]:hidden",
                activeFilterCount > 0 && "border-[var(--cyan-line)] text-[var(--cyan-strong)]"
              )}
            >
              <SlidersHorizontal className="size-4" aria-hidden />
              Filters
              {activeFilterCount > 0 && (
                <span className="rounded-full bg-[var(--cyan-tint)] px-1.5 text-xs font-semibold">
                  {activeFilterCount}
                </span>
              )}
            </summary>
            <form
              action="/prospects"
              method="get"
              className="absolute left-0 top-11 z-20 w-72 rounded-xl border border-[var(--hairline)] bg-white p-4 shadow-lg"
            >
              {tab !== "all" && <input type="hidden" name="tab" value={tab} />}
              {q && <input type="hidden" name="q" value={q} />}
              {sort !== "newest" && <input type="hidden" name="sort" value={sort} />}
              {per !== 25 && <input type="hidden" name="per" value={per} />}
              <div className="flex flex-col gap-3 text-sm">
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-muted-foreground">Industry</span>
                  <select
                    name="industry"
                    defaultValue={filters.industry}
                    className="h-9 rounded-lg border border-[var(--hairline)] bg-white px-2 focus-visible:border-[var(--cyan-line)] focus-visible:outline-none"
                  >
                    <option value="">Any industry</option>
                    {industries.map((ind) => (
                      <option key={ind} value={ind}>
                        {ind}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-muted-foreground">Minimum score</span>
                  <select
                    name="min"
                    defaultValue={filters.min ?? ""}
                    className="h-9 rounded-lg border border-[var(--hairline)] bg-white px-2 focus-visible:border-[var(--cyan-line)] focus-visible:outline-none"
                  >
                    <option value="">Any score</option>
                    <option value="50">50+</option>
                    <option value="70">70+ (qualified)</option>
                    <option value="85">85+ (hot)</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-muted-foreground">Sourced</span>
                  <select
                    name="days"
                    defaultValue={filters.days ?? ""}
                    className="h-9 rounded-lg border border-[var(--hairline)] bg-white px-2 focus-visible:border-[var(--cyan-line)] focus-visible:outline-none"
                  >
                    <option value="">Any time</option>
                    <option value="7">Last 7 days</option>
                    <option value="30">Last 30 days</option>
                    <option value="90">Last 90 days</option>
                  </select>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="intent"
                    value="1"
                    defaultChecked={filters.intent}
                    className="size-4 accent-[var(--cyan-strong)]"
                  />
                  <span>In-market only</span>
                </label>
                <div className="flex items-center justify-between pt-1">
                  <Link href={leadsHref({ tab, q, sort, per })} className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">
                    Clear filters
                  </Link>
                  <button
                    type="submit"
                    className="rounded-lg bg-foreground px-3.5 py-1.5 text-sm font-medium text-background transition-opacity hover:opacity-90"
                  >
                    Apply
                  </button>
                </div>
              </div>
            </form>
          </details>
        </div>
        <div
          className="inline-flex items-center gap-0.5 rounded-lg border border-[var(--hairline)] bg-[var(--tint)] p-0.5"
          role="group"
          aria-label="Row density"
        >
          {(["comfortable", "compact"] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => toggleDensity(d)}
              aria-pressed={density === d}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors",
                density === d
                  ? "bg-white text-foreground shadow-[var(--shadow-sm)] ring-1 ring-[var(--hairline)]"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {d === "compact" && <Rows3 className="size-3.5" aria-hidden />}
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* R4 bulk bar — appears with a selection; suppress is permanent so it confirms hard. */}
      {selected.size > 0 && (
        <div className="mb-3 flex shrink-0 flex-wrap items-center gap-3 rounded-xl border border-[var(--cyan-line)] bg-[var(--cyan-tint)]/40 px-4 py-2.5 text-sm">
          <span className="font-medium">
            {selected.size} selected
          </span>
          <ConfirmDialog
            title={`Archive ${selected.size} prospect${selected.size === 1 ? "" : "s"}?`}
            description="Outreach to them stops (queued drafts are canceled) and they move to Archived. Their history is kept, and converted prospects are skipped."
            confirmLabel="Archive"
            onConfirm={() => runBulk(bulkArchiveLeads, "Archived")}
            trigger={(openDialog) => (
              <button
                type="button"
                onClick={openDialog}
                disabled={bulkPending}
                className="rounded-lg border border-[var(--hairline)] bg-white px-3 py-1.5 font-medium transition-colors hover:bg-[var(--tint)] disabled:opacity-50"
              >
                {bulkPending ? "Working…" : "Archive"}
              </button>
            )}
          />
          <ConfirmDialog
            title={`Never contact ${selected.size} prospect${selected.size === 1 ? "" : "s"}?`}
            description="Adds each prospect's LinkedIn profile to your suppression list permanently and cancels their queued drafts. No agent or teammate can ever message them again. This cannot be undone."
            confirmLabel="Suppress"
            destructive
            onConfirm={() => runBulk(bulkSuppressLeads, "Suppressed")}
            trigger={(openDialog) => (
              <button
                type="button"
                onClick={openDialog}
                disabled={bulkPending}
                className="rounded-lg border border-transparent px-3 py-1.5 font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
              >
                Suppress
              </button>
            )}
          />
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="ml-auto text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            Clear
          </button>
        </div>
      )}

      {/* Content region. overflow-x-hidden is the hard guarantee against sideways scroll;
          the fixed-layout table below cannot exceed its container anyway. Vertical overflow
          only ever happens on very short windows (page size fits a normal screen). */}
      <div className="min-h-0 flex-1 overflow-x-hidden lg:overflow-y-auto">
      <HotNowStrip
        hotLeads={hotLeads}
        onSelect={open}
        avgDealValueCents={avgDealValueCents}
        goalCents={goalCents}
      />

      {/* No overflow-hidden on the table container itself: it would break the sticky header.
          The thead carries its own solid bg + top rounding instead. */}
      <div className="rounded-xl border border-[var(--hairline)] bg-white" data-copilot="leads-table">
        {/* table-fixed: columns hold their proportional widths no matter how long the content
            is — text truncates inside its cell instead of stretching the table past the
            viewport (the fix for the sideways-scrolling page). */}
        <table className="w-full table-fixed text-sm">
          <thead className="sticky top-0 z-10 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <Th first className="w-[4%]">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="Select all on this page"
                  className="size-4 accent-[var(--cyan-strong)]"
                />
              </Th>
              <Th className="w-[21%]">Prospect</Th>
              <Th className="hidden w-[14%] sm:table-cell">
                <SortHeaderLink active={sort === "company"} href={sortHref("company")}>Company</SortHeaderLink>
              </Th>
              <Th className="hidden w-[22%] md:table-cell">Why now</Th>
              <Th className="w-[11%]">Status</Th>
              <Th className="w-[8%]">
                <SortHeaderLink active={sort === "score"} href={sortHref("score")}>Score</SortHeaderLink>
              </Th>
              <Th className="hidden w-[8%] xl:table-cell">Worth</Th>
              <Th last className="hidden w-[11%] lg:table-cell">
                <SortHeaderLink active={sort === "activity"} href={sortHref("activity")}>Last activity</SortHeaderLink>
              </Th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => {
              const activity = lastActivity(
                latestReply(lead)?.received_at,
                lead.scored_at,
                lead.created_at
              );
              const proj = projectedRevenue(avgDealValueCents, goalCents, lead.ai_score);
              return (
                <tr
                  key={lead.id}
                  onClick={() => open(lead)}
                  className={cn(
                    "cursor-pointer border-t border-[var(--hairline)] transition-colors hover:bg-[var(--cyan-tint)]/50",
                    selected.has(lead.id) && "bg-[var(--cyan-tint)]/30"
                  )}
                >
                  <td className={cn("px-4", cellY)} onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.has(lead.id)}
                      onChange={() => toggleOne(lead.id)}
                      aria-label={`Select ${leadName(lead)}`}
                      className="size-4 accent-[var(--cyan-strong)]"
                    />
                  </td>
                  <td className={cn("overflow-hidden px-4", cellY)}>
                    <div className="flex min-w-0 items-center gap-2">
                      <p className="truncate font-medium">{leadName(lead)}</p>
                      <SourceBadge source={lead.source} />
                    </div>
                    {lead.title && (
                      <p className="truncate text-xs text-muted-foreground">{lead.title}</p>
                    )}
                  </td>
                  <td className={cn("hidden overflow-hidden px-4 sm:table-cell", cellY)}>
                    <p className="truncate">{lead.company_name ?? "—"}</p>
                    {lead.industry && (
                      <p className="truncate text-xs text-muted-foreground">{lead.industry}</p>
                    )}
                  </td>
                  {/* The anticipation column — the real signal gets its own room, never crammed
                      under the name. Cooling rides here too: both answer "why act on this row". */}
                  <td className={cn("hidden overflow-hidden px-4 md:table-cell", cellY)}>
                    <WhyNowLine lead={lead} className="mt-0" />
                    <CoolingChip lead={lead} />
                    {!leadSignalLine(lead.lead_signals, lead.ai_insights) &&
                      !coolingState(lead.status, latestReply(lead)?.received_at ?? null) && (
                        <span className="text-muted-foreground/40">—</span>
                      )}
                  </td>
                  <td className={cn("px-4", cellY)}>
                    <StatusPill status={lead.status} />
                  </td>
                  <td className={cn("px-4", cellY)}>
                    <ScoreBadge score={lead.ai_score} />
                  </td>
                  <td className={cn("hidden overflow-hidden px-4 xl:table-cell", cellY)}>
                    {proj ? (
                      <span className="block truncate font-data font-medium tabular-nums">
                        {usd.format(proj.valueCents / 100)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/40">—</span>
                    )}
                  </td>
                  <td className={cn("hidden overflow-hidden px-4 lg:table-cell", cellY)}>
                    {activity ? (
                      <span
                        className={cn(
                          "block truncate text-xs",
                          activity.kind === "reply"
                            ? "font-medium text-[var(--positive)]"
                            : "text-muted-foreground"
                        )}
                      >
                        {activity.label}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/40">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      </div>

      {/* Side peek — work a prospect without losing your place in the list; the full brief is one
          click deeper. Same shared profiler as the dashboard prospects (never a second code path). */}
      {peek && (
        <LeadProfileSheet
          lead={peek}
          onClose={() => setPeek(null)}
          avgDealValueCents={avgDealValueCents}
          goalCents={goalCents}
          fullProfileHref={`/prospects/${peek.id}`}
        />
      )}
    </div>
  );
}
