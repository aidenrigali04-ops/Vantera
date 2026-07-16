import {
  aggregateArm,
  aggregateBySignature,
  chooseChallenger,
  decideExperiment,
  nextExperimentStage,
  proposeNextChallenger,
  strategySignature,
} from "@vantera/agent-brains";
import type { CopyStrategy } from "@vantera/agent-brains";
import type { OptimizeDeps, OptimizeSummary, RunningExperiment } from "./types";

/**
 * The decide pipeline of the self-optimizing loop — GATE 0: suggest-only adopt
 * (enterprise-grade-brain spec, 2026-07-16; supersedes the 2026-07-14 fully-autonomous posture).
 *
 * Evaluates every running experiment: aggregate each arm's outcomes on the target stage, run the
 * decision gate + do-no-harm circuit breaker (UNCHANGED — the envelope is not tunable by this
 * loop), and act on a decisive verdict:
 *   - a proven winner is only MARKED ready_to_adopt — a suggestion the owner approves from the
 *     What's-working panel (the existing manual adopt action applies it). No chaining and no
 *     conclusion here: the one-live-experiment unique index counts ready_to_adopt as live, so the
 *     slot stays intentionally occupied until the owner acts. (GATE 1's anytime-valid decision
 *     core brings autonomous adoption back.)
 *   - a loser is discarded, a harmful challenger is halted (both revert to the champion) — these
 *     conservative, safety-preserving actions stay fully autonomous;
 *   - after a discard/halt conclusion the loop CHAINS the next test on the rotated stage, so the
 *     account is always either testing or between tests for at most one cron tick. Stage 1b: the
 *     next challenger comes from generate→gate→bandit (LLM candidates incl. the linted openerAngle
 *     knob, Thompson-sampled against collective recipe aggregates) with the deterministic
 *     knob-flip as the ever-present fallback.
 * Strategies remain bounded CopyStrategy knobs (openerAngle is linted style-only); every draft
 * still passes the humanizer. The owner keeps a Revert control in the What's-working panel.
 * Pure core; deps injected + the real store wired in the thin trigger.
 */

async function chainNext(
  deps: OptimizeDeps,
  exp: RunningExperiment,
  champion: CopyStrategy
): Promise<boolean> {
  const stageKey = nextExperimentStage(exp.stageKey);
  // Stage 1b: generate → gate → bandit. Without a generator the loop is byte-identical to the
  // deterministic knob-flip it shipped with; with one, Thompson sampling over the collective
  // recipe aggregates (Stage-1 stamps, cross-account, knobs + outcomes only) picks what to test
  // next. The decide gate + circuit breaker stay the adjudicator of what actually wins.
  let challenger: CopyStrategy | null = null;
  if (deps.proposeCandidatesFn) {
    const recentConclusions = await deps.store.getRecentConclusions(exp.accountId, 8);
    const [candidates, stamped] = await Promise.all([
      deps.proposeCandidatesFn({ stageKey, champion, recentConclusions }),
      deps.store.getStampedOutcomes(),
    ]);
    const stats = aggregateBySignature(stageKey, stamped);
    challenger = chooseChallenger(candidates, stats, deps.rand ?? Math.random);
  }
  challenger ??= proposeNextChallenger(stageKey, champion);
  if (!challenger) return false;
  return deps.store.startExperiment({ accountId: exp.accountId, stageKey, champion, challenger });
}

export async function runOptimize(deps: OptimizeDeps): Promise<OptimizeSummary> {
  const experiments = await deps.store.getRunningExperiments();
  let concluded = 0;
  const adopted = 0; // GATE 0: the loop never adopts autonomously — stays 0 until GATE 1
  let chained = 0;
  let readied = 0;
  let canaryAlerts = 0;

  for (const exp of experiments) {
    const [championFlags, challengerFlags] = await Promise.all([
      deps.store.getArmFlags(exp.id, "champion"),
      deps.store.getArmFlags(exp.id, "challenger"),
    ]);
    const verdict = decideExperiment(
      aggregateArm(exp.stageKey, championFlags),
      aggregateArm(exp.stageKey, challengerFlags),
      { minSample: exp.minSample }
    );

    // Live A/A canary (enterprise-grade-brain spec, WS-1.8): identical arms mean ANY decisive
    // verdict is a false signal from the gate itself. Alert, count, change nothing — the canary
    // keeps collecting. It is exempt from every action branch below.
    const isCanary =
      strategySignature(exp.championStrategy) === strategySignature(exp.challengerStrategy);
    if (isCanary) {
      if (verdict.decision !== "keep_running") {
        canaryAlerts++;
        await deps.notifyCanaryAlert?.({
          experimentId: exp.id,
          accountId: exp.accountId,
          decision: verdict.decision,
          reason: verdict.reason,
        });
      }
      continue;
    }

    switch (verdict.decision) {
      case "adopt_challenger": {
        // GATE 0 (enterprise-grade-brain spec): suggest-only until the anytime-valid decision
        // core lands (GATE 1). The owner's Adopt button (ready_to_adopt) applies the win.
        await deps.store.markReadyToAdopt(exp.id, verdict.reason);
        readied++;
        break;
      }
      case "discard_challenger": {
        await deps.store.concludeExperiment(exp.id, "discarded", verdict.reason);
        concluded++;
        if (await chainNext(deps, exp, exp.championStrategy)) chained++;
        break;
      }
      case "halt": {
        await deps.store.concludeExperiment(exp.id, "halted", verdict.reason);
        concluded++;
        if (await chainNext(deps, exp, exp.championStrategy)) chained++;
        break;
      }
      case "keep_running":
        break;
    }
  }

  return { evaluated: experiments.length, concluded, adopted, chained, readied, canaryAlerts };
}
