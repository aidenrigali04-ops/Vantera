import {
  aggregateArm,
  decideExperiment,
  nextExperimentStage,
  proposeNextChallenger,
} from "@vantera/agent-brains";
import type { CopyStrategy } from "@vantera/agent-brains";
import type { OptimizeDeps, OptimizeSummary, RunningExperiment } from "./types";

/**
 * The decide pipeline of the self-optimizing loop — autonomous within the envelope
 * (spec 2026-07-14; supersedes the Phase-3 suggest-only posture).
 *
 * Evaluates every running experiment: aggregate each arm's outcomes on the target stage, run the
 * decision gate + do-no-harm circuit breaker (UNCHANGED — the envelope is not tunable by this
 * loop), and act on a decisive verdict:
 *   - a proven winner is ADOPTED on the spot (playbook champion ← challenger, version-bumped);
 *   - a loser is discarded, a harmful challenger is halted (both revert to the champion);
 *   - after ANY conclusion the loop CHAINS the next single-knob test on the rotated stage, so the
 *     account is always either testing or between tests for at most one cron tick.
 * Strategies remain the bounded CopyStrategy knobs; every draft still passes the humanizer. The
 * owner keeps a Revert control in the What's-working panel. Pure core; deps injected + the real
 * store wired in the thin trigger.
 */

async function chainNext(
  deps: OptimizeDeps,
  exp: RunningExperiment,
  champion: CopyStrategy
): Promise<boolean> {
  const stageKey = nextExperimentStage(exp.stageKey);
  const challenger = proposeNextChallenger(stageKey, champion);
  if (!challenger) return false;
  return deps.store.startExperiment({ accountId: exp.accountId, stageKey, champion, challenger });
}

export async function runOptimize(deps: OptimizeDeps): Promise<OptimizeSummary> {
  const experiments = await deps.store.getRunningExperiments();
  let concluded = 0;
  let adopted = 0;
  let chained = 0;

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

    switch (verdict.decision) {
      case "adopt_challenger": {
        const newChampion = await deps.store.adoptChallenger(exp.id, verdict.reason);
        concluded++;
        adopted++;
        if (await chainNext(deps, exp, newChampion)) chained++;
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

  return { evaluated: experiments.length, concluded, adopted, chained };
}
