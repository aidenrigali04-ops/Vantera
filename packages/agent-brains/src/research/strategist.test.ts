import { describe, expect, it } from "vitest";
import { BRAINS } from "./brains";
import { createResearch, runResearch, tuneSalt } from "./governor";

describe("strategist", () => {
  it("assembles a combination from this account's measured winners and does not invent an empty label", async () => {
    const state = createResearch(4);
    const propose = BRAINS.strategist;
    const out = await propose(
      {
        champion: state.champion,
        championScore: state.championScore,
        library: [
          {
            id: "a",
            brain: "mutator",
            changes: [{ arena: "conversation", gene: "askStyle", from: "soft", to: "specific" }],
            lift: 0.2,
            margin: 0.02,
            worstLift: 0.01,
            verdict: "promoted",
            generation: 1,
          },
          {
            id: "b",
            brain: "mutator",
            changes: [{ arena: "outreach_followup", gene: "followupLength", from: "standard", to: "tight" }],
            lift: 0.15,
            margin: 0.02,
            worstLift: 0.01,
            verdict: "promoted",
            generation: 2,
          },
        ],
        arenas: state.cfg.arenas,
        generation: 3,
        rand: () => 0.5,
        elites: [],
      },
      3,
    );
    expect(out.length).toBeGreaterThan(0);
    const combined = out.find((p) => p.hypothesis.includes("ask style") && p.hypothesis.includes("follow-up length"));
    expect(combined).toBeTruthy();
    expect(combined!.falsifyBelow).toBeLessThanOrEqual(combined!.predictedLift);
    for (const proposal of out) {
      for (const genome of Object.values(proposal.strategy)) {
        for (const value of Object.values(genome)) expect(value.startsWith("open ")).toBe(false);
      }
    }
  });

  it("the fresh hill-climb never uses the sealed salt", () => {
    const state = createResearch(9);
    expect(tuneSalt(state.salts.sealed, 1)).not.toBe(state.salts.sealed);
    expect(tuneSalt(state.salts.sealed, 4)).not.toBe(state.salts.sealed);
  });

  it("a hive derives its champion per seed and stays inside the sealed score", async () => {
    const a = await runResearch(11, 20, { multiplicity: true, continuous: true });
    const b = await runResearch(15, 20, { multiplicity: true, continuous: true });
    expect(a.champion).not.toEqual(b.champion);
    for (const s of [a, b]) {
      expect(s.championScore).toBeLessThanOrEqual(s.sealedOracle + 1e-6);
      expect(s.brains.strategist?.proposed).toBeGreaterThan(0);
      for (const arena of Object.values(s.champion)) {
        for (const value of Object.values(arena ?? {})) expect(String(value).startsWith("open ")).toBe(false);
      }
    }
  }, 120_000);
});
