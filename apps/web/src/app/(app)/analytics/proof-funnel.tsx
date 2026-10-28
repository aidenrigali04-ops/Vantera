import { Panel, Eyebrow } from "@/components/ui/panel";
import type { ProofStage } from "@/lib/proof/types";

// The eight-stage count funnel — Found through Closed, counted from the account's own
// prospects, replies and meetings. Counts only; no dollars, so it never waits on a deal value.
// Each pct is the share of the stage before it, shown muted when there is a stage before.
export function ProofFunnel({ funnel, nonMonotonic }: { funnel: ProofStage[]; nonMonotonic: boolean }) {
  const top = Math.max(0, ...funnel.map((s) => s.count));
  return (
    <Panel>
      <Eyebrow>From found to closed</Eyebrow>
      <div className="mt-5 space-y-4">
        {funnel.map((stage) => {
          const widthPct =
            top > 0 && stage.count > 0 ? Math.max(3, Math.round((stage.count / top) * 100)) : 0;
          return (
            <div key={stage.key}>
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-foreground">{stage.label}</span>
                <span className="flex items-baseline gap-3">
                  {stage.pct !== null && (
                    <span className="font-data text-[11px] tabular-nums text-muted-foreground">
                      {stage.pct}%
                    </span>
                  )}
                  <span className="font-data font-semibold tabular-nums">
                    {stage.count.toLocaleString("en-US")}
                  </span>
                </span>
              </div>
              <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-[var(--tint)] ring-1 ring-inset ring-[var(--hairline)]">
                <div
                  className="h-full rounded-full bg-[var(--cyan)] transition-[width] duration-500"
                  style={{ width: `${widthPct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-5 text-xs text-muted-foreground">
        Contacted includes messages to existing connections; Meetings includes deals closed without
        a recorded meeting.
      </p>
      {nonMonotonic && (
        <p className="mt-2 text-xs text-muted-foreground">
          A stage can exceed the one before it when a prospect replied or booked without an invite
          from Vantera.
        </p>
      )}
    </Panel>
  );
}
