"use client";

import Link from "next/link";
import { Panel, Eyebrow } from "@/components/ui/panel";
import { cn } from "@/lib/utils";
import { benchmarkForStage, type FunnelStage, type Roi } from "@/lib/revenue";
import type { SignalAttribution } from "@/lib/analytics";

const usd = (cents: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);

type Props = {
  hasLeads: boolean;
  funnel: FunnelStage[];
  meetingsTracked: boolean;
  roi: Roi;
  hasValue: boolean;
  closedCents: number;
  pipelineCents: number;
  goalCents: number | null;
  attribution: SignalAttribution[];
};

export function AnalyticsView({
  hasLeads,
  funnel,
  meetingsTracked,
  roi,
  hasValue,
  closedCents,
  pipelineCents,
  attribution,
}: Props) {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          What your spend is actually returning — the numbers that decide whether this stays.
        </p>
      </div>

      {!hasLeads ? (
        <Panel className="py-12 text-center">
          <p className="mx-auto max-w-md text-sm text-muted-foreground">
            No qualified leads yet. Once your agents source and score, your funnel and return-on-spend
            land here — measured against the goal you set.
          </p>
          <Link
            href="/agents"
            className="mt-5 inline-flex rounded-xl bg-foreground px-5 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
          >
            Set up your pipeline
          </Link>
        </Panel>
      ) : (
        <div className="space-y-6">
          <RoiCard roi={roi} hasValue={hasValue} closedCents={closedCents} pipelineCents={pipelineCents} />
          {attribution.length > 0 && <AttributionCard attribution={attribution} />}
          <FunnelCard funnel={funnel} meetingsTracked={meetingsTracked} />
        </div>
      )}
    </div>
  );
}

function RoiCard({
  roi,
  hasValue,
  closedCents,
  pipelineCents,
}: {
  roi: Roi;
  hasValue: boolean;
  closedCents: number;
  pipelineCents: number;
}) {
  // Gate every dollar/ratio behind real inputs — never a placeholder number (retention churn-check).
  if (!hasValue) {
    return (
      <Panel index={0}>
        <Eyebrow>Return on spend</Eyebrow>
        <p className="mt-4 text-sm text-muted-foreground">
          Set your average deal value to see pipeline-to-spend, cost per meeting, and cost per close.
        </p>
        <Link
          href="/settings"
          className="mt-4 inline-flex rounded-xl border border-[var(--hairline)] px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-[var(--cyan-tint)]"
        >
          Set deal value
        </Link>
      </Panel>
    );
  }

  if (!roi.hasSpend) {
    return (
      <Panel index={0}>
        <Eyebrow>Return on spend</Eyebrow>
        <p className="mt-4 text-2xl font-heading font-semibold tracking-tight">
          {usd(closedCents + pipelineCents)} <span className="text-base text-muted-foreground">in pipeline + closed</span>
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          Start a plan to track this against your spend — cost per meeting, cost per close, and the
          pipeline-to-spend ratio that decides renewal.
        </p>
        <Link
          href="/pricing"
          className="mt-4 inline-flex rounded-xl border border-[var(--hairline)] px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-[var(--cyan-tint)]"
        >
          See plans
        </Link>
      </Panel>
    );
  }

  const ratio = roi.pipelineToSpend ?? 0;
  // Progress toward the 2x bar; 100% = the threshold line.
  const towardBar = Math.min(100, Math.round((ratio / 2) * 100));

  return (
    <Panel index={0}>
      <div className="flex items-baseline justify-between gap-4">
        <Eyebrow>Return on spend</Eyebrow>
        <span className="font-mono text-[11px] tracking-wide text-muted-foreground">
          {usd(roi.annualSpendCents)}/yr spend
        </span>
      </div>

      <div className="mt-4 flex items-end gap-3">
        <span className="font-heading text-5xl font-semibold tracking-tight tabular-nums">{ratio}×</span>
        <span className="pb-1 text-sm text-muted-foreground">
          of annual spend, in pipeline + closed
        </span>
      </div>

      {/* Goal-gradient: fill toward the 2x bar that keeps the budget. */}
      <div className="mt-5">
        <div className="relative h-2 w-full overflow-hidden rounded-full bg-[var(--tint)] ring-1 ring-inset ring-[var(--hairline)]">
          <div
            className="h-full rounded-full bg-[var(--cyan)]"
            style={{ width: `${towardBar}%` }}
          />
          {/* the 2x threshold marker sits at the end of the track */}
          <div className="absolute inset-y-0 right-0 w-px bg-foreground/30" aria-hidden />
        </div>
        <p
          className={cn(
            "mt-2 text-sm",
            roi.meetsThreshold ? "text-foreground/80" : "text-muted-foreground",
          )}
        >
          {roi.meetsThreshold
            ? "Clears the 2× pipeline-to-spend bar that keeps a budget funded."
            : "Below the 2× bar — that gap is what puts renewal at risk."}
        </p>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <Stat
          label="Cost per meeting"
          value={roi.costPerMeetingCents != null ? usd(roi.costPerMeetingCents) : "—"}
          hint={roi.costPerMeetingCents == null ? "once a meeting is booked" : undefined}
        />
        <Stat
          label="Cost per close"
          value={roi.costPerCloseCents != null ? usd(roi.costPerCloseCents) : "—"}
          hint={roi.costPerCloseCents == null ? "once a deal closes" : undefined}
        />
      </div>
    </Panel>
  );
}

