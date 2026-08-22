"use client";

import { useRef } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { nextTab } from "./keyboard";

export type CardTab = "queue" | "replies" | "activity";

export interface TabSpec {
  key: CardTab;
  label: string;
  /** mono count badge; null on Activity */
  count: number | null;
}

/**
 * The card's tab strip (blueprint §6.7). Tabs are LINKS (`?tab=`), so the bell, the digest
 * email, and a refresh can all deep-link straight to a tab. Roving tabindex: ←/→ move
 * focus, Enter follows. The active tab's 2px underline sits on the header's hairline.
 */
export function CardTabs({ tabs, active }: { tabs: TabSpec[]; active: CardTab }) {
  const refs = useRef<(HTMLAnchorElement | null)[]>([]);
  const activeIndex = Math.max(0, tabs.findIndex((t) => t.key === active));

  return (
    <div role="tablist" aria-label="Work card" className="flex h-16 items-stretch gap-6">
      {tabs.map((tab, i) => {
        const isActive = tab.key === active;
        return (
          <Link
            key={tab.key}
            ref={(el) => {
              refs.current[i] = el;
            }}
            href={`/today?tab=${tab.key}`}
            scroll={false}
            role="tab"
            aria-selected={isActive}
            tabIndex={i === activeIndex ? 0 : -1}
            onKeyDown={(e) => {
              const to = nextTab(i, e.key, tabs.length);
              if (to === null) return;
              e.preventDefault();
              refs.current[to]?.focus();
            }}
            className={cn(
              "relative flex items-center gap-2 text-[15px] transition-colors focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]",
              isActive ? "font-semibold text-[var(--ink)]" : "font-medium text-[var(--ink-dim)] hover:text-[var(--ink)]"
            )}
          >
            {tab.label}
            {tab.count !== null && tab.count > 0 ? (
              <span
                className={cn(
                  "inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[var(--r-pill)] px-1.5 font-mono text-[12px] font-medium tabular-nums",
                  isActive ? "bg-[var(--acc-tint)] text-[var(--acc-ink)]" : "bg-[var(--surface-2)] text-[var(--ink-mid)]"
                )}
              >
                {tab.count > 99 ? "99+" : tab.count}
              </span>
            ) : null}
            {isActive ? <span aria-hidden="true" className="absolute inset-x-0 -bottom-px h-0.5 bg-[var(--ink)]" /> : null}
          </Link>
        );
      })}
    </div>
  );
}
