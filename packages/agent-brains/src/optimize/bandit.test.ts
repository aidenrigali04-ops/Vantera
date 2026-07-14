import { describe, expect, it } from "vitest";
import { strategySignature, aggregateBySignature, chooseChallenger } from "./bandit";
import type { LeadOutcomeFlags } from "./outcomes";

const F = (o: Partial<LeadOutcomeFlags>): LeadOutcomeFlags => ({
  invited: true,
  accepted: false,
  interested: false,
  negative: false,
  booked: false,
  converted: false,
  ...o,
});

// deterministic LCG so the sampler is reproducible in tests
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0), s / 2 ** 32);
}

describe("strategySignature", () => {
  it("is stable under key order and drops empty values", () => {
    expect(strategySignature({ openWith: "pain", askStyle: "soft" })).toBe(
      strategySignature({ askStyle: "soft", openWith: "pain" })
    );
    expect(strategySignature({})).toBe(strategySignature({ openWith: undefined }));
  });

  it("distinguishes different openerAngle values", () => {
    expect(strategySignature({ openerAngle: "peer story" })).not.toBe(
      strategySignature({ openerAngle: "post topic" })
    );
  });
});

describe("aggregateBySignature", () => {
  it("groups outcome flags per strategy signature", () => {
    const rows = [
      { strategy: { openWith: "pain" as const }, flags: F({ accepted: true }) },
      { strategy: { openWith: "pain" as const }, flags: F({}) },
      { strategy: { openWith: "trigger" as const }, flags: F({ accepted: true }) },
    ];
    const m = aggregateBySignature("acceptance", rows);
    expect(m.get(strategySignature({ openWith: "pain" }))).toEqual({
      denominator: 2,
      successes: 1,
      negatives: 0,
    });
    expect(m.get(strategySignature({ openWith: "trigger" }))).toEqual({
      denominator: 1,
      successes: 1,
      negatives: 0,
    });
  });
});

describe("chooseChallenger", () => {
  it("returns null for no candidates", () => {
    expect(chooseChallenger([], new Map(), lcg(1))).toBeNull();
  });

  it("overwhelmingly prefers the arm with far better real outcomes", () => {
    const good = { openWith: "pain" as const };
    const bad = { openWith: "trigger" as const };
    const stats = new Map([
      [strategySignature(good), { denominator: 200, successes: 120, negatives: 0 }],
      [strategySignature(bad), { denominator: 200, successes: 10, negatives: 0 }],
    ]);
    const rand = lcg(42);
    let goodWins = 0;
    for (let i = 0; i < 100; i++) {
      if (chooseChallenger([good, bad], stats, rand) === good) goodWins++;
    }
    expect(goodWins).toBeGreaterThan(90);
  });

  it("explores unseen candidates (uniform prior) rather than never picking them", () => {
    const seen = { openWith: "pain" as const };
    const unseen = { openerAngle: "a peer just solved this pain" };
    const stats = new Map([
      [strategySignature(seen), { denominator: 10, successes: 3, negatives: 0 }],
    ]);
    const rand = lcg(7);
    let unseenPicks = 0;
    for (let i = 0; i < 200; i++) {
      if (chooseChallenger([seen, unseen], stats, rand) === unseen) unseenPicks++;
    }
    expect(unseenPicks).toBeGreaterThan(20); // Beta(1,1) prior keeps real exploration pressure
  });
});
