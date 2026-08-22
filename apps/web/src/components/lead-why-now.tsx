"use client";

import { Radar, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  leadSignalLine,
  scoreVerdict,
  topLeadSignal,
  type LeadSignalView,
  type ScoreTier,
} from "@/app/(app)/prospects/lead-value";

/**
 * The shared intent vocabulary — one place for how a lead's origin and "why now"
 * read everywhere a lead surfaces (Prospects table, dashboard Hot leads, Approvals).
 * Extracted from leads-table.tsx so the treatments can never drift apart.
 */

/** Marks where a lead entered the funnel. Intent leads get a distinct "In-market" badge — the
 *  differentiator made visible: these people are showing buying behavior on LinkedIn right now. */
export function SourceBadge({ source }: { source: string | null | undefined }) {
  if (source !== "intent") return null;
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--positive-tint)] px-2 py-0.5 text-[11px] font-medium text-[var(--positive)] ring-1 ring-inset ring-[var(--positive-line)]">
      <Radar className="size-3" aria-hidden />
      In-market
    </span>
  );
}

/** Structural shape — satisfied by both the Leads table's LeadRow and the shared LeadProfile. */
export interface WhyNowLead {
  lead_signals?: LeadSignalView[] | null;
  ai_insights?: { triggers?: string[]; pain_points?: string[] } | null;
}

/** The one-line "why now" — anticipation hit. An intent observation (in-market behavior) reads
 *  distinctly from an enrichment signal; real captured signal first, AI trigger as fallback. */
export function WhyNowLine({ lead, className }: { lead: WhyNowLead; className?: string }) {
  const isIntent = topLeadSignal(lead.lead_signals)?.kind === "intent";
  const signal = leadSignalLine(lead.lead_signals, lead.ai_insights);
  if (!signal) return null;
  return (
    <p
      className={cn(
        "mt-1 flex items-center gap-1 text-xs",
        isIntent ? "text-[var(--positive)]" : "text-muted-foreground",
        className
      )}
    >
      {isIntent ? (
        <Radar className="size-3 shrink-0" aria-hidden />
      ) : (
        <Zap className="size-3 shrink-0 text-[var(--positive)]" aria-hidden />
      )}
      {/* min-w-0 lets the flex item shrink so truncate actually clips inside fixed table cells */}
      <span className="min-w-0 truncate">{isIntent ? `In-market: ${signal}` : signal}</span>
    </p>
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

/** The fit chip. `withVerdict` spells the tier out ("Hot prospect · 91") so the number needs no decoding. */
export function ScoreBadge({ score, withVerdict = false }: { score: number | null; withVerdict?: boolean }) {
  if (score == null) return <span className="font-mono text-muted-foreground/50">—</span>;
  const { tier, label } = scoreVerdict(score);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 font-mono text-xs font-semibold tabular-nums",
        SCORE_BADGE_CLASS[tier]
      )}
    >
      {withVerdict ? `${label} · ${score}` : score}
    </span>
  );
}
