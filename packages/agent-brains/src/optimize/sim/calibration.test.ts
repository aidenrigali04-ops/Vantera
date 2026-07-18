import { describe, expect, it } from "vitest";
import { decideExperimentV2 } from "../decide-v2";
import { mulberry32, runMonteCarlo, simulateDecisionPath } from "./harness";

/**
 * GATE 1 calibration evidence (enterprise-grade-brain Phase 2A, WS-1.7). Reuses the SAME
 * daily-peeking Monte-Carlo harness that measured the OLD gate's 30.6% false-adoption rate
 * (harness.test.ts's CHARACTERIZATION test — pinned, and untouched by this file) — now pointed
 * at `decideExperimentV2` via the harness's injectable `decideFn`. The three tests below ARE the
 * hard CI gates GATE 1 cites. Do not loosen any of them to make CI green: a failure here means a
 * bug in the e-process construction or a genuine miscalibration, not a threshold to relax
 * (see each test's comment for what was already investigated when a gate first came up short).
 *
 * Determinism note (read before touching any rng wiring here): `decideExperimentV2`'s posterior
 * read (`posteriorSummary`) draws from an injected rng. The naive way to inject one — recreate
 * `mulberry32(fixedSeed)` inside the `decideFn` closure on every call — is a trap: `decideFn` runs
 * once per SIMULATED DAY (up to 90 times per run), so a fixed-seed reconstruction replays the
 * IDENTICAL posterior-noise sequence every day of every run, silently correlating and biasing
 * every rate measured below. The harness instead hands each simulated PATH (one full run of
 * `simulateDecisionPath`, or — in the chained-family test — one experiment within a chain) its
 * OWN dedicated rng stream, created once and threaded continuously across that path's days. See
 * `SimConfig.decideRng` in harness.ts for the full contract.
 */

