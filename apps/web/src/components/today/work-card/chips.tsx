import type { ReactNode } from "react";
import { ArrowUpRight, Banknote, Briefcase, MessageCircle, type LucideIcon } from "lucide-react";
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
  banknote: Banknote,
};

/** A prospect's initials square — 28px in rows, 40px in the peek. */
/** The landing replica's avatar hues (components/landing/app-replica.tsx). All clear
 *  4.5:1 against white initials. */
export const AVATAR_TINTS = ["#1877f2", "#5e6ad2", "#0f9d6e", "#0c8ab5", "#d97706", "#c2557d"] as const;

/** A stable hue per person: the same initials always land on the same tint. */
export function avatarTint(initials: string): string {
  let h = 0;
  for (const ch of initials) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_TINTS[h % AVATAR_TINTS.length];
}

export function Avatar({ initials, size = 28, className }: { initials: string; size?: 28 | 40; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid shrink-0 place-items-center rounded-full font-semibold text-white",
        size === 28 ? "size-8 text-[11px]" : "size-10 text-[13px]",
        className
      )}
      style={{ backgroundColor: avatarTint(initials) }}
    >
      {initials}
    </span>
  );
}

/** The top `lead_signals` row: what changed, and how long ago. */
export function SignalChip({ signal }: { signal: NonNullable<QueueRow["signal"]> }) {
  const Icon = signal.glyph ? SIGNAL_GLYPHS[signal.glyph] : null;
  return (
    <span className={cn(CHIP, "rounded-[var(--r-pill)] bg-[#fbfcfe] text-[var(--ink-mid)] ring-1 ring-[var(--line)]")}>
      {Icon ? (
        <Icon size={12} strokeWidth={2} className="shrink-0 text-[var(--acc)]" aria-hidden="true" />
      ) : (
        <span aria-hidden="true" className="size-1 shrink-0 rounded-full bg-[var(--acc)]" />
      )}
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
  if (score >= 80) return "bg-[var(--positive-tint)] text-[var(--positive)]";
  return "bg-[var(--surface-2)] text-[var(--ink-mid)]";
}

export function ScoreChip({ score, title }: { score: number; title?: string }) {
  return (
    <span title={title} className={cn(CHIP, "justify-center rounded-[var(--r-pill)] px-2.5 font-mono font-semibold tabular-nums", scoreTone(score))}>
      {score}
    </span>
  );
}

/** Who did it: an agent, a sender, or you. */
export function ActorChip({ children }: { children: ReactNode }) {
  return <span className={cn(CHIP, "bg-[var(--surface-2)] text-[var(--ink-mid)]")}>{children}</span>;
}
