import { describe, expect, it } from "vitest";
import { aggregateArm } from "./outcomes";
import { genomeSignature, rollupArms, rollupCohort, type CohortLead } from "./cohort";

const quiet: CohortLead = {
  id: "quiet",
  sourced: true,
  qualified: true,
  invited: true,
  accepted: false,
  interested: false,
  negative: false,
  booked: false,
  closed: false,
  arm: null,
};

describe("rollupCohort", () => {
  it("counts each stage from the lead's own flags", () => {
    const cohort = rollupCohort([
      quiet,
      { ...quiet, id: "interested", accepted: true, interested: true },
      { ...quiet, id: "negative", accepted: true, negative: true },
      { ...quiet, id: "booked", accepted: true, interested: true, booked: true },
      { ...quiet, id: "closed", accepted: true, interested: true, booked: true, closed: true },
      { ...quiet, id: "raw", qualified: false, invited: false },
    ]);
    expect(cohort).toEqual({
      sourced: 6,
      qualified: 5,
      invited: 5,
      accepted: 4,
      interested: 3,
      negative: 1,
      booked: 2,
      closed: 1,
    });
  });

  it("returns zeros for an empty cohort", () => {
    const cohort = rollupCohort([]);
    expect(cohort).toEqual({
      sourced: 0,
      qualified: 0,
      invited: 0,
      accepted: 0,
      interested: 0,
      negative: 0,
      booked: 0,
      closed: 0,
    });
    for (const value of Object.values(cohort)) {
      expect(Number.isFinite(value)).toBe(true);
    }
  });
});

describe("rollupArms", () => {
  it("rolls each randomized arm with the existing stage definitions and skips observational stamps", () => {
    const flags = [
      { ...quiet, arm: "champion" as const },
      { ...quiet, id: "c2", arm: "champion" as const, accepted: true, interested: true },
      { ...quiet, id: "h", arm: "challenger" as const, accepted: true, negative: true },
      { ...quiet, id: "obs", arm: null, accepted: true, interested: true, booked: true },
    ];
    const arms = rollupArms("reply", flags);
    expect(arms.champion).toEqual(aggregateArm("reply", [flags[0]!, flags[1]!].map(toFlags)));
    expect(arms.challenger).toEqual(aggregateArm("reply", [toFlags(flags[2]!)]));
    expect(arms.champion.successes).toBe(1);
    expect(arms.challenger.negatives).toBe(1);
  });

  it("returns empty arms when nothing was randomized", () => {
    expect(rollupArms("booking", [])).toEqual({
      champion: { denominator: 0, successes: 0, negatives: 0 },
      challenger: { denominator: 0, successes: 0, negatives: 0 },
    });
  });
});

describe("genomeSignature", () => {
  it("is stable for the same genome and different when a gene changes", () => {
    const a = { prospecting: { icpFocus: "onboarding_icp" }, conversation: { askStyle: "soft" } };
    const reordered = { conversation: { askStyle: "soft" }, prospecting: { icpFocus: "onboarding_icp" } };
    expect(genomeSignature(a)).toBe(genomeSignature(reordered));
    expect(genomeSignature(a)).not.toBe(genomeSignature({ ...a, conversation: { askStyle: "specific" } }));
    expect(genomeSignature({})).toBe("default");
  });
});

function toFlags(lead: CohortLead) {
  return {
    invited: lead.invited,
    accepted: lead.accepted,
    interested: lead.interested,
    negative: lead.negative,
    booked: lead.booked,
    converted: lead.closed,
  };
}
