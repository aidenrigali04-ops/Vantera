import { describe, expect, it } from "vitest";
import { aggregateArm, type LeadOutcomeFlags } from "./outcomes";

const F = (o: Partial<LeadOutcomeFlags>): LeadOutcomeFlags => ({
  invited: false,
  accepted: false,
  interested: false,
  negative: false,
  booked: false,
  converted: false,
  ...o,
});

describe("aggregateArm", () => {
  const arm: LeadOutcomeFlags[] = [
    F({ invited: true, accepted: true, interested: true, booked: true, converted: true }),
    F({ invited: true, accepted: true, interested: true }),
    F({ invited: true, accepted: true, negative: true }),
    F({ invited: true }), // invited, never accepted
    F({ invited: true }),
  ];

  it("reply stage: denominator = accepted, success = interested, negatives among accepted", () => {
    expect(aggregateArm("reply", arm)).toEqual({ denominator: 3, successes: 2, negatives: 1 });
  });

  it("acceptance stage: denominator = invited, success = accepted", () => {
    expect(aggregateArm("acceptance", arm)).toEqual({ denominator: 5, successes: 3, negatives: 1 });
  });

  it("booking stage: denominator = interested, success = booked", () => {
    expect(aggregateArm("booking", arm)).toEqual({ denominator: 2, successes: 1, negatives: 0 });
  });

  it("counts a negative only when the lead is in the stage's denominator population", () => {
    // a lead with a negative reply but not accepted does not count against the reply denominator
    const flags = [F({ invited: true, negative: true })];
    expect(aggregateArm("reply", flags)).toEqual({ denominator: 0, successes: 0, negatives: 0 });
    expect(aggregateArm("acceptance", flags)).toEqual({ denominator: 1, successes: 0, negatives: 1 });
  });

  it("handles an empty arm", () => {
    expect(aggregateArm("reply", [])).toEqual({ denominator: 0, successes: 0, negatives: 0 });
  });
});
