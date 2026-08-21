import { describe, expect, it } from "vitest";
import { eValueTwoProportions, logBeta, logGamma, posteriorSummary } from "./eprocess";
import { mulberry32 } from "./sim/harness";

describe("logGamma", () => {
  it("matches known values", () => {
    expect(logGamma(1)).toBeCloseTo(0, 10);
    expect(logGamma(0.5)).toBeCloseTo(Math.log(Math.PI) / 2, 10);
    expect(logGamma(10)).toBeCloseTo(Math.log(362880), 8);
  });
});

describe("logBeta", () => {
  it("logBeta(1,1) is 0 (uniform prior normalizer)", () => {
    expect(logBeta(1, 1)).toBeCloseTo(0, 10);
  });

  it("matches logGamma(a)+logGamma(b)-logGamma(a+b) by construction", () => {
    expect(logBeta(3, 5)).toBeCloseTo(logGamma(3) + logGamma(5) - logGamma(8), 10);
  });
});

describe("eValueTwoProportions", () => {
  it("is ~1 on empty data and grows with a real difference", () => {
    expect(
      eValueTwoProportions({ successes: 0, denominator: 0 }, { successes: 0, denominator: 0 })
    ).toBeCloseTo(1, 6);
    const strong = eValueTwoProportions(
      { successes: 10, denominator: 100 },
      { successes: 40, denominator: 100 }
    );
    const weak = eValueTwoProportions(
      { successes: 15, denominator: 100 },
      { successes: 17, denominator: 100 }
    );
    expect(strong).toBeGreaterThan(20);
    expect(weak).toBeLessThan(3);
  });

  it("is symmetric in arm order", () => {
    const a = eValueTwoProportions(
      { successes: 10, denominator: 100 },
      { successes: 40, denominator: 100 }
    );
    const b = eValueTwoProportions(
      { successes: 40, denominator: 100 },
      { successes: 10, denominator: 100 }
    );
    expect(b).toBeCloseTo(a, 10);
  });
});

describe("posteriorSummary", () => {
  it("directional sanity (seeded mulberry32)", () => {
    const s = posteriorSummary(
      { successes: 10, denominator: 100 },
      { successes: 30, denominator: 100 },
      mulberry32(7)
    );
    expect(s.probChallengerBetter).toBeGreaterThan(0.99);
    expect(s.medianLiftPp).toBeGreaterThan(10);
    expect(s.expectedAdoptionLossPp).toBeLessThan(0.1);
  });

  it("expectedAdoptionLossPp is high when challenger is truly worse", () => {
    // mirrored data: champ now the strong arm, challenger the weak one
    const s = posteriorSummary(
      { successes: 30, denominator: 100 },
      { successes: 10, denominator: 100 },
      mulberry32(7)
    );
    expect(s.expectedAdoptionLossPp).toBeGreaterThan(10);
    expect(s.probChallengerBetter).toBeLessThan(0.01);
    expect(s.medianLiftPp).toBeLessThan(0);
  });
});
