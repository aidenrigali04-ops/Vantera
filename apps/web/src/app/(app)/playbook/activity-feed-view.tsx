import type { ActivityItem } from "./activity-feed";

/** The narrated activity list; `agoLabel` is server-formatted so client renders stay stable. */
export function ActivityFeedView({ items }: { items: (ActivityItem & { agoLabel: string })[] }) {
  if (items.length === 0) return null;
  return (
    <section aria-label="Activity" className="w-full border-t border-[var(--hairline)] pt-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Activity</p>
      <ul className="mt-2 space-y-1.5">
        {items.map((i, n) => (
          <li key={`${i.at}-${n}`} className="flex items-baseline gap-3 text-xs">
            <span className="w-16 shrink-0 font-data tabular-nums text-muted-foreground">{i.agoLabel}</span>
            <span className={i.kind === "setup" ? "font-medium text-[var(--ink)]" : "text-[var(--ink-2)]"}>
              {i.text}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
