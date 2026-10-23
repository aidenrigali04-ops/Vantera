import Link from "next/link";
import type { StatTile, TodayView } from "@/lib/today/rows";
import { cn } from "@/lib/utils";

import { MonoText } from "./mono-text";

/**
 * Z3 · the stats row (blueprint §6.5): four unboxed stats in an 88px band, separated by
 * 28px hairline rules. Label · mono value · note, 8px apart. 2×2 under 1024px (rules
 * hidden), 24px numbers under 768px.
 */

export function Stat({ stat, rule = false, className }: { stat: StatTile; rule?: boolean; className?: string }) {
  return (
    <div
      className={cn(
        "relative flex min-w-0 flex-1 flex-col justify-center gap-2 px-5 py-5",
        rule && "lg:border-l lg:border-[var(--line)]",
        stat.href && "transition-colors hover:bg-[var(--surface-2)]",
        className,
      )}
    >

      <dt className="truncate text-xs font-medium leading-4 text-[var(--ink-dim)]">{stat.label}</dt>
      {/* `.app-surface .font-mono` pins letter-spacing to 0; the blueprint's -0.01em needs the important flag */}
      <dd className="truncate font-mono text-[30px] font-semibold leading-8 tracking-[-0.03em]! text-[var(--ink)] max-md:text-2xl">
        {stat.href ? (
          // stretched link: the whole tile opens where the number lives, and dt/dd stay valid
          <Link
            href={stat.href}
            aria-label={`${stat.label}: ${stat.value}`}
            className="rounded-[var(--r-card)] after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:shadow-[var(--focus-ring)]"
          >
            {stat.value}
          </Link>
        ) : (
          stat.value
        )}
      </dd>
      <dd className="truncate text-[13px] leading-[18px] text-[var(--ink-dim)]">
        <MonoText text={stat.note} />
      </dd>
    </div>
  );
}

export function StatRow({ stats, className }: { stats: TodayView["stats"]; className?: string }) {
  return (
    <dl
      className={cn(
        "grid grid-cols-2 overflow-hidden rounded-[var(--r-card)] bg-[var(--surface)] shadow-[var(--shadow-card)] ring-1 ring-[var(--line)] max-lg:[&>*:nth-child(even)]:border-l max-lg:[&>*:nth-child(even)]:border-[var(--line)] max-lg:[&>*:nth-child(n+3)]:border-t max-lg:[&>*:nth-child(n+3)]:border-[var(--line)] lg:flex",
        className,
      )}
    >
      {stats.map((stat, i) => (
        <Stat key={i} stat={stat} rule={i > 0} />
      ))}
    </dl>
  );
}
