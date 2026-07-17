import { describe, expect, it } from "vitest";
import { strategySignature, aggregateBySignature, chooseChallenger, sampleBeta } from "./bandit";
import type { LeadOutcomeFlags } from "./outcomes";
import type { VariantOutcome } from "./decide";

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

  // ── EB shrinkage (WS-1.3): SHRINK_M = 25 pseudo-observations at the pooled global rate ──────
  describe("EB shrinkage toward the pooled global rate", () => {
    it("empty stats map draws are byte-identical to Beta(1,1) for every candidate", () => {
      const a = { openWith: "pain" as const };
      const b = { openerAngle: "a peer just solved this pain" };
      const c = { askStyle: "soft" as const };
      const candidates = [a, b, c];

      const rand = lcg(2026);
      const picks: unknown[] = [];
      for (let i = 0; i < 50; i++) picks.push(chooseChallenger(candidates, new Map(), rand));

      // hand-rolled Beta(1,1) argmax, identically seeded and consuming rand in the same order —
      // pins that an empty stats map has NO shrink target (current no-data behavior, unchanged).
      const rand2 = lcg(2026);
      const expectedPicks: unknown[] = [];
      for (let i = 0; i < 50; i++) {
        let best: unknown = null;
        let bestDraw = -1;
        for (const cand of candidates) {
          const draw = sampleBeta(1, 1, rand2);
          if (draw > bestDraw) {
            bestDraw = draw;
            best = cand;
          }
        }
        expectedPicks.push(best);
      }
      expect(picks).toEqual(expectedPicks);
    });

    it("a lucky 1-of-2 signature no longer beats a solid 30-of-100 signature in argmax frequency (500 seeded draws)", () => {
      const lucky = { openWith: "pain" as const }; // 1/2 = 50% raw rate, but n too small to trust
      const solid = { openWith: "trigger" as const }; // 30/100 = 30%, real sample size
      const stats = new Map<string, VariantOutcome>([
        // 4 other historical signatures holding the stage's real ~15% baseline (60/400) — the
        // GLOBAL pooled rate shrinkage targets, distinct from just these two candidates' own avg.
        ["filler:1", { denominator: 100, successes: 15, negatives: 0 }],
        ["filler:2", { denominator: 100, successes: 15, negatives: 0 }],
        ["filler:3", { denominator: 100, successes: 15, negatives: 0 }],
        ["filler:4", { denominator: 100, successes: 15, negatives: 0 }],
        [strategySignature(solid), { denominator: 100, successes: 30, negatives: 0 }],
        [strategySignature(lucky), { denominator: 2, successes: 1, negatives: 0 }],
      ]);
      const rand = lcg(99);
      let luckyWins = 0;
      for (let i = 0; i < 500; i++) {
        if (chooseChallenger([lucky, solid], stats, rand) === lucky) luckyWins++;
      }
      // MEASURED (this exact fixture): pre-shrinkage (unshrunk Beta(2,2) vs Beta(31,71)) the lucky
      // arm won 381/500 (76%) — a 2-sample fluke beating 100 real samples, the bug this closes.
      // Post-shrinkage (M=25 toward pooled p̄≈0.181) it wins 137/500 (27%): the real, larger-sample
      // arm now dominates.
      expect(luckyWins).toBeLessThan(250);
    });
  });
});
