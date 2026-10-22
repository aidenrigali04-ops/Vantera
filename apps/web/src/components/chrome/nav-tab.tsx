"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatBadge } from "./nav-items";
import { CHROME_FOCUS, CHROME_MOTION } from "./tile";

export type NavTabProps = {
  href: string;
  label: string;
  active: boolean;
  /** Raw count; hidden at 0, capped at "99+" (formatBadge). */
  badge?: number;
};

/**
 * One primary-nav tab: 32px tall, 14px/500 --ink-mid; the active tab sits on --acc-tint in
 * --acc-ink at 600. The label is stacked over an invisible semibold twin so the tab keeps
 * the same width in both weights — switching tabs never nudges the centered pill.
 */
export function NavTab({ href, label, active, badge }: NavTabProps) {
  const badgeText = formatBadge(badge);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        // --r-chip (6px), not --r-btn: concentric inside the 10px pill's 4px inset.
        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[var(--r-pill)] px-3.5 text-[13.5px] font-medium",
        CHROME_MOTION,
        CHROME_FOCUS,
        active
          ? "bg-[var(--surface)] font-semibold text-[var(--acc)] shadow-[0_1px_2px_rgba(12,16,26,0.08)]"
          : "text-[var(--ink-mid)] hover:text-[var(--ink)]"
      )}
    >
      <span className="grid justify-items-center">
        <span className="col-start-1 row-start-1">{label}</span>
        <span aria-hidden="true" className="invisible col-start-1 row-start-1 font-semibold">
          {label}
        </span>
      </span>
      {badgeText && (
        <span
          className={cn(
            "inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[var(--r-pill)] px-1.5 font-mono text-[11px] font-semibold leading-none",
            active ? "bg-[var(--acc-tint)] text-[var(--acc-ink)]" : "bg-[var(--surface)] text-[var(--ink-mid)] ring-1 ring-[var(--line)]"
          )}
        >
          {badgeText}
        </span>
      )}
    </Link>
  );
}
