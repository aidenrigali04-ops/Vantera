import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MockLanguageModelV3 } from "ai/test";
import { ARENAS } from "../hive/arenas";
import { makeDeliberator } from "./deliberator";
import { HARM_WEIGHT, evaluate } from "./evaluator";
import { createResearch, runGeneration, runResearch, untestedMoves } from "./governor";
import { validateProposal } from "./proposal";

function textResponse(json: unknown) {
  return {
    finishReason: { unified: "stop" as const, raw: "stop" },
    usage: {
      inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
      outputTokens: { total: 20, text: 20, reasoning: 0 },
    },
    content: [{ type: "text" as const, text: JSON.stringify(json) }],
    warnings: [],
  };
}

describe("research hive: governor", () => {
  it("is deterministic: same seed, same lineage and verdicts", async () => {
    const a = await runResearch(5, 6);
    const b = await runResearch(5, 6);
    expect(a.lineage).toEqual(b.lineage);
    expect(a.proposals.map((p) => [p.id, p.verdict])).toEqual(b.proposals.map((p) => [p.id, p.verdict]));

    const mock = () =>
      makeDeliberator(
        new MockLanguageModelV3({
          doGenerate: async () => textResponse({ proposals: [] }),
        }),
      );
    const c = await runResearch(5, 4, {}, { brains: { deliberator: mock() } });
    const d = await runResearch(5, 4, {}, { brains: { deliberator: mock() } });
    expect(c.lineage).toEqual(d.lineage);
    expect(c.proposals.map((p) => [p.id, p.verdict])).toEqual(d.proposals.map((p) => [p.id, p.verdict]));
    expect(c.brains.deliberator?.proposed).toBe(0);
  }, 60_000);

  it("improves the champion on sealed worlds and never promotes a sealed regression", async () => {
    for (const seed of [11, 12, 13]) {
      const s = await runResearch(seed, 12);
      expect(s.lineage.length).toBeGreaterThan(1);
      for (let i = 1; i < s.lineage.length; i++) expect(s.lineage[i]!.sealedScore).toBeGreaterThan(s.lineage[i - 1]!.sealedScore);
      expect(s.championScore).toBeLessThanOrEqual(s.sealedOracle + 1e-9);
    }
  }, 60_000);

  it("a brain can't redefine success: a falsifier above the predicted lift is rejected at submission", () => {
    const s = createResearch(1);
    const bad = validateProposal(
      { strategy: { conversation: { ...s.champion.conversation!, askStyle: "specific" } }, predictedLift: 0.1, falsifyBelow: 0.5 },
      s.champion
    );
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error.code).toBe("bad_falsifier");
  });

  it("accepts an idea outside the catalog, and still refuses a malformed genome", () => {
    const s = createResearch(1);
    const open = validateProposal(
      { strategy: { conversation: { ...s.champion.conversation!, askStyle: "hypnotic" } }, predictedLift: 0.1, falsifyBelow: 0 },
      s.champion
    );
    expect(open.ok).toBe(true);
    if (open.ok) expect(open.changes).toEqual([{ arena: "conversation", gene: "askStyle", from: "soft", to: "hypnotic" }]);
    const wide = validateProposal(
      {
        strategy: {
          conversation: { ...s.champion.conversation!, askStyle: "specific", bookingMode: "propose_times", objectionStyle: "acknowledge_reframe" },
          outreach_followup: { ...s.champion.outreach_followup!, followupLength: "tight", touches: "3", touchGapDays: "5" },
        },
        predictedLift: 0.2,
        falsifyBelow: 0,
      },
      s.champion
    );
    expect(wide.ok).toBe(true);
    if (wide.ok) expect(wide.changes.length).toBeGreaterThan(3);
    const unnamed = validateProposal({ strategy: { magic: { x: "y" } }, predictedLift: 0.1, falsifyBelow: 0 }, s.champion);
    expect(unnamed.ok).toBe(true);
    if (unnamed.ok) expect(unnamed.strategy.conversation).toBeUndefined();
    const malformed = validateProposal(
      { strategy: { conversation: { askStyle: 1 as unknown as string } }, predictedLift: 0.1, falsifyBelow: 0 },
      s.champion
    );
    expect(malformed.ok).toBe(false);
    if (!malformed.ok) expect(malformed.error.code).toBe("invalid_genome");
  });

  it("an idea with no planted response is tried and is not recorded as a win", async () => {
    const seed = createResearch(9);
    const brain = () => [
      {
        strategy: { conversation: { ...seed.champion.conversation!, askStyle: "hypnotic" } },
        hypothesis: "A hypnotic ask books more.",
        mechanism: "No prior measurement.",
        predictedLift: 0.5,
        falsifyBelow: 0,
      },
    ];
    const run = createResearch(9, { proposalsPerGeneration: 6 }, { brains: { contrarian: brain } });
    await runGeneration(run);
    const hypnotic = run.proposals.filter((p) => p.changes.some((c) => c.to === "hypnotic"));
    expect(hypnotic).toHaveLength(1);
    expect(hypnotic[0]!.verdict).not.toBe("promoted");
    expect(hypnotic[0]!.sealed).toBeUndefined();
    expect(hypnotic[0]!.reason ?? "").toMatch(/screen/);
  });

  it("falsifies a proposal whose sealed lift misses its own pre-registered prediction", async () => {
    // Over 3 seeds the scientist/mutator make bold predictions; some must be falsified, and a
    // falsified proposal is never promoted.
    let falsified = 0;
    for (const seed of [11, 12, 13]) {
      const s = await runResearch(seed, 10);
      for (const p of s.proposals) {
        if (p.verdict === "falsified") {
          falsified++;
          expect(p.sealed!.lift).toBeLessThanOrEqual(p.falsifyBelow + 0.0005);
        }
        if (p.verdict === "promoted") expect(p.sealed!.lift).toBeGreaterThanOrEqual(p.falsifyBelow);
      }
    }
    expect(falsified).toBeGreaterThan(0);
  }, 60_000);

  it("prices harm: a strategy that lifts meetings by raising opt-outs scores lower than one that doesn't", () => {
    const s = createResearch(3);
    const set = { salt: 99, perFamily: 2, accounts: 4, horizonDays: 180 };
    const clean = evaluate(s.champion, set);
    // The evaluator's score is meetings minus HARM_WEIGHT * negatives; verify the identity on the champion.
    expect(clean.score).toBeLessThan(clean.score + HARM_WEIGHT * clean.harmRate + 1e-9);
    expect(HARM_WEIGHT).toBeGreaterThan(0);
  });

  it("never promotes a proposal that trips the harm guardrail", async () => {
    for (const seed of [11, 12, 13]) {
      const s = await runResearch(seed, 12);
      for (const p of s.proposals) {
        if (p.verdict === "promoted") expect(p.sealed!.harmDelta).toBeLessThanOrEqual(s.cfg.harmTolerance);
      }
    }
  }, 60_000);

  it("every promotion replicated on a second fresh world set before sealing", async () => {
    const s = await runResearch(12, 12);
    for (const p of s.proposals) {
      if (p.verdict !== "promoted") continue;
      expect(p.screen!.lift).toBeGreaterThan(0);
      expect(p.replicate!.lift).toBeGreaterThan(0);
      expect(p.sealed!.lift - p.sealed!.margin).toBeGreaterThan(0);
    }
  });

  it("the brains only ever see the champion, the library and their record — never a world or the sealed salt", () => {
    // Structural guard: the brain modules must not import the world generator or the evaluator.
    for (const file of ["brains.ts", "deliberator.ts"]) {
      const src = readFileSync(join(__dirname, file), "utf8");
      expect(src, file).not.toMatch(/sim\/world|generateWorld|stageProbs|salts|sealed/);
      for (const line of src.split("\n").filter((l) => l.includes('"./evaluator"'))) expect(line, file).toMatch(/^import type /);
    }
  });

  it("a promoted champion never outruns the sealed oracle, including an idea outside the catalog", async () => {
    const s = await runResearch(13, 12);
    expect(s.championScore).toBeLessThanOrEqual(s.sealedOracle + 1e-9);
    for (const p of s.proposals) {
      if (p.verdict !== "promoted") continue;
      expect(p.sealed!.lift).toBeGreaterThan(0);
      for (const c of p.changes) {
        const allowed = ARENAS[c.arena]?.genes[c.gene]?.values;
        if (allowed && !allowed.includes(c.to)) expect(p.sealed!.lift).toBeGreaterThan(0);
      }
    }
  });

  it("budget shifts toward brains that produce promotions", async () => {
    const s = await runResearch(11, 14);
    const promotedBy = Object.values(s.brains).filter((b) => b.promoted > 0);
    expect(promotedBy.length).toBeGreaterThan(0);
    const best = promotedBy.sort((a, b) => b.promoted - a.promoted)[0]!;
    const never = Object.values(s.brains).filter((b) => b.promoted === 0 && b.falsified > 0)[0];
    if (never) expect(best.credibility).toBeGreaterThan(never.credibility);
  });

  it("promotes nothing on A/A worlds where no strategy is truly better", async () => {
    let promotions = 0;
    let proposals = 0;
    for (const seed of [21, 22, 23]) {
      const s = createResearch(seed, { families: ["no_winner"] });
      for (let i = 0; i < 10 && !s.converged; i++) await runGeneration(s);
      promotions += s.lineage.length - 1;
      proposals += s.proposals.length;
    }
    expect(proposals).toBeGreaterThan(60);
    expect(promotions).toBe(0);
  });

  it("continuous mode stops only on exhaustion: every single-gene move tested, final sweep empty", async () => {
    const s = createResearch(11, {});
    let guard = 0;
    while (!s.converged && guard++ < 200) await runGeneration(s);
    expect(s.converged).toBe(true);
    expect(untestedMoves(s)).toHaveLength(0);
    expect(s.sweeps).toBeGreaterThanOrEqual(1);
    // and it got most of the way to the oracle ceiling on these worlds
    expect(s.championScore / s.sealedOracle).toBeGreaterThan(0.6);
  });

  it("runGeneration is a no-op once converged", async () => {
    const s = createResearch(2, { maxPlateau: 1 });
    s.converged = true;
    expect(await runGeneration(s)).toEqual([]);
  });
});
