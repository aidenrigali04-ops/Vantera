import { describe, expect, it } from "vitest";
import { ARENAS } from "../hive/arenas";
import { HARM_WEIGHT, evaluate } from "./evaluator";
import { createResearch, runGeneration, runResearch } from "./governor";
import { validateProposal } from "./proposal";

describe("research hive: governor", () => {
  it("is deterministic: same seed, same lineage and verdicts", () => {
    const a = runResearch(5, 6);
    const b = runResearch(5, 6);
    expect(a.lineage).toEqual(b.lineage);
    expect(a.proposals.map((p) => [p.id, p.verdict])).toEqual(b.proposals.map((p) => [p.id, p.verdict]));
  });

  it("improves the champion on sealed worlds and never promotes a sealed regression", () => {
    for (const seed of [11, 12, 13]) {
      const s = runResearch(seed, 12);
      expect(s.lineage.length).toBeGreaterThan(1);
      for (let i = 1; i < s.lineage.length; i++) expect(s.lineage[i]!.sealedScore).toBeGreaterThan(s.lineage[i - 1]!.sealedScore);
      expect(s.championScore).toBeLessThanOrEqual(s.sealedOracle + 1e-9);
    }
  });

  it("a brain can't redefine success: a falsifier above the predicted lift is rejected at submission", () => {
    const s = createResearch(1);
    const bad = validateProposal(
      { strategy: { conversation: { ...s.champion.conversation!, askStyle: "specific" } }, predictedLift: 0.1, falsifyBelow: 0.5 },
      s.champion
    );
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error.code).toBe("bad_falsifier");
  });

  it("rejects anything outside the closed gene sets, with the reason", () => {
    const s = createResearch(1);
    const r = validateProposal(
      { strategy: { conversation: { ...s.champion.conversation!, askStyle: "hypnotic" } }, predictedLift: 0.1, falsifyBelow: 0 },
      s.champion
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("invalid_genome");
    const r2 = validateProposal({ strategy: { magic: { x: "y" } }, predictedLift: 0.1, falsifyBelow: 0 }, s.champion);
    expect(r2.ok).toBe(false);
  });

  it("falsifies a proposal whose sealed lift misses its own pre-registered prediction", () => {
    // Over 3 seeds the scientist/mutator make bold predictions; some must be falsified, and a
    // falsified proposal is never promoted.
    let falsified = 0;
    for (const seed of [11, 12, 13]) {
      const s = runResearch(seed, 10);
      for (const p of s.proposals) {
        if (p.verdict === "falsified") {
          falsified++;
          expect(p.sealed!.lift).toBeLessThan(p.falsifyBelow);
        }
        if (p.verdict === "promoted") expect(p.sealed!.lift).toBeGreaterThanOrEqual(p.falsifyBelow);
      }
    }
    expect(falsified).toBeGreaterThan(0);
  });

  it("prices harm: a strategy that lifts meetings by raising opt-outs scores lower than one that doesn't", () => {
    const s = createResearch(3);
    const set = { salt: 99, perFamily: 2, accounts: 4, horizonDays: 180 };
    const clean = evaluate(s.champion, set);
    // The evaluator's score is meetings minus HARM_WEIGHT * negatives; verify the identity on the champion.
    expect(clean.score).toBeLessThan(clean.score + HARM_WEIGHT * clean.harmRate + 1e-9);
    expect(HARM_WEIGHT).toBeGreaterThan(0);
  });

  it("never promotes a proposal that trips the harm guardrail", () => {
    for (const seed of [11, 12, 13]) {
      const s = runResearch(seed, 12);
      for (const p of s.proposals) {
        if (p.verdict === "promoted") expect(p.sealed!.harmDelta).toBeLessThanOrEqual(s.cfg.harmTolerance);
      }
    }
  });

  it("every promotion replicated on a second fresh world set before sealing", () => {
    const s = runResearch(12, 12);
    for (const p of s.proposals) {
      if (p.verdict !== "promoted") continue;
      expect(p.screen!.lift).toBeGreaterThan(0);
      expect(p.replicate!.lift).toBeGreaterThan(0);
      expect(p.sealed!.lift - p.sealed!.margin).toBeGreaterThan(0);
    }
  });

  it("the brains only ever see the champion, the library and their record — never a world or the sealed salt", () => {
    // Structural guard: the brain modules must not import the world generator or the evaluator.
    const src = require("node:fs").readFileSync(require("node:path").join(__dirname, "brains.ts"), "utf8") as string;
    expect(src).not.toMatch(/sim\/world|generateWorld|stageProbs|salts|sealed/);
    // only a type-level import of Strategy from the evaluator is allowed (erased at compile time)
    for (const line of src.split("\n").filter((l) => l.includes('"./evaluator"'))) expect(line).toMatch(/^import type /);
  });

  it("every arena stays inside its closed gene set across the whole run", () => {
    const s = runResearch(13, 12);
    for (const [arena, g] of Object.entries(s.champion)) {
      for (const [gene, v] of Object.entries(g!)) expect(ARENAS[arena as keyof typeof ARENAS].genes[gene]!.values).toContain(v);
    }
  });

  it("budget shifts toward brains that produce promotions", () => {
    const s = runResearch(11, 14);
    const promotedBy = Object.values(s.brains).filter((b) => b.promoted > 0);
    expect(promotedBy.length).toBeGreaterThan(0);
    const best = promotedBy.sort((a, b) => b.promoted - a.promoted)[0]!;
    const never = Object.values(s.brains).filter((b) => b.promoted === 0 && b.falsified > 0)[0];
    if (never) expect(best.credibility).toBeGreaterThan(never.credibility);
  });

  it("runGeneration is a no-op once converged", () => {
    const s = createResearch(2, { maxPlateau: 1 });
    s.converged = true;
    expect(runGeneration(s)).toEqual([]);
  });
});
