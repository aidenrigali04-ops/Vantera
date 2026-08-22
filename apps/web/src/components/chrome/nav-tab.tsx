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
        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[var(--r-chip)] px-3.5 text-sm font-medium text-[var(--ink-mid)]",
        CHROME_MOTION,
        CHROME_FOCUS,
        active ? "bg-[var(--acc-tint)] font-semibold text-[var(--acc-ink)]" : "hover:bg-[var(--surface-2)]"
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
            "inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[var(--r-pill)] px-1 font-mono text-xs font-medium leading-none",
            active ? "bg-[var(--surface)] text-[var(--acc-ink)]" : "bg-[var(--surface-2)] text-[var(--ink-mid)]"
          )}
        >
          {badgeText}
        </span>
      )}
    </Link>
  );
}
