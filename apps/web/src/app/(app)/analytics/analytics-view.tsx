"use client";

import Link from "next/link";
import { Panel, Eyebrow } from "@/components/ui/panel";
import { KpiTile, KpiGrid } from "@/components/ui/kpi";
import { cn } from "@/lib/utils";
import { benchmarkForStage, type FunnelStage, type Roi } from "@/lib/revenue";
import type { SignalAttribution } from "@/lib/analytics";
import type { OutreachDiagnosisVM } from "@/lib/optimize";
import { OutreachDiagnosis } from "./outreach-diagnosis";

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
  outreach: OutreachDiagnosisVM;
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
  outreach,
}: Props) {
  return (
    <div className="mx-auto w-full max-w-[1400px]">
      <header className="mb-6 border-b border-[var(--hairline)] pb-5">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          What your spend is actually returning — the numbers that decide whether this stays.
        </p>
      </header>

      {/* Phase 1 of the self-optimizing loop: where outreach leaks + the single biggest opportunity.
          Renders only once there's outreach; null otherwise. */}
      <OutreachDiagnosis vm={outreach} />

      {!hasLeads ? (
        <EmptyLeads />
      ) : !hasValue ? (
        <NeedDealValue />
      ) : !roi.hasSpend ? (
        <NeedSpend closedCents={closedCents} pipelineCents={pipelineCents} />
      ) : (
        <div className="space-y-6">
          {/* Scan — the four numbers renewal turns on. */}
          <KpiGrid>
            <KpiTile hero label="Return on spend" value={`${roi.pipelineToSpend ?? 0}×`} sub="pipeline + closed vs spend" />
            <KpiTile
              label="Cost / meeting"
              value={roi.costPerMeetingCents != null ? usd(roi.costPerMeetingCents) : "—"}
              sub={roi.costPerMeetingCents == null ? "once a meeting books" : "per booked meeting"}
            />
            <KpiTile
              label="Cost / close"
              value={roi.costPerCloseCents != null ? usd(roi.costPerCloseCents) : "—"}
              sub={roi.costPerCloseCents == null ? "once a deal closes" : "per closed deal"}
            />
            <KpiTile label="Annual spend" value={usd(roi.annualSpendCents)} sub="your current plan" />
          </KpiGrid>

          {/* The renewal headline — progress toward the 2× pipeline-to-spend bar. */}
          <RenewalBar roi={roi} />

          {/* Prove — the funnel beside where the wins actually came from. */}
          <div className={cn("grid gap-6", attribution.length > 0 && "lg:grid-cols-[1.5fr_1fr] lg:items-start")}>
            <FunnelCard funnel={funnel} meetingsTracked={meetingsTracked} />
            {attribution.length > 0 && <AttributionCard attribution={attribution} />}
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyLeads() {
  return (
    <Panel className="py-12 text-center">
      <p className="mx-auto max-w-md text-sm text-muted-foreground">
        No qualified prospects yet. Once your agents source and score, your funnel and return-on-spend
        land here — measured against the goal you set.
      </p>
      <Link
        href="/playbook"
        className="mt-5 inline-flex rounded-lg bg-foreground px-5 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
      >
        Set up your pipeline
      </Link>
    </Panel>
  );
}

function NeedDealValue() {
  return (
    <Panel>
      <Eyebrow>Return on spend</Eyebrow>
      <p className="mt-4 text-sm text-muted-foreground">
        Set your average deal value to see pipeline-to-spend, cost per meeting, and cost per close.
      </p>
      <Link
        href="/settings"
        className="mt-4 inline-flex rounded-lg border border-[var(--hairline)] px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-[var(--cyan-tint)]"
      >
        Set deal value
      </Link>
    </Panel>
  );
}

function NeedSpend({ closedCents, pipelineCents }: { closedCents: number; pipelineCents: number }) {
  return (
    <Panel>
      <Eyebrow>Return on spend</Eyebrow>
      <p className="mt-4 text-2xl font-semibold tracking-tight">
        <span className="font-data tabular-nums">{usd(closedCents + pipelineCents)}</span>{" "}
        <span className="text-base font-normal text-muted-foreground">in pipeline + closed</span>
      </p>
      <p className="mt-3 text-sm text-muted-foreground">
        Start a plan to track this against your spend — cost per meeting, cost per close, and the
        pipeline-to-spend ratio that decides renewal.
      </p>
      <Link
        href="/settings/billing"
        className="mt-4 inline-flex rounded-lg border border-[var(--hairline)] px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-[var(--cyan-tint)]"
      >
        Choose a plan
      </Link>
    </Panel>
  );
}

// Goal-gradient: the 2× pipeline-to-spend bar that keeps a budget funded — the renewal headline.
function RenewalBar({ roi }: { roi: Roi }) {
  const ratio = roi.pipelineToSpend ?? 0;
  const towardBar = Math.min(100, Math.round((ratio / 2) * 100));
  return (
    <Panel className="p-5">
      <div className="flex items-baseline justify-between gap-4">
        <Eyebrow>Pipeline-to-spend</Eyebrow>
        <span className="font-data text-[11px] tracking-wide text-muted-foreground">
          {ratio}× / 2× target
        </span>
      </div>
      <div className="relative mt-4 h-2 w-full overflow-hidden rounded-full bg-[var(--tint)] ring-1 ring-inset ring-[var(--hairline)]">
        <div className="h-full rounded-full bg-[var(--cyan)]" style={{ width: `${towardBar}%` }} />
        <div className="absolute inset-y-0 right-0 w-px bg-foreground/30" aria-hidden />
      </div>
      <p className={cn("mt-2.5 text-sm", roi.meetsThreshold ? "text-foreground/80" : "text-muted-foreground")}>
        {roi.meetsThreshold
          ? "Clears the 2× pipeline-to-spend bar that keeps a budget funded."
          : "Below the 2× bar — that gap is what puts renewal at risk."}
      </p>
    </Panel>
  );
}

// The dependency mechanism: closed wins traced back to the signal that opened the door, so the real
// signals on Prospects visibly produce the revenue here. Rendered only when wins carry signals.
function AttributionCard({ attribution }: { attribution: SignalAttribution[] }) {
  const top = attribution[0]?.wins ?? 0;
  return (
    <Panel>
      <Eyebrow>Where your wins come from</Eyebrow>
      <div className="mt-5 space-y-4">
        {attribution.map((row) => {
          const widthPct = top > 0 ? Math.max(6, Math.round((row.wins / top) * 100)) : 0;
          return (
            <div key={row.kind}>
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-foreground">{row.label}</span>
                <span className="font-data font-semibold tabular-nums">
                  {row.wins} {row.wins === 1 ? "win" : "wins"}
                </span>
              </div>
              <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-[var(--tint)] ring-1 ring-inset ring-[var(--hairline)]">
                <div
                  className="h-full rounded-full bg-[var(--positive)] transition-[width] duration-500"
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

function FunnelCard({ funnel, meetingsTracked }: { funnel: FunnelStage[]; meetingsTracked: boolean }) {
  const top = funnel[0]?.count ?? 0;
  return (
    <Panel>
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
                        "font-data text-[11px]",
                        bench?.status === "below" ? "text-muted-foreground" : "text-foreground/80",
                      )}
                    >
                      {stage.conversionPct}%
                    </span>
                  )}
                  <span className="font-data font-semibold tabular-nums">{stage.count}</span>
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
                  Tracked once a prospect books a meeting from your outreach.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
