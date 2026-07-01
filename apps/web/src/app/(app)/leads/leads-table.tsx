"use client";

import { useRouter } from "next/navigation";
import { Flame, Mail, Phone, Radar, Snowflake, UserPlus, Zap } from "lucide-react";
import { PANEL_SURFACE, Eyebrow } from "@/components/ui/panel";
import { cn } from "@/lib/utils";
import {
  coolingState,
  leadSignalLine,
  scoreVerdict,
  topLeadSignal,
  type LeadSignalView,
  type ScoreTier,
} from "./lead-value";

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
  industry: string | null;
  location: string | null;
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
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        STATUS_CLASS[status] ?? "text-muted-foreground ring-1 ring-inset ring-border"
      )}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

// Score tiers on the same positive→amber ramp: hot gets the filled tint, strong just the ring,
// "look" steps to amber (caution), unscored is muted. No glow — the tint + the number carry it.
const SCORE_BADGE_CLASS: Record<ScoreTier, string> = {
  hot: "bg-[var(--positive-tint)] text-[var(--positive)] ring-1 ring-inset ring-[var(--positive-line)]",
  strong: "text-[var(--positive)] ring-1 ring-inset ring-[var(--positive-line)]",
  look: "bg-amber-500/10 text-amber-700 ring-1 ring-inset ring-amber-500/25",
  unscored: "text-muted-foreground/60",
};

function ScoreBadge({ score }: { score: number | null }) {
  if (score == null)
    return <span className="font-mono text-muted-foreground/50">—</span>;
  const { tier } = scoreVerdict(score);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 font-mono text-xs font-semibold tabular-nums",
        SCORE_BADGE_CLASS[tier]
      )}
    >
      {score}
    </span>
  );
}

function leadName(lead: LeadRow): string {
  return [lead.first_name, lead.last_name].filter(Boolean).join(" ") || "Unknown";
}

/** Marks where a lead entered the funnel. Intent leads get a distinct "In-market" badge — the
 *  differentiator made visible: these people are showing buying behavior on LinkedIn right now. */
function SourceBadge({ source }: { source: string }) {
  if (source !== "intent") return null;
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--positive-tint)] px-2 py-0.5 text-[11px] font-medium text-[var(--positive)] ring-1 ring-inset ring-[var(--positive-line)]">
      <Radar className="size-3" aria-hidden />
      In-market
    </span>
  );
}

/** The one-line "why now" — anticipation hit. An intent observation (in-market behavior) reads
 *  distinctly from an enrichment signal; real captured signal first, AI trigger as fallback. */
function WhyNowLine({ lead }: { lead: LeadRow }) {
  const isIntent = topLeadSignal(lead.lead_signals)?.kind === "intent";
  const signal = leadSignalLine(lead.lead_signals, lead.ai_insights);
  if (!signal) return null;
  return (
    <p
      className={cn(
        "mt-1 flex items-center gap-1 text-xs",
        isIntent ? "text-[var(--positive)]" : "text-muted-foreground"
      )}
    >
      {isIntent ? (
        <Radar className="size-3 shrink-0" aria-hidden />
      ) : (
        <Zap className="size-3 shrink-0 text-[var(--positive)]" aria-hidden />
      )}
      <span className="truncate">{isIntent ? `In-market: ${signal}` : signal}</span>
    </p>
  );
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
}: {
  hotLeads: LeadRow[];
  onSelect: (lead: LeadRow) => void;
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
              "group flex flex-col gap-2 p-4 text-left ring-1 ring-inset ring-[var(--positive-line)] transition-colors hover:ring-[var(--positive)]"
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
            <span className="mt-auto flex gap-1.5 pt-1 text-muted-foreground">
              <Mail className={cn("size-4", lead.email ? "text-foreground" : "text-muted-foreground/30")} />
              <UserPlus
                className={cn("size-4", lead.linkedin_url ? "text-foreground" : "text-muted-foreground/30")}
              />
              <Phone className={cn("size-4", lead.phone ? "text-foreground" : "text-muted-foreground/30")} />
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

export function LeadsTable({
  leads,
  hotLeads = [],
  avgDealValueCents,
  goalCents,
}: {
  leads: LeadRow[];
  hotLeads?: LeadRow[];
  avgDealValueCents: number | null;
  goalCents: number | null;
}) {
  const router = useRouter();
  const open = (lead: LeadRow) => router.push(`/leads/${lead.id}`);

  return (
    <>
      <HotNowStrip hotLeads={hotLeads} onSelect={open} />
      <div
        className="overflow-hidden rounded-xl border border-[var(--hairline)]"
        data-copilot="leads-table"
      >
        <table className="w-full text-sm">
          <thead className="bg-foreground/[0.03] text-left text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">Prospect</th>
              <th className="hidden px-4 py-2.5 font-medium sm:table-cell">Company</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">Score</th>
              <th className="px-4 py-2.5 text-right font-medium">Channels</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr
                key={lead.id}
                onClick={() => open(lead)}
                className="cursor-pointer border-t border-[var(--hairline)] transition-colors hover:bg-[var(--cyan-tint)]/50"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{leadName(lead)}</p>
                    <SourceBadge source={lead.source} />
                  </div>
                  {lead.title && <p className="text-xs text-muted-foreground">{lead.title}</p>}
                  <WhyNowLine lead={lead} />
                  <CoolingChip lead={lead} />
                </td>
                <td className="hidden px-4 py-3 sm:table-cell">
                  <p>{lead.company_name ?? "—"}</p>
                  {lead.industry && (
                    <p className="text-xs text-muted-foreground">{lead.industry}</p>
                  )}
                </td>
                <td className="px-4 py-3">
                  <StatusPill status={lead.status} />
                </td>
                <td className="px-4 py-3">
                  <ScoreBadge score={lead.ai_score} />
                </td>
                <td className="px-4 py-3">
                  <span className="flex justify-end gap-1.5">
                    <Mail
                      className={cn(
                        "size-4",
                        lead.email ? "text-foreground" : "text-muted-foreground/30"
                      )}
                    />
                    <UserPlus
                      className={cn(
                        "size-4",
                        lead.linkedin_url ? "text-foreground" : "text-muted-foreground/30"
                      )}
                    />
                    <Phone
                      className={cn(
                        "size-4",
                        lead.phone ? "text-foreground" : "text-muted-foreground/30"
                      )}
                    />
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </>
  );
}
