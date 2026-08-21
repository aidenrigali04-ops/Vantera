/**
 * Pure metric math over predictions vs labels (Phase 2B, Task 5). No I/O, no model calls, no
 * `@vantera/agent-brains` import — these two functions are unit-tested directly with hand-built
 * vectors in `classifier.test.ts`. Callers (see `../run-classifier.ts`) are responsible for
 * building the parallel `preds`/`labels` arrays in matching order before calling either function.
 */

/**
 * recall = true positives / actual positives, where "positive" is the given class value.
 * `preds[i]` is compared against `labels[i]` pairwise; only positions where `labels[i] ===
 * positive` count toward the denominator (actual positives), and among those, positions where
 * `preds[i] === positive` too count toward the numerator (true positives).
 *
 * Divide-by-zero: when the label set contains ZERO instances of `positive`, there is nothing to
 * recall — the metric is vacuously satisfied, so this returns `1` (not `NaN`, not a thrown error)
 * so a floor comparison downstream never spuriously fails on an empty-class labeled set. Every
 * call site that could hit an empty positive class should note this convention.
 */
export function recall(preds: string[], labels: string[], positive: string): number {
  if (preds.length !== labels.length) {
    throw new Error(`recall: preds.length (${preds.length}) must equal labels.length (${labels.length})`);
  }
  let actualPositives = 0;
  let truePositives = 0;
  labels.forEach((label, i) => {
    if (label !== positive) return;
    actualPositives++;
    if (preds[i] === positive) truePositives++;
  });
  if (actualPositives === 0) return 1; // vacuously satisfied — see doc comment above
  return truePositives / actualPositives;
}

/**
 * precision = true positives / predicted positives, over parallel boolean arrays (`preds[i]`
 * paired with `labels[i]`). Only positions where `preds[i]` is `true` count toward the
 * denominator (predicted positives), and among those, positions where `labels[i]` is also `true`
 * count toward the numerator (true positives).
 *
 * Divide-by-zero: when the predictor emits ZERO positive predictions, there are no false
 * positives it could be guilty of — vacuously precise, so this returns `1` (same convention as
 * `recall`'s empty-actual-positives case) rather than `NaN`.
 */
export function precision(preds: boolean[], labels: boolean[]): number {
  if (preds.length !== labels.length) {
    throw new Error(`precision: preds.length (${preds.length}) must equal labels.length (${labels.length})`);
  }
  let predictedPositives = 0;
  let truePositives = 0;
  preds.forEach((pred, i) => {
    if (!pred) return;
    predictedPositives++;
    if (labels[i]) truePositives++;
  });
  if (predictedPositives === 0) return 1; // vacuously precise — see doc comment above
  return truePositives / predictedPositives;
}

/** A single accuracy-floor check: a computed metric value against its locked minimum. */
export type FloorReport = {
  metric: string;
  value: number;
  floor: number;
  pass: boolean;
  n: number;
};
