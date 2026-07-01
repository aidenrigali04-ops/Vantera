import { wilsonInterval } from "./funnel";

/**
 * The decision gate + do-no-harm circuit breaker of the self-optimizing loop (Phase 3). Pure and
 * conservative by design:
 *   - HALT immediately when a challenger generates materially more negative replies — evaluated
 *     first and independent of any reply lift (a variant that gets more replies but angrier ones
 *     loses).
 *   - ADOPT only on a confident AND practically meaningful win (Wilson lower bound of the challenger
 *     above the champion's point estimate, plus a minimum effect size).
 *   - DISCARD when the champion is confidently better; otherwise KEEP RUNNING.
 * It never *applies* anything — the pipeline + owner do that (suggest-only). This is the piece where
 * bugs are dangerous, so it is exhaustively unit- and simulation-tested.
 */

export type VariantOutcome = {
  /** completed denominators on the target stage (e.g. accepted connections, for the reply stage) */
  denominator: number;
  /** wins on the target metric (e.g. interested replies) */
  successes: number;
  /** harm signal over the same denominator: not_interested + unsubscribe replies */
  negatives: number;
};

export type ExperimentDecision = "keep_running" | "adopt_challenger" | "discard_challenger" | "halt";
export type ExperimentVerdict = { decision: ExperimentDecision; reason: string };

export type DecideOptions = {
  /** min denominator on BOTH arms before a win/lose call */
  minSample?: number;
  /** min denominator on the challenger before the circuit breaker can trip */
  breakerMinSample?: number;
  /** challenger negative-rate excess over champion (percentage points) that trips the breaker */
  harmMarginPp?: number;
  /** absolute challenger negative-rate ceiling (%) that trips the breaker outright */
  hardNegCeilingPct?: number;
  /** min practical win (percentage points) required to adopt */
  minEffectPp?: number;
};

export const DECIDE_DEFAULTS: Required<DecideOptions> = {
  minSample: 30,
  breakerMinSample: 15,
  harmMarginPp: 8,
  hardNegCeilingPct: 30,
  minEffectPp: 3,
};

const ratePct = (num: number, den: number) => (den > 0 ? (num / den) * 100 : 0);
const round1 = (x: number) => Math.round(x * 10) / 10;

export function decideExperiment(
  champion: VariantOutcome,
  challenger: VariantOutcome,
  options?: DecideOptions
): ExperimentVerdict {
  const o = { ...DECIDE_DEFAULTS, ...options };

  const champNeg = ratePct(champion.negatives, champion.denominator);
  const chalNeg = ratePct(challenger.negatives, challenger.denominator);

  // 1. Do-no-harm circuit breaker — FIRST and independent of any reply lift. Needs a floor sample so
  //    it can't trip on noise; halts on an unacceptable absolute rate, or a confident, meaningful
  //    excess over the champion.
  if (challenger.denominator >= o.breakerMinSample) {
    if (chalNeg >= o.hardNegCeilingPct) {
      return {
        decision: "halt",
        reason: `challenger negative-reply rate ${round1(chalNeg)}% is unacceptably high`,
      };
    }
    const chalNegLow = wilsonInterval(challenger.negatives, challenger.denominator).low;
    if (chalNeg - champNeg >= o.harmMarginPp && chalNegLow > champNeg) {
      return {
        decision: "halt",
        reason: `challenger is generating materially more negative replies (${round1(chalNeg)}% vs ${round1(champNeg)}%)`,
      };
    }
  }

  // 2. Enough completed touches on BOTH arms to judge the win?
  if (champion.denominator < o.minSample || challenger.denominator < o.minSample) {
    return {
      decision: "keep_running",
      reason: "gathering data — not enough completed touches on both arms yet",
    };
  }

  const champWin = ratePct(champion.successes, champion.denominator);
  const chalWin = ratePct(challenger.successes, challenger.denominator);
  const chalWinLow = wilsonInterval(challenger.successes, challenger.denominator).low;
  const champWinLow = wilsonInterval(champion.successes, champion.denominator).low;

  // 3. Challenger confidently AND practically better → recommend adopting (owner still approves).
  if (chalWinLow > champWin && chalWin - champWin >= o.minEffectPp) {
    return {
      decision: "adopt_challenger",
      reason: `challenger wins ${round1(chalWin)}% vs ${round1(champWin)}% with confidence`,
    };
  }

  // 4. Champion confidently better → discard the challenger.
  if (champWinLow > chalWin) {
    return {
      decision: "discard_challenger",
      reason: `champion holds — challenger underperforms (${round1(chalWin)}% vs ${round1(champWin)}%)`,
    };
  }

  // 5. Inconclusive → keep running.
  return { decision: "keep_running", reason: "no clear winner yet — the difference isn't decisive" };
}
