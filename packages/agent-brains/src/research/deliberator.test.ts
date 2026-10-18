import { describe, expect, it } from "vitest";
import { MockLanguageModelV3 } from "ai/test";
import { buildDeliberatorBundle, makeDeliberator } from "./deliberator";
import { createResearch, runGeneration } from "./governor";
import type { BrainContext } from "./brains";

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

const valid = {
  strategy: { conversation: { askStyle: "specific" } },
  hypothesis: "A specific ask books more meetings.",
  mechanism: "askStyle=specific is still untested against the champion.",
  predictedLift: 0.2,
  falsifyBelow: 0,
};

describe("deliberator", () => {
  it("passes every well-formed idea to the governor, and the next call sees the measured verdicts", async () => {
    const seen: string[] = [];
    const model = new MockLanguageModelV3({
      doGenerate: async (input) => {
        seen.push(JSON.stringify(input));
        return textResponse({
          proposals: [
            valid,
            { ...valid, strategy: { conversation: { askStyle: "hypnotic" } }, hypothesis: "illegal value" },
            { ...valid, strategy: { magic: { x: "y" } }, hypothesis: "unknown arena" },
          ],
        });
      },
    });
    const state = createResearch(11, { proposalsPerGeneration: 30 }, { brains: { deliberator: makeDeliberator(model) } });
    await runGeneration(state);
    await runGeneration(state);
    expect(state.proposals.some((p) => p.brain === "deliberator")).toBe(true);
    const open = state.proposals.filter((p) => p.brain === "deliberator" && p.changes.some((c) => c.to === "hypnotic" || c.arena === ("magic" as never)));
    expect(open.length).toBeGreaterThan(0);
    for (const p of open) expect(p.verdict).not.toBe("promoted");
    expect(state.feedbackLog.some((f) => f.brain === "deliberator" && f.outcome.startsWith("rejected:"))).toBe(true);
    expect(seen.length).toBeGreaterThanOrEqual(2);
    expect(seen[1]).toContain("rejected:");
  }, 30_000);

  it("drops a proposal whose change set is already in the library", async () => {
    const state = createResearch(3);
    const model = new MockLanguageModelV3({
      doGenerate: async () => textResponse({ proposals: [valid] }),
    });
    const ctx: BrainContext = {
      champion: state.champion,
      championScore: state.championScore,
      library: [
        {
          id: "prior",
          brain: "mutator",
          changes: [{ arena: "conversation", gene: "askStyle", from: "soft", to: "specific" }],
          lift: 0.1,
          margin: 0.02,
          worstLift: 0,
          verdict: "rejected",
          generation: 1,
          reason: "not decisive",
        },
      ],
      arenas: state.cfg.arenas,
      generation: 2,
      rand: () => 0.5,
      elites: [],
      feedback: [],
    };
    const out = await makeDeliberator(model)(ctx, 2);
    expect(out).toEqual([]);
  });

  it("returns nothing when the model throws", async () => {
    const model = new MockLanguageModelV3({
      doGenerate: async () => {
        throw new Error("model down");
      },
    });
    const state = createResearch(3);
    const ctx: BrainContext = {
      champion: state.champion,
      championScore: state.championScore,
      library: [],
      arenas: state.cfg.arenas,
      generation: 1,
      rand: () => 0.5,
      elites: [],
    };
    expect(await makeDeliberator(model)(ctx, 2)).toEqual([]);
  });

  it("the input bundle has no world, seed, salt, or sealed fields", () => {
    const state = createResearch(3);
    const bundle = buildDeliberatorBundle(
      {
        champion: state.champion,
        championScore: state.championScore,
        library: [],
        arenas: state.cfg.arenas,
        generation: 1,
        rand: () => 0.5,
        elites: [],
        feedback: [{ brain: "deliberator", proposalId: "invalid-1", outcome: "invalid_genome: bad value" }],
      },
      2,
    );
    expect(JSON.stringify(bundle)).not.toMatch(/world|seed|salt|sealed/i);
  });
});
