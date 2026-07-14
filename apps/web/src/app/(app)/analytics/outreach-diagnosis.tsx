import Link from "next/link";
import { ArrowRight, FlaskConical, Lightbulb } from "lucide-react";
import { Panel, Eyebrow } from "@/components/ui/panel";
import { cn } from "@/lib/utils";
import type { StageStatus } from "@vantera/agent-brains";
import type { OutreachDiagnosisVM } from "@/lib/optimize";
import { adoptExperiment, discardExperiment, revertAdoption, startExperiment } from "./optimize-actions";

// "What's working" — the visible face of Vera's self-improving loop (Stage 0, spec 2026-07-14).
// Shows the invite→accept→reply→book→close funnel with each stage's rate against a typical band,
// what Vera is testing right now, and the latest adoption (with an owner Revert control).
// Adoption is autonomous inside the envelope; the legacy ready_to_adopt approve UI stays for any
// experiment parked before the autonomy flip.

const STATUS_LABEL: Record<StageStatus, string> = {
  below: "below typical",
  healthy: "on track",
  above: "ahead of typical",
};

function barColor(status: StageStatus | undefined): string {
  if (status === "below") return "#d97706"; // amber-600 — the app's amber attention family
  if (status === "above") return "var(--positive)";
  return "var(--cyan)"; // healthy / default
}

export function OutreachDiagnosis({ vm }: { vm: OutreachDiagnosisVM }) {
  if (!vm.hasOutreach) return null; // nothing sent yet — the panel would be all zeros
  const { diagnosis, funnel, recommendation, experiment, experimentOffer } = vm;

  const chip =
    diagnosis.status === "insufficient_data"
      ? "Gathering data"
      : diagnosis.confidence === "clear"
        ? "Clear signal"
        : "Early signal";

  return (
    <Panel className="mb-6 p-5">
      <div className="flex items-center justify-between gap-3">
        <Eyebrow>What&apos;s working</Eyebrow>
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

      {/* Phase 3 — the self-optimizing test: offer, running status, or the adopt decision. */}
      {experiment ? (
        experiment.status === "ready_to_adopt" ? (
          <div className="mt-4 rounded-xl border border-[var(--positive-line)] bg-[var(--positive-tint)] p-4">
            <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--positive)]">
              <FlaskConical className="size-3.5" aria-hidden /> Test result
            </p>
            <p className="mt-1.5 text-sm font-semibold text-foreground">
              A proven change is ready — {experiment.challengerLabel}
            </p>
            {experiment.decisionReason && (
              <p className="mt-1 text-sm text-muted-foreground">
                {experiment.decisionReason}. Adopt it as your agent&apos;s default, or keep the
                current approach.
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <form action={adoptExperiment}>
                <input type="hidden" name="id" value={experiment.id} />
                <button
                  type="submit"
                  className="inline-flex items-center rounded-lg bg-foreground px-3.5 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
                >
                  Adopt as default
                </button>
              </form>
              <form action={discardExperiment}>
                <input type="hidden" name="id" value={experiment.id} />
                <button
                  type="submit"
                  className="inline-flex items-center rounded-lg border border-[var(--hairline)] px-3.5 py-2 text-sm font-medium transition-colors hover:bg-[var(--tint)]"
                >
                  Keep current
                </button>
              </form>
            </div>
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-[var(--hairline)] bg-[var(--tint)] p-4">
            <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              <FlaskConical className="size-3.5" aria-hidden /> Testing now
            </p>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Vera is trying <span className="font-medium text-foreground">{experiment.challengerLabel}</span>{" "}
              on a slice of new drafts, measured against your current approach — kept only if it
              genuinely wins, stopped instantly if it ever does harm. Nothing sends without your
              approval either way.
            </p>
          </div>
        )
      ) : experimentOffer ? (
        <form action={startExperiment} className="mt-4">
          <input type="hidden" name="stageKey" value={experimentOffer.stageKey} />
          <div className="rounded-xl border border-[var(--hairline)] p-4">
            <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              <FlaskConical className="size-3.5" aria-hidden /> Or let the agent test a fix
            </p>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Vera can safely test{" "}
              <span className="font-medium text-foreground">{experimentOffer.label}</span> on a small
              slice of new drafts and keep it only if it genuinely helps — with a hard stop if it ever
              backfires.
            </p>
            <button
              type="submit"
              className="mt-3 inline-flex items-center rounded-lg border border-[var(--cyan-line)] px-3.5 py-2 text-sm font-medium text-[var(--cyan-strong)] transition-colors hover:bg-[var(--cyan-tint)]"
            >
              Start the test
            </button>
          </div>
        </form>
      ) : null}

      {/* Stage 0: the most recent autonomous adoption — evidence the loop is really improving,
          with the owner's Revert control. Filtered out once reverted. */}
      {vm.lastAdoption && (
        <div className="mt-4 rounded-xl border border-[var(--positive-line)] bg-[var(--positive-tint)] p-4">
          <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--positive)]">
            <FlaskConical className="size-3.5" aria-hidden /> Adopted
          </p>
          <p className="mt-1.5 text-sm font-semibold text-foreground">
            {vm.lastAdoption.label} won its test and is now your default
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {vm.lastAdoption.reason ? `${vm.lastAdoption.reason}. ` : ""}Vera adopted it
            automatically — and rolls back anything that ever makes results worse.
          </p>
          {/* Stage 1 receipts: real message-level counts under the adopted approach — never
              shown until at least one stamped message has actually been sent. */}
          {vm.lastAdoption.receipts && (
            <p className="mt-1.5 text-sm text-muted-foreground">
              Since this change: {vm.lastAdoption.receipts.sent}{" "}
              {vm.lastAdoption.receipts.sent === 1 ? "message" : "messages"} sent
              {vm.lastAdoption.receipts.interested > 0 && (
                <>
                  {" "}· {vm.lastAdoption.receipts.interested} interested{" "}
                  {vm.lastAdoption.receipts.interested === 1 ? "reply" : "replies"}
                </>
              )}
            </p>
          )}
          <form action={revertAdoption} className="mt-3">
            <input type="hidden" name="id" value={vm.lastAdoption.experimentId} />
            <button
              type="submit"
              className="inline-flex items-center rounded-lg border border-[var(--hairline)] px-3.5 py-2 text-sm font-medium transition-colors hover:bg-[var(--tint)]"
            >
              Revert to the previous approach
            </button>
          </form>
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
        highlight ? "border-amber-500/40 bg-amber-500/[0.06]" : "border-[var(--hairline)]"
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