// The dependency mechanism: closed wins traced back to the signal that opened the door, so the real
// signals on Leads visibly produce the revenue here. Rendered only when wins carry signals.
function AttributionCard({ attribution }: { attribution: SignalAttribution[] }) {
  const top = attribution[0]?.wins ?? 0;
  return (
    <Panel index={1}>
      <Eyebrow>Where your wins come from</Eyebrow>
      <div className="mt-5 space-y-4">
        {attribution.map((row) => {
          const widthPct = top > 0 ? Math.max(6, Math.round((row.wins / top) * 100)) : 0;
          return (
            <div key={row.kind}>
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-foreground">{row.label}</span>
                <span className="font-mono font-semibold tabular-nums">
                  {row.wins} {row.wins === 1 ? "win" : "wins"}
                </span>
              </div>
              <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-[var(--tint)] ring-1 ring-inset ring-[var(--hairline)]">
                <div
                  className="h-full rounded-full bg-[#0f9d58] transition-[width] duration-500"
                  style={{ width: `${widthPct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-[var(--hairline)] bg-[var(--tint)] p-4">
      <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-1.5 font-mono text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground/70">{hint}</p>}
    </div>
  );
}

function FunnelCard({ funnel, meetingsTracked }: { funnel: FunnelStage[]; meetingsTracked: boolean }) {
  const top = funnel[0]?.count ?? 0;
  return (
    <Panel index={1}>
      <Eyebrow>Conversion funnel</Eyebrow>
      <div className="mt-5 space-y-4">
        {funnel.map((stage) => {
          const widthPct = top > 0 && stage.count > 0 ? Math.max(3, Math.round((stage.count / top) * 100)) : 0;
          const isUntrackedMeetings = stage.key === "meetings" && !meetingsTracked;
          const bench = isUntrackedMeetings ? null : benchmarkForStage(stage.key, stage.conversionPct);
          return (
            <div key={stage.key}>
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-foreground">{stage.label}</span>
                <span className="flex items-baseline gap-3">
                  {stage.conversionPct != null && !isUntrackedMeetings && (
                    <span
                      className={cn(
                        "font-mono text-[11px]",
                        bench?.status === "below" ? "text-muted-foreground" : "text-foreground/80",
                      )}
                    >
                      {stage.conversionPct}%
                    </span>
                  )}
                  <span className="font-mono font-semibold tabular-nums">{stage.count}</span>
                </span>
              </div>
              <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-[var(--tint)] ring-1 ring-inset ring-[var(--hairline)]">
                <div
                  className="h-full rounded-full bg-[var(--cyan)] transition-[width] duration-500"
                  style={{ width: `${widthPct}%` }}
                />
              </div>
              {bench && (
                <p className="mt-1 font-mono text-[11px] text-muted-foreground/70">
                  typical {bench.low}–{bench.high}%
                  {" · "}
                  {bench.status === "healthy"
                    ? "on track"
                    : bench.status === "above"
                      ? "ahead of typical"
                      : "room to improve"}
                </p>
              )}
              {isUntrackedMeetings && (
                <p className="mt-1 text-xs text-muted-foreground/70">
                  Tracked once a lead books a meeting from your outreach.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
