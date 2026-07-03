import { cn } from "@/lib/utils";

/**
 * Compact activity timeline — newest first, one glanceable row per captured event:
 * a dot on a hairline rail, title, right-aligned date, and at most two clamped lines
 * of detail. The freshest event carries the cyan "you are here" marker; the forward
 * next-step lives in the panel's pinned callout, not in this list, so it can never
 * scroll out of view. Pure presentational; feed it real per-prospect events.
 */
export type TimelineItem = {
  title: string;
  description?: string;
  date?: string;
  /** the freshest event — rendered with the cyan marker */
  current?: boolean;
};

export function ModernTimeline({ items }: { items: TimelineItem[] }) {
  if (items.length === 0) return null;
  return (
    <ol className="flex flex-col">
      {items.map((item, i) => {
        const last = i === items.length - 1;
        return (
          <li key={i} className="relative flex gap-3 pb-4 last:pb-0">
            {/* node rail */}
            <div className="flex flex-col items-center pt-[5px]">
              <span
                className={cn(
                  "size-2 shrink-0 rounded-full",
                  item.current ? "bg-[var(--cyan)] ring-4 ring-[var(--cyan-tint)]" : "bg-[var(--ink-4)]/40"
                )}
              />
              {!last && <span className="mt-1.5 w-px flex-1 bg-[var(--hairline)]" />}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-medium text-foreground">{item.title}</p>
                {item.date && (
                  <span className="shrink-0 font-data text-[11px] text-muted-foreground">{item.date}</span>
                )}
              </div>
              {item.description && (
                <p className="mt-0.5 line-clamp-2 text-[13px] leading-relaxed text-[var(--ink-3)]">
                  {item.description}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
