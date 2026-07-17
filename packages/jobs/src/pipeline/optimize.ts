import {
  aggregateArm,
  aggregateBySignature,
  chooseChallenger,
  decideExperimentV2,
  nextAlphaSpend,
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
 * Task 7 / WS-1.1 (2A stats core): the decision gate is `decideExperimentV2` (the e-process +
 * expected-loss gate) wired with the account's alpha-investing wealth — `exp.alphaSpent` (a
 * per-experiment DB column, migration 0058) drives the e-value threshold for THAT experiment, and
 * a fresh spend is drawn from the account's `optimization_playbook.alpha_wealth` ledger every time
 * the loop chains a next test (`chainNext` below). GATE 0's suggest-only/canary/heal posture is
 * otherwise UNCHANGED by this — same action branches, same exemptions.
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

/** Result of a chain attempt: distinguishes an alpha-wealth pause from an ordinary launch (or a
 *  swallowed one-live conflict / no-candidate skip) so the caller can count each correctly. */
type ChainResult = "started" | "paused" | "skipped";

async function chainNext(
  deps: OptimizeDeps,
  exp: RunningExperiment,
  champion: CopyStrategy
): Promise<ChainResult> {
  // Alpha-investing (Task 7 / WS-1.1): draw the next test's spend from the account's wealth
  // BEFORE doing any candidate-generation work — a paused chain (wealth exhausted) has nothing to
  // launch, so there's no reason to spend an LLM call or a bandit read finding out what it would
  // have tested next.
  const wealth = await deps.store.getAlphaWealth(exp.accountId);
  const spend = nextAlphaSpend(wealth);
  if (spend === null) return "paused";

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
  if (!challenger) return "skipped";
  const started = await deps.store.startExperiment({
    accountId: exp.accountId,
    stageKey,
    champion,
    challenger,
    alphaSpent: spend,
  });
  return started ? "started" : "skipped";
}

export async function runOptimize(deps: OptimizeDeps): Promise<OptimizeSummary> {
  const experiments = await deps.store.getRunningExperiments();
  let concluded = 0;
  const adopted = 0; // GATE 0: the loop never adopts autonomously — stays 0 until GATE 1
  let chained = 0;
  let chainPaused = 0;
  let readied = 0;
  let canaryAlerts = 0;

  for (const exp of experiments) {
    const [championFlags, challengerFlags] = await Promise.all([
      deps.store.getArmFlags(exp.id, "champion"),
      deps.store.getArmFlags(exp.id, "challenger"),
    ]);
    // Task 7 / WS-1.1: decideExperimentV2 (the e-process + expected-loss gate) replaces the
    // Wilson-interval decideExperiment. `exp.alphaSpent` (null on pre-2A rows) is passed straight
    // through as `undefined` — V2 self-clamps that to its own default alpha (0.05), so this call
    // site never needs to special-case a legacy row itself (see decide-v2.ts's clamping doc).
    const verdict = decideExperimentV2(
      aggregateArm(exp.stageKey, championFlags),
      aggregateArm(exp.stageKey, challengerFlags),
      { alpha: exp.alphaSpent ?? undefined, rng: deps.rand }
    );

    // Live A/A canary (enterprise-grade-brain spec, WS-1.8) — SCOPED to the pinned canary account
    // (review-round fix): identical arms mean ANY decisive verdict is a false signal from the gate
    // itself, but that's only true on the account the canary was deliberately seeded on. Alert,
    // count, change nothing — the canary keeps collecting. It is exempt from every action branch
    // below.
    const identicalArms =
      strategySignature(exp.championStrategy) === strategySignature(exp.challengerStrategy);
    const isCanary = identicalArms && exp.accountId === deps.canaryAccountId;
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

    // Tallies a chain attempt's result into the right summary counter — `started` and `paused` are
    // mutually exclusive outcomes of the SAME attempt, never both counted (see ChainResult).
    const tallyChain = async () => {
      const result = await chainNext(deps, exp, exp.championStrategy);
      if (result === "started") chained++;
      else if (result === "paused") chainPaused++;
    };

    // A signature-equal experiment that ISN'T the pinned canary is an accident, not a deliberate
    // A/A test — most likely the manual "start the test" action re-proposing a challenger the
    // owner already adopted as champion (review-round fix). There's nothing to learn from
    // identical arms, so it's concluded immediately regardless of sample size: this frees the
    // account's one-live slot instead of it sitting there forever never reaching a verdict. Never
    // alerted (it's not a calibration failure — it's a duplicate-arm mistake) and never marked
    // ready. The next test still chains, same as any other discard.
    if (identicalArms) {
      // { credit: false }: this conclusion is ADMINISTRATIVE — freeing a stuck slot, not a
      // decisive verdict — so it earns no alpha wealth back (Task 7 / WS-1.1 review fix). Heals
      // typically close UNFUNDED manual experiments (the web "start test" action neither debits
      // nor stamps alphaSpent), so crediting them would mint wealth that was never spent.
      await deps.store.concludeExperiment(
        exp.id,
        "discarded",
        "identical champion and challenger — no testable difference",
        { credit: false }
      );
      concluded++;
      await tallyChain();
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
        await tallyChain();
        break;
      }
      case "halt": {
        await deps.store.concludeExperiment(exp.id, "halted", verdict.reason);
        concluded++;
        await tallyChain();
        break;
      }
      case "keep_running":
        break;
    }
  }

  return { evaluated: experiments.length, concluded, adopted, chained, chainPaused, readied, canaryAlerts };
}
