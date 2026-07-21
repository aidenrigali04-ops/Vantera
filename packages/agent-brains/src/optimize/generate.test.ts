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

  // ── message-shape selector (spec §6/§7) ──
  describe("messageShape proposals", () => {
    it("maps a valid safe shape onto the candidate", async () => {
      const out = await proposeRecipeCandidates(
        INPUT,
        modelReturning([{ messageShape: "trigger_consequence" }])
      );
      expect(out.some((c) => c.messageShape === "trigger_consequence")).toBe(true);
    });

    it("drops an unknown shape but keeps the candidate's other knobs (schema drops the bad value)", async () => {
      // z.enum rejects the unknown value; the object still parses, so askStyle survives.
      const out = await proposeRecipeCandidates(
        INPUT,
        modelReturning([{ messageShape: "banter", askStyle: "soft" }])
      );
      expect(out.some((c) => c.messageShape !== undefined)).toBe(false);
      expect(out.some((c) => c.askStyle === "soft")).toBe(true);
    });

    it("drops observation_question (proposing the default is a no-op challenger)", async () => {
      const out = await proposeRecipeCandidates(
        INPUT,
        modelReturning([{ messageShape: "observation_question", followupLength: "tight" }])
      );
      expect(out.some((c) => c.messageShape !== undefined)).toBe(false);
      expect(out.some((c) => c.followupLength === "tight")).toBe(true);
    });

    it("bold-shape pinning: a non-pinned account never gets a bold shape; a pinned account can explore it", async () => {
      const boldCandidate = [{ messageShape: "provocation" as const }];
      const notPinned = await proposeRecipeCandidates(INPUT, modelReturning(boldCandidate));
      expect(notPinned.some((c) => c.messageShape === "provocation")).toBe(false);

      const pinned = await proposeRecipeCandidates(
        { ...INPUT, boldShapesAllowed: true },
        modelReturning(boldCandidate)
      );
      expect(pinned.some((c) => c.messageShape === "provocation")).toBe(true);
    });

    it("a shape makes the candidate signature distinct so the bandit aggregates it separately", async () => {
      const out = await proposeRecipeCandidates(
        INPUT,
        modelReturning([{ openWith: "trigger", messageShape: "gift" }])
      );
      // the knob-flip baseline is {openWith:trigger}; the shaped one must not collide with it.
      const shaped = out.find((c) => c.messageShape === "gift");
      expect(shaped).toBeDefined();
      expect(strategySignature(shaped!)).not.toBe(strategySignature({ openWith: "trigger" }));
    });
  });
});
