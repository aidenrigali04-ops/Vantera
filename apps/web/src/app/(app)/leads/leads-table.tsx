"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowDown, Flame, Rows3, Search, Snowflake, Zap } from "lucide-react";
import { PANEL_SURFACE, Eyebrow } from "@/components/ui/panel";
import { ScoreBadge, SourceBadge, WhyNowLine } from "@/components/lead-why-now";
import { LeadProfileSheet } from "@/components/lead-profile";
import { cn } from "@/lib/utils";
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

export type LeadsSort = "newest" | "score";

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
// intent vocabulary, reused by the dashboard Hot-leads panel and the Review queue.

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
 * "Hot right now" — the freshest, highest-fit leads pulled to the top as a scannable opportunity
 * feed (retention: variable reward — the reason to open Leads daily). Cards open the same profiler
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
    <section className="mb-5" data-copilot="hot-leads">
      <div className="mb-2.5 flex items-center gap-1.5">
        <Flame className="size-4 text-[var(--positive)]" aria-hidden />
        <Eyebrow>Hot right now</Eyebrow>
        <span className="text-xs text-muted-foreground">— your strongest-fit leads to work today</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {hotLeads.map((lead) => (
          <button
            key={lead.id}
            type="button"
            onClick={() => onSelect(lead)}
            className={cn(
              PANEL_SURFACE,
              "group flex flex-col gap-2 p-4 text-left shadow-none ring-1 ring-inset ring-[var(--positive-line)] transition-colors hover:ring-[var(--positive)]"
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="truncate font-medium">{leadName(lead)}</p>
                  <SourceBadge source={lead.source} />
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {[lead.title, lead.company_name].filter(Boolean).join(" · ") || "—"}
                </p>
              </div>
              <ScoreBadge score={lead.ai_score} />
            </div>
            {(() => {
              const signal = leadSignalLine(lead.lead_signals, lead.ai_insights);
              return signal ? (
                <p className="flex items-center gap-1 text-xs text-[var(--positive)]">
                  <Zap className="size-3 shrink-0" aria-hidden />
                  <span className="truncate">{signal}</span>
                </p>
              ) : null;
            })()}
            {/* Value framing — the same worth-toward-goal line as the dashboard spotlight. */}
            {(() => {
              const proj = projectedRevenue(avgDealValueCents, goalCents, lead.ai_score);
              return proj ? (
                <p className="text-xs text-muted-foreground">
                  Worth <span className="font-data font-semibold text-foreground">{usd.format(proj.valueCents / 100)}</span>
                  {proj.dealsToGoal != null && <> · 1 of ~{proj.dealsToGoal} to your goal</>}
                </p>
              ) : null;
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
}: {
  leads: LeadRow[];
  hotLeads?: LeadRow[];
  avgDealValueCents: number | null;
  goalCents: number | null;
  tab?: string;
  q?: string;
  sort?: LeadsSort;
}) {
  const [peek, setPeek] = useState<LeadRow | null>(null);
  const density = useSyncExternalStore(subscribeDensity, readDensity, () => "comfortable" as const);
  const toggleDensity = writeDensity;

  const open = (lead: LeadRow) => setPeek(lead);
  const cellY = density === "compact" ? "py-1.5" : "py-3";

  // Sort toggles ride the URL (server-ordered), preserving the active tab + search.
  const sortHref = (next: LeadsSort) => {
    const params = new URLSearchParams();
    if (tab !== "all") params.set("tab", tab);
    if (q) params.set("q", q);
    if (next !== "newest") params.set("sort", next);
    const query = params.toString();
    return query ? `/leads?${query}` : "/leads";
  };

  return (
    <>
      <HotNowStrip
        hotLeads={hotLeads}
        onSelect={open}
        avgDealValueCents={avgDealValueCents}
        goalCents={goalCents}
      />

      {/* Toolbar — search on the left, density on the right; one quiet row, no panel chrome. */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <form action="/leads" method="get" role="search" className="relative">
          {tab !== "all" && <input type="hidden" name="tab" value={tab} />}
          {sort !== "newest" && <input type="hidden" name="sort" value={sort} />}
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/60"
            aria-hidden
          />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search name, company, title…"
            aria-label="Search leads"
            className="h-9 w-64 rounded-lg border border-[var(--hairline)] bg-white pl-9 pr-3 text-sm shadow-[var(--shadow-sm)] placeholder:text-muted-foreground/60 focus-visible:border-[var(--cyan-line)] focus-visible:outline-none sm:w-80"
          />
        </form>
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

      {/* No overflow-hidden on the container: it would break the sticky header. The thead carries
          its own solid bg + top rounding instead. */}
      <div className="rounded-xl border border-[var(--hairline)] bg-white" data-copilot="leads-table">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <Th first>Prospect</Th>
              <Th className="hidden sm:table-cell">Company</Th>
              <Th className="hidden md:table-cell">Why now</Th>
              <Th>Status</Th>
              <Th>
                <Link
                  href={sortHref(sort === "score" ? "newest" : "score")}
                  className={cn(
                    "inline-flex items-center gap-1 transition-colors hover:text-foreground",
                    sort === "score" && "text-foreground"
                  )}
                >
                  Score
                  <ArrowDown className={cn("size-3", sort !== "score" && "opacity-30")} aria-hidden />
                </Link>
              </Th>
              <Th className="hidden xl:table-cell">Worth</Th>
              <Th last className="hidden lg:table-cell">
                Last activity
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
                  className="cursor-pointer border-t border-[var(--hairline)] transition-colors hover:bg-[var(--cyan-tint)]/50"
                >
                  <td className={cn("px-4", cellY)}>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{leadName(lead)}</p>
                      <SourceBadge source={lead.source} />
                    </div>
                    {lead.title && (
                      <p className="truncate text-xs text-muted-foreground">{lead.title}</p>
                    )}
                  </td>
                  <td className={cn("hidden px-4 sm:table-cell", cellY)}>
                    <p className="truncate">{lead.company_name ?? "—"}</p>
                    {lead.industry && (
                      <p className="truncate text-xs text-muted-foreground">{lead.industry}</p>
                    )}
                  </td>
                  {/* The anticipation column — the real signal gets its own room, never crammed
                      under the name. Cooling rides here too: both answer "why act on this row". */}
                  <td className={cn("hidden max-w-64 px-4 md:table-cell", cellY)}>
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
                  <td className={cn("hidden whitespace-nowrap px-4 xl:table-cell", cellY)}>
                    {proj ? (
                      <span className="font-data font-medium tabular-nums">
                        {usd.format(proj.valueCents / 100)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/40">—</span>
                    )}
                  </td>
                  <td className={cn("hidden whitespace-nowrap px-4 lg:table-cell", cellY)}>
                    {activity ? (
                      <span
                        className={cn(
                          "text-xs",
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

      {/* Side peek — work a lead without losing your place in the list; the full brief is one
          click deeper. Same shared profiler as the dashboard prospects (never a second code path). */}
      {peek && (
        <LeadProfileSheet
          lead={peek}
          onClose={() => setPeek(null)}
          avgDealValueCents={avgDealValueCents}
          goalCents={goalCents}
          fullProfileHref={`/leads/${peek.id}`}
        />
      )}
    </>
  );
}
