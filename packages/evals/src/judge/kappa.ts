import type { LanguageModel } from "ai";
import { judgeCopy } from "./judge";

/**
 * Cohen's-kappa calibration harness for the LLM judge (Phase 2B, Task 6). Only `cohensKappa` is
 * pure/synchronous; `runCalibration` does model I/O (it calls `judgeCopy`) and is the piece
 * `run-*` CI entry points would invoke, same split as `graders/deterministic.ts` (pure grading) vs
 * `run-deterministic.ts` (the I/O-doing runner) elsewhere in this package.
 *
 * ADVISORY GATE: the judge (`./judge`) is informational-only everywhere until a `runCalibration`
 * run reports `trusted: true`. Nothing in the product or eval suites may treat an untrusted
 * judge's scores as authoritative.
 */

export type HumanLabel = {
  draftId: string;
  draftText: string;
  grounding: string;
  humanOverall: number;
};

export type CalibrationReport = { kappa: number; trusted: boolean; n: number };

/** trusted = kappa >= this. Locked per the Task 6 design — not tunable per call. */
export const KAPPA_TRUST_THRESHOLD = 0.7;

/**
 * Binary-binning decision: both the judge's and the human's 1-5 `overall` score are collapsed to
 * good/bad (`overall >= 4` = good) BEFORE computing kappa, rather than treating the raw 1-5 scale
 * as five ordinal classes. Two reasons this is the more robust choice for a small hand-labeled
 * calibration set:
 *   1. Multi-class kappa over a 1-5 scale is far more sensitive to off-by-one disagreement (a 3
 *      vs. a 4 counts as a full miss) even when both raters agree on the decision that actually
 *      matters — is this draft good enough to ship. Binary framing asks the judge to replicate
 *      the human's PASS/FAIL call, which is the calibration question this harness exists to
 *      answer, not "did the judge guess the exact same integer."
 *   2. With ~100 labels split across 5 classes, per-class counts get thin enough that kappa's
 *      variance blows up; binary framing keeps both marginals well-populated.
 * `4` as the cutoff matches the judge rubric's own "5 = ship as-is, 4 = strong, 2-3 = needs work"
 * framing (see `judge.ts`'s registered rubric).
 */
export function binOverall(overall: number): 0 | 1 {
  return overall >= 4 ? 1 : 0;
}

/**
 * Cohen's kappa between two integer-label vectors: `(po - pe) / (1 - pe)`, where `po` is observed
 * proportion agreement and `pe` is the proportion agreement expected by chance given each rater's
 * own marginal label distribution. PURE — no I/O, works over any finite set of integer labels (not
 * just binary), so it also serves as the general building block if a future caller ever wants
 * kappa over the raw 1-5 scale instead of the binned good/bad calibration question above.
 */
export function cohensKappa(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`cohensKappa: a.length (${a.length}) must equal b.length (${b.length})`);
  }
  const n = a.length;
  if (n === 0) {
    throw new Error("cohensKappa: cannot compute kappa over empty arrays");
  }

  const labels = new Set<number>([...a, ...b]);
  const aCounts = new Map<number, number>();
  const bCounts = new Map<number, number>();
  for (const label of labels) {
    aCounts.set(label, 0);
    bCounts.set(label, 0);
  }

  let agree = 0;
  for (let i = 0; i < n; i++) {
    const av = a[i]!;
    const bv = b[i]!;
    aCounts.set(av, aCounts.get(av)! + 1);
    bCounts.set(bv, bCounts.get(bv)! + 1);
    if (av === bv) agree++;
  }

  const po = agree / n;
  let pe = 0;
  for (const label of labels) {
    pe += (aCounts.get(label)! / n) * (bCounts.get(label)! / n);
  }

  const denom = 1 - pe;
  if (denom === 0) {
    // Both raters used exactly one, shared class the whole way through (po === pe === 1 here) —
    // there was no variability for them to possibly disagree on. Trivial perfect agreement rather
    // than an undefined 0/0.
    return 1;
  }
  return (po - pe) / denom;
}

/**
 * Runs `judgeCopy` over every labeled draft, bins both the judge's `overall` and the human's
 * `humanOverall` to good/bad (`binOverall`), and computes Cohen's kappa between the two binary
 * series. `model` is forwarded to `judgeCopy` as-is (undefined resolves to `judgeCopy`'s own
 * `getModel(JUDGE_MODEL_ID)` default) — tests always inject a mock.
 */
export async function runCalibration(
  humanLabels: HumanLabel[],
  model?: LanguageModel
): Promise<CalibrationReport> {
  const judgeBins: number[] = [];
  for (const label of humanLabels) {
    const verdict = await judgeCopy({ text: label.draftText }, { grounding: label.grounding }, model);
    judgeBins.push(binOverall(verdict.overall));
  }
  const humanBins = humanLabels.map((l) => binOverall(l.humanOverall));

  const kappa = cohensKappa(judgeBins, humanBins);
  return { kappa, trusted: kappa >= KAPPA_TRUST_THRESHOLD, n: humanLabels.length };
}