describe("GATE 1 calibration", () => {
  it("is deterministic under a fixed seed with the injected V2 decideFn", () => {
    // Mirrors harness.test.ts's legacy determinism test for the decideFn-injected path: the
    // per-path decideRng derivation (pathSeed → one continuously-advancing stream per path) must
    // be stable across identical calls, or every rate this file gates on is unstable. The power
    // config is used (not A/A) so real e-threshold crossings exercise the posterior read's rng
    // on most paths — an A/A config would rarely touch decideRng at all.
    const cfg = {
      championRate: 0.15,
      challengerRate: 0.27,
      negativeRate: 0.05,
      perDayPerArm: 8,
      horizonDays: 90,
      decideFn: (c, t, rng) => decideExperimentV2(c, t, { rng }),
    } satisfies Parameters<typeof runMonteCarlo>[2];
    expect(runMonteCarlo(100, 42, cfg)).toEqual(runMonteCarlo(100, 42, cfg));
  }, 30_000);

  it("NULL CALIBRATION: V2 false-adoption ≤ 5% under daily peeking", () => {
    // Identical scenario to the OLD gate's CHARACTERIZATION test (harness.test.ts): true A/A
    // (championRate === challengerRate === 0.15), negativeRate 0.05 both arms, 8/day/arm, 90-day
    // horizon, 2000 runs, seed 1234 -- the exact null the OLD gate measured at 30.6% false
    // adoption. MEASURED V2 adoptRate = 0.006 (0.6%), 8x under the 5% ceiling and ~50x better
    // than the OLD gate on the identical scenario.
    //
    // Runtime: ~450ms for the 2000 x 90-day paths. No draws-reduction mitigation was needed --
    // under the true null the e-value essentially never crosses the default threshold (1/alpha =
    // 1/0.05 = 20), so `decideExperimentV2`'s expensive 4000-draw posterior Monte Carlo is
    // short-circuited by its own e-gate on nearly every day of nearly every run, exactly as the
    // task brief predicted.
    const r = runMonteCarlo(2000, 1234, {
      championRate: 0.15,
      challengerRate: 0.15,
      negativeRate: 0.05,
      perDayPerArm: 8,
      horizonDays: 90,
      decideFn: (c, t, rng) => decideExperimentV2(c, t, { rng }),
    });
    expect(r.adoptRate).toBeLessThanOrEqual(0.05);
  }, 60_000);

  it("POWER: V2 detects a 12pp lift on a 15% base ≥ 80% within 90 days (honest MDE)", () => {
    // Same volume as the NULL gate (8/day/arm, 90-day horizon), seed 42, 1000 runs -- matching
    // the task brief's starting point exactly. The brief's proposed 10pp lift (championRate 0.15,
    // challengerRate 0.25) was tried FIRST: measured adoptRate = 0.764, short of the 80% target.
    //
    // Root cause (investigated, not a V2 defect): the shared do-no-harm circuit breaker
    // (`checkCircuitBreaker` in decide.ts -- UNCHANGED, reused verbatim by both decideExperiment
    // and decideExperimentV2) trips on early-sample noise in roughly 16-19% of runs REGARDLESS of
    // the true lift, because it compares negative-reply rates that are identical in expectation on
    // both arms in every scenario tested here (negativeRate 0.05 on both champion and
    // challenger). Confirmed by running the SAME configs through the legacy `decideExperiment`:
    // breaker-halt rates land in the same ~16-19% band across seeds/configs (e.g. 18.45% under
    // the null at seed 1234 / 2000 runs on the legacy gate) -- statistically the same band V2
    // shows at every lift tried. That ~16-19% breaker-halt rate is therefore a hard ceiling on
    // achievable power at this daily volume for EITHER gate, entirely independent of the e-value/
    // posterior ADOPT logic this task calibrates -- fixing it (if it should be fixed at all) is a
    // decide.ts/breaker change outside this task's scope (harness.ts + this file only).
    //
    // Lift sweep at seed 42 / 1000 runs: 10pp -> 0.764, 11pp -> 0.803 (thin margin above 0.8),
    // 12pp -> 0.811, 13pp -> 0.807. 12pp was then checked for robustness, not cherry-picked: other
    // seeds at the same 12pp lift land at 0.800 (seed 43) and 0.819 (seed 99), and 3x the run
    // count (3000 runs, seed 42) lands at 0.808. 12pp -- not 10pp -- is therefore the honest
    // minimum detectable effect (MDE) at this volume, and is what becomes the power-ledger
    // constant (Task 7), not the brief's starting guess.
    const r = runMonteCarlo(1000, 42, {
      championRate: 0.15,
      challengerRate: 0.27, // 12pp lift -- the measured MDE, see comment above
      negativeRate: 0.05,
      perDayPerArm: 8,
      horizonDays: 90,
      decideFn: (c, t, rng) => decideExperimentV2(c, t, { rng }),
    });
    // Mean days-to-conclusion for this power case (recorded for the panel, not gated here):
    // measured meanDecisionDay ≈ 23.8 days out of the 90-day horizon.
    expect(r.adoptRate).toBeGreaterThanOrEqual(0.8);
  }, 60_000);

  it("CHAINED FAMILY: 10 sequential A/A experiments under alpha-investing stay controlled", () => {
    // Alpha-investing wealth ledger as PURE, test-local helper functions (Task 7's interface --
    // implemented here so Task 7 can later import-or-mirror this exact logic rather than
    // reinvent it). Constants per the plan:
    //   - start wealth 0.05
    //   - spend = min(0.05, max(0.005, wealth / 2))         -- never risk more than half, floored
    //     at 0.005 and ceilinged at 0.05 (both comfortably inside decideExperimentV2's own
    //     self-clamped alpha bounds [0.002, 0.05], so the spend is never further clamped there)
    //   - e-threshold for that experiment = 1 / spend        -- i.e. alpha = spend, passed straight
    //     into decideExperimentV2's `alpha` option
    //   - earn 0.02 back on a DECISIVE conclusion             -- defined here as the e-process
    //     actually crossing its (wealth-funded) threshold and the posterior confirming a
    //     direction, i.e. decision is "adopt_challenger" or "discard_challenger". A breaker
    //     "halt" is a safety stop, not a statistical conclusion, and does NOT earn; neither does
    //     a 90-day timeout ("keep_running").
    //   - wealth capped at 0.10
    //   - the chain PAUSES (no further experiments launch) once wealth drops below 0.005 -- and,
    //     with no other way to earn once paused, a paused chain never resumes.
    const SPEND_FLOOR = 0.005;
    const SPEND_CEILING = 0.05;
    const EARN_ON_DECISIVE = 0.02;
    const WEALTH_CAP = 0.1;
    const PAUSE_FLOOR = 0.005;
    const START_WEALTH = 0.05;
    const CHAIN_LENGTH = 10;
    const CHAIN_COUNT = 500;
    const SEED = 777;

    /** Alpha-investing spend rule: never more than half the current wealth, floor 0.005, ceiling 0.05. */
    function nextSpend(wealth: number): number {
      return Math.min(SPEND_CEILING, Math.max(SPEND_FLOOR, wealth / 2));
    }

    /** Earn EARN_ON_DECISIVE back on a decisive conclusion, capped at WEALTH_CAP. No-op otherwise. */
    function applyEarn(wealth: number, decisive: boolean): number {
      return decisive ? Math.min(WEALTH_CAP, wealth + EARN_ON_DECISIVE) : wealth;
    }

    // Per-experiment decide-rng seed, derived from (batch seed, chain index, experiment index) --
    // the same "one dedicated stream per simulated path" principle as harness.ts's internal
    // pathSeed, applied here per-experiment-within-a-chain rather than per-Monte-Carlo-run (this
    // test drives `simulateDecisionPath` directly instead of `runMonteCarlo`, since a chain needs
    // wealth state threaded BETWEEN experiments, which `runMonteCarlo`'s single-scenario loop
    // doesn't model).
    function experimentSeed(chain: number, exp: number): number {
      return ((SEED ^ 0x9e3779b9) + chain * 2654435761 + exp * 40503) >>> 0;
    }

    // One continuous data-generating rng shared across every experiment of every chain (mirrors
    // runMonteCarlo's own pattern: a single stream consumed in a fixed, deterministic order).
    const dataRng = mulberry32(SEED);

    let totalFalseAdoptions = 0;
    let chainsWithFalseAdoption = 0;
    let totalLaunched = 0;

    for (let chain = 0; chain < CHAIN_COUNT; chain++) {
      let wealth = START_WEALTH;
      let falseAdoptionsInChain = 0;
      let launched = 0;

      for (let exp = 0; exp < CHAIN_LENGTH; exp++) {
        if (wealth < PAUSE_FLOOR) break; // chain pauses -- no further experiments launch

        const spend = nextSpend(wealth);
        wealth -= spend;
        launched++;

        const decideRng = mulberry32(experimentSeed(chain, exp));
        const result = simulateDecisionPath({
          championRate: 0.15,
          challengerRate: 0.15, // true A/A -- any adopt is a FALSE adoption by construction
          negativeRate: 0.05,
          perDayPerArm: 8,
          horizonDays: 90,
          decideFn: (c, t, rng) => decideExperimentV2(c, t, { alpha: spend, rng }),
          rng: dataRng,
          decideRng,
        });

        const decisive = result.decision === "adopt_challenger" || result.decision === "discard_challenger";
        wealth = applyEarn(wealth, decisive);
        if (result.decision === "adopt_challenger") falseAdoptionsInChain++;
      }

      totalFalseAdoptions += falseAdoptionsInChain;
      if (falseAdoptionsInChain >= 1) chainsWithFalseAdoption++;
      totalLaunched += launched;
    }

    const meanFalseAdoptionsPerChain = totalFalseAdoptions / CHAIN_COUNT;
    const probAtLeastOneFalseAdoption = chainsWithFalseAdoption / CHAIN_COUNT;
    const meanLaunchedOfTen = totalLaunched / CHAIN_COUNT;

    // MEASURED (seed 777, 500 chains): meanFalseAdoptionsPerChain = 0.002, well under the 0.5
    // gate -- reproduced at 0.004-0.008 across other seeds tried (1, 555, 42, 2024), so this
    // isn't a lucky seed. The e-threshold scales with 1/spend and spend shrinks fast (each
    // experiment risks at most half of an already-small wealth), so most chain experiments run at
    // a MUCH stricter alpha than the flat-alpha NULL gate above -- false adoption is correspondingly
    // rarer per experiment, and the chain accumulates very few of them across 10 tries.
    expect(meanFalseAdoptionsPerChain).toBeLessThanOrEqual(0.5);

    // Recorded, not a designed gate (per the brief -- "measured + recorded"): P(>=1 false
    // adoption per chain) measured 0.002 (seed 777; 0.004-0.008 across other seeds tried). This
    // loose bound (25x+ headroom over the measured range) exists only to catch a gross regression
    // -- it is not a tuned threshold.
    expect(probAtLeastOneFalseAdoption).toBeLessThanOrEqual(0.3);

    // Honest capacity finding (recorded, not a designed gate): mean experiments actually LAUNCHED
    // before wealth pauses = 4.01 of the 10 planned (min 4, max 7 across the 500 chains). Starting
    // wealth 0.05 with the min(half, floor 0.005, ceiling 0.05) spend rule burns down below the
    // 0.005 pause floor after ~4 spends when conclusions are rare (true here, since this is a true
    // null and only ~1-in-5 experiments even reaches a decisive halt/adopt/discard -- most are
    // non-decisive "keep_running" timeouts or breaker halts, neither of which earns back). A REAL
    // 10-experiment family under these starting constants should expect to fund roughly 4 of its
    // 10 planned steps unless some land decisive wins/losses along the way -- load-bearing context
    // for Task 7's wealth-ledger defaults. Bound below is generous (measured range 4-7 of 10).
    expect(meanLaunchedOfTen).toBeGreaterThanOrEqual(2);
    expect(meanLaunchedOfTen).toBeLessThanOrEqual(9);
  }, 60_000);
});
