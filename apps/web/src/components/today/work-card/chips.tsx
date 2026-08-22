import type { ReactNode } from "react";
import { ArrowUpRight, Briefcase, MessageCircle, Rocket, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { QueueRow, ReplyClass } from "@/lib/today/rows";

/**
 * The card's chip grammar (blueprint §6.10–§6.11). Common shape: 24px tall, 8px padding,
 * `--r-chip`, 12px/500, no shadow, never clickable (SenderChip is the one exception and
 * lives in its own file). Color carries MEANING only — status, interactive, attention.
 */

const CHIP = "inline-flex h-6 max-w-full items-center gap-1.5 rounded-[var(--r-chip)] px-2 text-[12px] font-medium";

const SIGNAL_GLYPHS: Record<NonNullable<NonNullable<QueueRow["signal"]>["glyph"]>, LucideIcon> = {
  briefcase: Briefcase,
  "message-circle": MessageCircle,
  "arrow-up-right": ArrowUpRight,
  rocket: Rocket,
};

/** A prospect's initials square — 28px in rows, 40px in the peek. */
export function Avatar({ initials, size = 28, className }: { initials: string; size?: 28 | 40; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid shrink-0 place-items-center rounded-[var(--r-btn)] bg-[var(--surface-2)] font-mono font-semibold text-[var(--ink-mid)]",
        size === 28 ? "size-7 text-[11px]" : "size-10 text-[13px]",
        className
      )}
    >
      {initials}
    </span>
  );
}

/** The top `lead_signals` row: what changed, and how long ago. */
export function SignalChip({ signal }: { signal: NonNullable<QueueRow["signal"]> }) {
  const Icon = signal.glyph ? SIGNAL_GLYPHS[signal.glyph] : null;
  return (
    <span className={cn(CHIP, "bg-[var(--surface-2)] text-[var(--ink-mid)]")}>
      {Icon ? <Icon size={12} strokeWidth={1.75} className="shrink-0" aria-hidden="true" /> : null}
      <span className="truncate">{signal.label}</span>
      {signal.age ? <span className="shrink-0 font-mono text-[var(--ink-dim)]">· {signal.age}</span> : null}
    </span>
  );
}

const CLASS_TONE: Record<ReplyClass, string> = {
  Interested: "bg-[var(--acc-tint)] text-[var(--acc-ink)]",
  Neutral: "bg-[var(--surface-2)] text-[var(--ink-mid)]",
  "Out of office": "bg-[var(--surface-2)] text-[var(--ink-dim)]",
  "Needs you": "bg-[var(--attention-tint)] text-[var(--attention)]",
};

export function ClassChip({ klass }: { klass: ReplyClass }) {
  return <span className={cn(CHIP, CLASS_TONE[klass])}>{klass}</span>;
}

/**
 * The 0–100 fit score on a NEUTRAL ramp — never traffic lights (a 74 is not "bad", it is
 * simply further down the same queue). Only the top band earns the accent.
 */
export function scoreTone(score: number): string {
  if (score >= 90) return "bg-[var(--acc-tint)] text-[var(--acc-ink)]";
  if (score >= 80) return "bg-[var(--surface-2)] text-[var(--ink)]";
  return "bg-[var(--surface-2)] text-[var(--ink-mid)]";
}

export function ScoreChip({ score, title }: { score: number; title?: string }) {
  return (
    <span title={title} className={cn(CHIP, "justify-center font-mono font-semibold tabular-nums", scoreTone(score))}>
      {score}
    </span>
  );
}

/** Who did it: an agent, a sender, or you. */
export function ActorChip({ children }: { children: ReactNode }) {
  return <span className={cn(CHIP, "bg-[var(--surface-2)] text-[var(--ink-mid)]")}>{children}</span>;
}
