import Link from "next/link";
import { ArrowRight, Lightbulb } from "lucide-react";
import { Panel, Eyebrow } from "@/components/ui/panel";
import { cn } from "@/lib/utils";
import type { StageStatus } from "@vantera/agent-brains";
import type { OutreachDiagnosisVM } from "@/lib/optimize";

// Phase 1 surface of the self-optimizing loop: a read-only "where your outreach leaks" panel.
// Shows the invite→accept→reply→book→close funnel with each stage's rate against a typical band,
// plus the single biggest opportunity the diagnosis brain found. No autonomy, no writes — just the
// measurement that makes the rest of the loop trustworthy.

const STATUS_LABEL: Record<StageStatus, string> = {
  below: "below typical",
  healthy: "on track",
  above: "ahead of typical",
};

function barColor(status: StageStatus | undefined): string {
  if (status === "below") return "#c2830a"; // amber — attention, not alarm
  if (status === "above") return "var(--positive)";
  return "var(--cyan)"; // healthy / default
}

export function OutreachDiagnosis({ vm }: { vm: OutreachDiagnosisVM }) {
  if (!vm.hasOutreach) return null; // nothing sent yet — the panel would be all zeros
  const { diagnosis, funnel, recommendation } = vm;

  const chip =
    diagnosis.status === "insufficient_data"
      ? "Gathering data"
      : diagnosis.confidence === "clear"
        ? "Clear signal"
        : "Early signal";

  return (
    <Panel className="mb-6 p-5">
      <div className="flex items-center justify-between gap-3">
        <Eyebrow>Optimization</Eyebrow>
        <span className="rounded-full border border-[var(--hairline)] bg-[var(--tint)] px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
          {chip}
        </span>
      </div>

      <div className="mt-3">
        <p className="font-heading text-lg font-semibold tracking-tight">{diagnosis.headline}</p>
        <p className="mt-1 text-sm text-muted-foreground">{diagnosis.detail}</p>
      </div>

      {recommendation && (
        <div className="mt-4 rounded-xl border border-[var(--cyan-line)] bg-[var(--cyan-tint)]/50 p-4">
          <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--cyan-strong)]">
            <Lightbulb className="size-3.5" aria-hidden /> Recommended change
          </p>
          <p className="mt-1.5 text-sm font-semibold text-foreground">{recommendation.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{recommendation.rationale}</p>
          <p className="mt-2 text-xs text-muted-foreground/80">
            {recommendation.expectedEffect}
            {" · "}
            {recommendation.confidence === "clear" ? "clear signal" : "early signal — worth a try"}
          </p>
          {recommendation.action && (
            <Link
              href={recommendation.action.href}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-foreground px-3.5 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
            >
              {recommendation.action.label} <ArrowRight className="size-4" aria-hidden />
            </Link>
          )}
        </div>
      )}

      <div className="mt-5 space-y-2.5">
        {funnel.map((s) => (
          <StageRow key={s.key} stage={s} highlight={diagnosis.stageKey === s.key} />
        ))}
      </div>

      <p className="mt-4 text-xs text-muted-foreground/70">
        Reference bands are typical ranges for quality LinkedIn outreach — not targets. A rate only
        counts once enough touches complete (95% confidence interval shown when it does).
      </p>
    </Panel>
  );
}

function StageRow({
  stage,
  highlight,
}: {
  stage: OutreachDiagnosisVM["funnel"][number];
  highlight: boolean;
}) {
  const { label, from, numerator, denominator, ratePct, ci, enoughData, benchmark } = stage;
  return (
    <div
      className={cn(
        "rounded-xl border p-3",
        highlight ? "border-[#c2830a]/40 bg-[#c2830a]/[0.05]" : "border-[var(--hairline)]"
      )}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium">{label}</span>
        <span className="font-data text-sm font-semibold tabular-nums">
          {ratePct == null ? "—" : `${ratePct}%`}
        </span>
      </div>
      <div className="mt-0.5 text-xs text-muted-foreground">
        <span className="tabular-nums">{numerator}</span> of{" "}
        <span className="tabular-nums">{denominator}</span> {from}
        {denominator > 0 && !enoughData && " · early — needs more"}
      </div>

      {ratePct != null && (
        <div className="relative mt-2 h-2 w-full overflow-hidden rounded-full bg-[var(--tint)] ring-1 ring-inset ring-[var(--hairline)]">
          {benchmark && (
            <div
              className="absolute inset-y-0 bg-foreground/[0.07]"
              style={{ left: `${benchmark.low}%`, width: `${benchmark.high - benchmark.low}%` }}
              aria-hidden
            />
          )}
          <div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{ width: `${Math.min(100, ratePct)}%`, background: barColor(benchmark?.status) }}
          />
        </div>
      )}

      {benchmark && (
        <p className="mt-1.5 text-[11px] text-muted-foreground/70">
          typical {benchmark.low}–{benchmark.high}% · {STATUS_LABEL[benchmark.status]}
          {ci && enoughData && (
            <>
              {" · "}
              <span className="font-data tabular-nums">
                95% CI {ci.low}–{ci.high}%
              </span>
            </>
          )}
        </p>
      )}
    </div>
  );
}
