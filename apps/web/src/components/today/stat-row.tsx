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
        "relative flex h-[88px] min-w-0 flex-1 flex-col justify-center gap-2",
        rule &&
          "lg:pl-6 lg:before:absolute lg:before:left-0 lg:before:top-1/2 lg:before:h-7 lg:before:w-px lg:before:-translate-y-1/2 lg:before:bg-[var(--line)] lg:before:content-['']",
        className,
      )}
    >
      <dt className="truncate text-xs font-medium leading-4 text-[var(--ink-dim)]">{stat.label}</dt>
      {/* `.app-surface .font-mono` pins letter-spacing to 0; the blueprint's -0.01em needs the important flag */}
      <dd className="truncate font-mono text-[28px] font-semibold leading-8 tracking-[-0.01em]! text-[var(--ink)] max-md:text-2xl">
        {stat.value}
      </dd>
      <dd className="truncate text-[13px] leading-[18px] text-[var(--ink-dim)]">
        <MonoText text={stat.note} />
      </dd>
    </div>
  );
}

export function StatRow({ stats, className }: { stats: TodayView["stats"]; className?: string }) {
  return (
    <dl className={cn("grid grid-cols-2 gap-x-6 gap-y-4 lg:flex lg:gap-0", className)}>
      {stats.map((stat, i) => (
        <Stat key={i} stat={stat} rule={i > 0} />
      ))}
    </dl>
  );
}
