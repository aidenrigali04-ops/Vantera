import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The app's page chrome, taken from the landing's app replica
 * (components/landing/app-replica.tsx) so the product reads as the page that sold it:
 * a tight semibold title over a quiet subtitle, status chips on the right, and white
 * hairline panels on the canvas. One border level per region (rule 07).
 */

/** A white hairline panel on the canvas — the replica's list and thread panes. */
export const PANEL =
  "rounded-[var(--r-card)] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-card)]";

/** A row inside a PANEL list: hairline between rows, blue-tint hover. */
export const PANEL_ROW =
  "border-b border-[var(--line)] transition-colors last:border-b-0 hover:bg-[#f5f9ff]";

export function PageHeader({
  title,
  subtitle,
  children,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Status chips or actions, right-aligned on wide screens. */
  children?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex shrink-0 flex-wrap items-end justify-between gap-x-6 gap-y-3", className)}>
      <div className="min-w-0">
        <h1 className="text-[26px] font-semibold leading-8 tracking-[-0.03em] text-[var(--ink)]">{title}</h1>
        {subtitle && <p className="mt-1 max-w-[72ch] text-[14px] leading-5 text-[var(--ink-dim)]">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </header>
  );
}

/** A small rounded status chip: neutral with a coloured dot, or tinted blue. */
export function StatusChip({
  children,
  dot,
  tone = "neutral",
}: {
  children: ReactNode;
  /** A dot colour for live/attention states, e.g. var(--positive). */
  dot?: string;
  tone?: "neutral" | "blue";
}) {
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-[var(--r-pill)] px-2.5 text-[12px] font-medium tabular-nums",
        tone === "blue"
          ? "bg-[var(--acc-tint)] font-semibold text-[var(--acc-ink)]"
          : "border border-[var(--line)] bg-[var(--surface)] text-[var(--ink-mid)]"
      )}
    >
      {dot && <span aria-hidden className="size-1.5 rounded-full" style={{ backgroundColor: dot }} />}
      {children}
    </span>
  );
}

/** The segmented filter track: grey rail, white active segment — the replica's filters. */
export const SEGMENT_TRACK =
  "inline-flex items-center gap-0.5 rounded-[var(--r-btn)] border border-[var(--line)] bg-[var(--surface-2)] p-0.5 text-[13px]";

export function segmentClass(active: boolean): string {
  return cn(
    "inline-flex h-7 items-center rounded-[6px] px-3 font-medium transition-colors",
    active
      ? "bg-[var(--surface)] text-[var(--ink)] shadow-[0_1px_2px_rgba(12,16,26,0.08)]"
      : "text-[var(--ink-dim)] hover:text-[var(--ink)]"
  );
}
