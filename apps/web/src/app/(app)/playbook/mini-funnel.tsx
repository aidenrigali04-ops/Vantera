import { Fragment } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MiniStage } from "./card-funnel";

/** A card-sized funnel row: count per stage, step-over-step % muted. Server-computed data only. */
export function MiniFunnel({
  stages,
  label,
  empty,
  className,
}: {
  stages: MiniStage[];
  label: string;
  /** shown under the row when every stage is zero, e.g. "No run yet" */
  empty?: string;
  className?: string;
}) {
  const allZero = stages.every((s) => s.count === 0);
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <ol aria-label={label} className="flex flex-wrap items-end gap-x-2 gap-y-2">
        {stages.map((s, i) => (
          <Fragment key={s.label}>
            {i > 0 && <ChevronRight aria-hidden className="mb-1 size-3.5 text-muted-foreground/50" />}
            <li className="flex flex-col">
              <span className="flex items-baseline gap-1.5">
                <span className="font-data text-base font-semibold tabular-nums">{s.count}</span>
                {s.pct !== null && (
                  <span className="font-data text-[11px] tabular-nums text-muted-foreground">{s.pct}%</span>
                )}
              </span>
              <span className="text-[11px] text-muted-foreground">{s.label}</span>
            </li>
          </Fragment>
        ))}
      </ol>
      {allZero && empty && <p className="text-xs text-muted-foreground">{empty}</p>}
    </div>
  );
}
