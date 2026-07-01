import { cn } from "@/lib/utils";

/**
 * Vertical activity timeline — a node rail + branded cards. Electric-cyan for the
 * past/active journey, neutral for what's still ahead (goal-gradient: there's always
 * a visible next step). Pure presentational; feed it real per-prospect events.
 */
export type TimelineStatus = "completed" | "current" | "upcoming";

export type TimelineItem = {
  title: string;
  description?: string;
  date?: string;
  category?: string;
  status?: TimelineStatus;
  icon?: React.ReactNode;
};

export function ModernTimeline({ items }: { items: TimelineItem[] }) {
  if (items.length === 0) return null;
  return (
    <ol className="relative flex flex-col">
      {items.map((item, i) => {
        const last = i === items.length - 1;
        const status = item.status ?? "completed";
        const upcoming = status === "upcoming";
        return (
          <li key={i} className="relative flex gap-4 pb-5 last:pb-0">
            {/* node rail */}
            <div className="relative flex flex-col items-center">
              <span
                className={cn(
                  "relative z-10 grid size-9 shrink-0 place-items-center rounded-full border bg-white transition-colors",
                  upcoming
                    ? "border-[var(--hairline)] text-[var(--ink-4)]"
                    : "border-[var(--cyan)] text-[var(--cyan-strong)]",
                  status === "current" && "shadow-[0_0_0_4px_rgba(11, 87, 171,0.18)]"
                )}
              >
                {item.icon ?? (
                  <span
                    className={cn(
                      "size-2 rounded-full",
                      upcoming ? "bg-[var(--ink-4)]/40" : "bg-[var(--cyan)]"
                    )}
                  />
                )}
              </span>
              {!last && <span className="w-px flex-1 bg-[var(--hairline)]" />}
            </div>

            {/* event card */}
            <div className="mb-1 flex-1 rounded-2xl border border-[var(--hairline)] bg-white p-4 shadow-[var(--shadow-card)]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  {(item.category || item.date) && (
                    <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--ink-4)]">
                      {[item.category, item.date].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  <h3 className="mt-1 text-[15px] font-semibold tracking-[-0.01em] text-foreground">{item.title}</h3>
                </div>
                <StatusPill status={status} />
              </div>
              {item.description && (
                <p className="mt-2 text-[13px] leading-relaxed text-[var(--ink-3)]">{item.description}</p>
              )}
              <span
                className={cn(
                  "mt-3 block h-1 rounded-full",
                  upcoming ? "bg-[var(--hairline)]" : "bg-gradient-to-r from-[var(--cyan)] to-[var(--cyan-strong)]"
                )}
              />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function StatusPill({ status }: { status: TimelineStatus }) {
  const styles: Record<TimelineStatus, string> = {
    completed: "bg-[var(--cyan-tint)] text-[var(--cyan-strong)]",
    current: "bg-[var(--cyan)] text-white",
    upcoming: "bg-[#f1f2f4] text-[var(--ink-4)]",
  };
  const label: Record<TimelineStatus, string> = { completed: "Done", current: "Now", upcoming: "Next" };
  return (
    <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold", styles[status])}>
      {label[status]}
    </span>
  );
}
