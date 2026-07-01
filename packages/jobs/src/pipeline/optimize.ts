import { aggregateArm, decideExperiment, type ExperimentDecision } from "@vantera/agent-brains";
import type { ExperimentStatus } from "@vantera/agent-brains";
import type { OptimizeDeps, OptimizeSummary } from "./types";

/**
 * The decide pipeline of the self-optimizing loop (Phase 3), suggest-only.
 *
 * Evaluates every running experiment: aggregate each arm's outcomes on the target stage, run the
 * decision gate + do-no-harm circuit breaker, and conclude when it's decisive. It NEVER adopts — a
 * proven winner is parked at 'ready_to_adopt' for the owner to approve. A losing or harmful
 * challenger concludes automatically (both simply revert to the champion, so no approval is needed).
 * Pure core; deps injected + the real store wired in the thin trigger.
 */

/** Map a verdict to a terminal status. Suggest-only: adopt → 'ready_to_adopt' (awaits owner). */
function statusForDecision(decision: ExperimentDecision): ExperimentStatus | null {
  switch (decision) {
    case "adopt_challenger":
      return "ready_to_adopt";
    case "discard_challenger":
      return "discarded";
    case "halt":
      return "halted";
    case "keep_running":
      return null;
  }
}

export async function runOptimize(deps: OptimizeDeps): Promise<OptimizeSummary> {
  const experiments = await deps.store.getRunningExperiments();
  let concluded = 0;

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
    const status = statusForDecision(verdict.decision);
    if (status) {
      await deps.store.concludeExperiment(exp.id, status, verdict.reason);
      concluded++;
    }
  }

  return { evaluated: experiments.length, concluded };
}
