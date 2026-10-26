"use client";

import { Radar } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WhyNowCell as WhyNowCellModel } from "@/lib/prospects/why-now-cell";
import {
  leadSignalLine,
  scoreVerdict,
  tierGlyph,
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
        <span className="size-1.5 shrink-0 rounded-full bg-[var(--acc)]" aria-hidden />
      )}
      {/* min-w-0 lets the flex item shrink so truncate actually clips inside fixed table cells */}
      <span className="min-w-0 truncate">{isIntent ? `In-market: ${signal}` : signal}</span>
    </p>
  );
}

// Score tiers on the same positive→amber ramp: hot gets the filled tint, strong just the ring,
// "look" steps to amber (caution), unscored is muted. No glow — the tint + the number carry it.
const SCORE_BADGE_CLASS: Record<ScoreTier, string> = {
  hot: "bg-[var(--acc-tint)] text-[var(--acc-ink)]",
  strong: "bg-[var(--positive-tint)] text-[var(--positive)]",
  look: "bg-[var(--attention-tint)] text-[var(--attention)]",
  unscored: "text-muted-foreground/60",
};

/** Three rising bars, lit by tier (hot 3 · strong 2 · look 1 · unscored 0) — the tier reads at a glance. */
export function TierGlyph({ score }: { score: number | null }) {
  const lit = tierGlyph(score);
  const { label } = scoreVerdict(score);
  return (
    <span className="inline-flex items-end gap-0.5" role="img" aria-label={label}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          data-bar={i}
          data-lit={i < lit ? "true" : "false"}
          className={cn(
            "w-1 rounded-sm",
            i === 0 ? "h-1.5" : i === 1 ? "h-2.5" : "h-3.5",
            i < lit ? "bg-[var(--acc)]" : "bg-[var(--line)]"
          )}
        />
      ))}
    </span>
  );
}

/** The fit chip. `withVerdict` spells the tier out ("Hot prospect · 91") so the number needs no decoding;
 *  `glyph` prefixes the three-bar tier glyph (Prospects table) — off by default so other surfaces are unchanged. */
export function ScoreBadge({
  score,
  withVerdict = false,
  glyph = false,
}: {
  score: number | null;
  withVerdict?: boolean;
  glyph?: boolean;
}) {
  if (score == null) {
    const dash = <span className="font-mono text-muted-foreground/50">—</span>;
    if (!glyph) return dash;
    return (
      <span className="inline-flex items-center gap-1.5">
        <TierGlyph score={null} />
        {dash}
      </span>
    );
  }
  const { tier, label } = scoreVerdict(score);
  const chip = (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 font-mono text-xs font-semibold tabular-nums",
        SCORE_BADGE_CLASS[tier]
      )}
    >
      {withVerdict ? `${label} · ${score}` : score}
    </span>
  );
  if (!glyph) return chip;
  return (
    <span className="inline-flex items-center gap-1.5">
      <TierGlyph score={score} />
      {chip}
    </span>
  );
}

/** The Prospects "why now" cell: `label · when`, the source post title linked when it has a real URL, and a
 *  `+N` chip for the rest of the signals (opens the peek on Signals). `when` is precomputed server-side. */
export function WhyNowCellView({
  cell,
  postTitle,
  onMore,
  className,
}: {
  cell: WhyNowCellModel;
  /** headline of the linked post (the row's intent_posts entry whose post_ref is `cell.href`) */
  postTitle?: string | null;
  onMore?: () => void;
  className?: string;
}) {
  if (!cell) return null;
  const isIntent = cell.kind === "intent";
  return (
    <div className={cn("flex min-w-0 items-center gap-1.5 text-xs", className)}>
      {isIntent ? (
        <Radar className="size-3 shrink-0 text-[var(--positive)]" aria-hidden />
      ) : (
        <span className="size-1.5 shrink-0 rounded-full bg-[var(--acc)]" aria-hidden />
      )}
      <span className={cn("min-w-0 truncate", isIntent ? "text-[var(--positive)]" : "text-[var(--ink-2)]")}>
        {cell.label}
        {cell.when && <span className="text-muted-foreground"> · {cell.when}</span>}
        {cell.href && (
          <>
            <span className="text-muted-foreground"> · </span>
            <a
              href={cell.href}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-[var(--ink-mid)] underline decoration-[var(--line)] underline-offset-2 hover:decoration-current"
            >
              {postTitle?.trim() || "View post"}
            </a>
          </>
        )}
      </span>
      {cell.more > 0 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onMore?.();
          }}
          aria-label={`${cell.more} more signal${cell.more === 1 ? "" : "s"}`}
          className="shrink-0 rounded-full bg-[var(--surface-2)] px-1.5 py-0.5 font-mono text-[11px] font-medium tabular-nums text-[var(--ink-mid)] transition-colors hover:bg-[var(--acc-tint)] hover:text-[var(--acc-ink)]"
        >
          +{cell.more}
        </button>
      )}
    </div>
  );
}
