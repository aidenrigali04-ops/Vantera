import { describe, expect, it } from "vitest";
import { MockLanguageModelV3 } from "ai/test";
import { proposeRecipeCandidates } from "./generate";
import { strategySignature } from "./bandit";

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

const modelReturning = (candidates: unknown[]) =>
  new MockLanguageModelV3({
    doGenerate: async () => textResponse({ reasoning: "test ideas", candidates }),
  });

const INPUT = {
  stageKey: "acceptance" as const,
  champion: { openWith: "pain" as const },
  recentConclusions: [],
};

describe("proposeRecipeCandidates", () => {
  it("always puts the deterministic knob-flip first (loop never depends on the LLM)", async () => {
    const out = await proposeRecipeCandidates(
      INPUT,
      modelReturning([{ openerAngle: "their recent post topic as the doorway" }])
    );
    // champion openWith=pain → flip = trigger (proposeNextChallenger semantics)
    expect(out[0]).toEqual({ openWith: "trigger" });
    expect(out).toHaveLength(2);
  });

  it("drops candidates with claim-risk angles, champion duplicates, and signature dupes; caps at 6", async () => {
    const out = await proposeRecipeCandidates(
      INPUT,
      modelReturning([
        { openerAngle: "teams see 40% more replies" }, // claim risk → dropped
        { openWith: "pain" }, // equals champion → dropped
        { openerAngle: "a peer in their niche facing the same pain" },
        { openerAngle: "a peer in their niche facing the same pain" }, // dupe → dropped
        { openWith: "trigger" }, // dupe of the knob-flip baseline → dropped
        { askStyle: "soft" },
        { askStyle: "specific" },
        { followupLength: "tight" },
        { followupLength: "standard" }, // over the cap → dropped
      ])
    );
    const sigs = out.map(strategySignature);
    expect(new Set(sigs).size).toBe(out.length);
    expect(out.length).toBeLessThanOrEqual(6);
    expect(sigs).not.toContain(strategySignature({ openWith: "pain" }));
    expect(out.some((c) => c.openerAngle?.includes("40%"))).toBe(false);
    expect(out.some((c) => c.openerAngle === "a peer in their niche facing the same pain")).toBe(true);
  });

  it("returns just the knob-flip when the model throws (the loop must never stall)", async () => {
    const model = new MockLanguageModelV3({
      doGenerate: async () => {
        throw new Error("model down");
      },
    });
    const out = await proposeRecipeCandidates(INPUT, model);
    expect(out).toEqual([{ openWith: "trigger" }]);
  });

  it("drops empty candidate objects", async () => {
    const out = await proposeRecipeCandidates(INPUT, modelReturning([{}, {}]));
    expect(out).toEqual([{ openWith: "trigger" }]);
  });
});
