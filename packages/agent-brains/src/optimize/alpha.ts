/**
 * Alpha-investing wealth ledger (enterprise-grade-brain Phase 2A, Task 7 / WS-1.1). Pure rules for
 * spending and replenishing the per-account significance budget that `decideExperimentV2`'s
 * `alpha` option draws on — decoupling "how strict is THIS test" (the e-value threshold, 1/alpha)
 * from a flat, always-0.05 significance level so a CHAIN of sequential tests on one account stays
 * controlled overall (alpha-investing, Foster & Stine): every launch spends some of the account's
 * wealth, every decisive conclusion earns a little back, and the account can never spend past what
 * it has.
 *
 * Calibration evidence: Task 6's GATE 1 suite
 * (`packages/agent-brains/src/optimize/sim/calibration.test.ts`, the "CHAINED FAMILY" test)
 * inlined these exact constants and arithmetic as test-local helpers (`nextSpend`/`applyEarn`) to
 * measure a 10-experiment chain's false-adoption rate under alpha-investing BEFORE this module
 * existed — that test IS the empirical evidence for the constants below (mean false adoptions/
 * chain 0.002-0.008 across 5 seeds, well under the 0.5 gate). Do not change these constants
 * without re-running that suite.
 *
 * That file is a sim file under concurrent read-only review and is intentionally left untouched
 * here — NOT refactored to import from this module — because its gating differs from what this
 * module's functions do in production:
 *   - `nextSpend` in the test never returns null; the chain loop checks the pause floor itself
 *     BEFORE calling it (`if (wealth < PAUSE_FLOOR) break`). `nextAlphaSpend` below folds that same
 *     pause check into its own return value (null ⇒ caller must not launch) — the arithmetic for
 *     the non-null case is identical, only which side owns the pause-floor branch differs.
 *   - `applyEarn` in the test only credits on a "decisive" conclusion, defined there as
 *     adopt_challenger/discard_challenger specifically (a breaker halt or a 90-day keep_running
 *     timeout does NOT earn in that test's narrower definition). The production wiring (Task 7,
 *     `packages/jobs/src/pipeline/pg-store.ts`) credits on ANY status transition out of
 *     running/ready_to_adopt — discarded, halted, or adopted alike — since all three free the
 *     account's one-live experiment slot ("leaving the live pool"). `wealthAfterConclusion` below
 *     is therefore unconditional arithmetic only; which conclusions actually call it is a
 *     call-site decision, not something this module encodes.
 */

/** Starting wealth for an account that has never adopted anything — also
 *  `optimization_playbook.alpha_wealth`'s column default (migration 0058): the classical
 *  single-test alpha. */
export const ALPHA_WEALTH_START = 0.05;

/** Wealth never accrues past this ceiling, however many decisive conclusions an account earns. */
export const ALPHA_WEALTH_CAP = 0.1;

/** Earned back on each decisive conclusion (call-site-gated — see the module doc above). */
export const ALPHA_EARN_ON_CONCLUSION = 0.02;

/** Below this, there's nothing meaningful left to spend on a next test — the chain pauses. */
export const ALPHA_MIN_SPEND = 0.005;

/**
 * Spend for the next chained experiment: never more than half the current wealth (so one test can
 * never burn the whole budget), floored at `ALPHA_MIN_SPEND` and ceilinged at 0.05 (the classical
 * single-test alpha — a chained test is never allowed to run LESS strict than the flat-alpha
 * baseline). Returns null once wealth has dropped below `ALPHA_MIN_SPEND`: the signal to the
 * pipeline that the chain must PAUSE (no experiment launches) rather than spend a de-minimis,
 * meaningless alpha that would never gate anything.
 */
export function nextAlphaSpend(wealth: number): number | null {
  if (wealth < ALPHA_MIN_SPEND) return null;
  return Math.min(0.05, Math.max(ALPHA_MIN_SPEND, wealth / 2));
}

/**
 * Wealth immediately after debiting `spend` to launch an experiment. No floor/cap applied here —
 * every `spend` the pipeline passes in was itself produced by `nextAlphaSpend`, which already
 * guarantees `spend <= wealth / 2`, so the result can never go negative or need clamping.
 */
export function wealthAfterLaunch(wealth: number, spend: number): number {
  return wealth - spend;
}

/**
 * Wealth after crediting one decisive conclusion, capped at `ALPHA_WEALTH_CAP`. Unconditional
 * arithmetic — whether a given conclusion actually EARNS is entirely a call-site decision (see the
 * module doc above for the production rule pg-store.ts applies).
 */
export function wealthAfterConclusion(wealth: number): number {
  return Math.min(ALPHA_WEALTH_CAP, wealth + ALPHA_EARN_ON_CONCLUSION);
}
