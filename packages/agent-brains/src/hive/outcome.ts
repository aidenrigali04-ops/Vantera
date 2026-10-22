/**
 * One unit's funnel outcome — the measurement record every arena reads (the "tracking" layer).
 * A unit is one sourced prospect. Flags only ever flip false → true as events land; arenas never
 * write them. Pure type + aggregation helpers.
 */
export type HiveOutcome = {
  sourced: boolean;
  qualified: boolean;
  invited: boolean;
  accepted: boolean;
  interested: boolean;
  /** not_interested or unsubscribe reply — the harm signal */
  negative: boolean;
  booked: boolean;
  converted: boolean;
};

export const EMPTY_OUTCOME: HiveOutcome = {
  sourced: false,
  qualified: false,
  invited: false,
  accepted: false,
  interested: false,
  negative: false,
  booked: false,
  converted: false,
};

/**
 * Running counts for one arm. `denominator`/`successes` are the arena's win metric. Harm is
 * tracked over ITS OWN population (`harmDenominator`: every unit that could have produced the harm
 * signal, i.e. reached a conversation), so a variant that raises accepts cannot dilute its own
 * negative-reply rate with the invitees who never replied — the guardrail-trap leak the simulator
 * exposed. The decide gate reads `{denominator, successes, negatives}` where negatives are
 * rescaled onto the win denominator (see `gateCounts`).
 */
export type ArmCounts = { denominator: number; successes: number; negatives: number; harmDenominator: number };

export const zeroCounts = (): ArmCounts => ({ denominator: 0, successes: 0, negatives: 0, harmDenominator: 0 });

/** Contribution of one unit's outcome to an arm's counts under a metric (0/1 per field). */
export function contribution(
  metric: { inDenominator: (o: HiveOutcome) => boolean; success: (o: HiveOutcome) => boolean; harm: (o: HiveOutcome) => boolean },
  o: HiveOutcome
): ArmCounts {
  if (!metric.inDenominator(o)) return zeroCounts();
  const inHarmPop = o.accepted;
  return {
    denominator: 1,
    successes: metric.success(o) ? 1 : 0,
    negatives: inHarmPop && metric.harm(o) ? 1 : 0,
    harmDenominator: inHarmPop ? 1 : 0,
  };
}

/** counts += (after − before): incremental update when a unit's flags change. */
export function applyDelta(counts: ArmCounts, before: ArmCounts, after: ArmCounts): void {
  counts.denominator += after.denominator - before.denominator;
  counts.successes += after.successes - before.successes;
  counts.negatives += after.negatives - before.negatives;
  counts.harmDenominator += after.harmDenominator - before.harmDenominator;
}

/**
 * What the two-proportion gate sees. The breaker compares negative RATES, so negatives are
 * expressed on the harm population: we hand the gate the win counts plus a negatives figure scaled
 * so that negatives/denominator == negatives/harmDenominator. Breaker sample floors then apply to
 * the harm population too (they can't trip on a handful of conversations).
 */
export function gateCounts(c: ArmCounts): { denominator: number; successes: number; negatives: number } {
  if (c.harmDenominator === 0) return { denominator: c.denominator, successes: c.successes, negatives: 0 };
  const scaled = (c.negatives / c.harmDenominator) * c.denominator;
  return { denominator: c.denominator, successes: c.successes, negatives: scaled };
}
