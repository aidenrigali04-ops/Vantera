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

  // ── message-shape selector (spec §6/§7 + review M-gate: master switch on generation) ──
  describe("messageShape proposals", () => {
    // The `message_shape_auto` master switch must be ON for ANY shape to be proposed. Every
    // shape-mechanics test below sets it; the OFF test proves the dormant end-to-end path.
    const ON = { ...INPUT, messageShapeAuto: true };

    it("MASTER GATE OFF (default): proposes ZERO messageShape on any candidate, even a valid safe one", async () => {
      // Feature dormant: the challenger arms carry no shape, mirroring the champion-default gate in
      // copy-draft. Combined with the byte-identical champion, the whole feature is OFF end-to-end.
      const out = await proposeRecipeCandidates(
        INPUT, // messageShapeAuto undefined = OFF
        modelReturning([
          { messageShape: "trigger_consequence" },
          { messageShape: "gift", askStyle: "soft" },
          { messageShape: "peer_insider" },
        ])
      );
      expect(out.some((c) => c.messageShape !== undefined)).toBe(false);
      // the non-shape knobs on a candidate still survive the dropped shape
      expect(out.some((c) => c.askStyle === "soft")).toBe(true);
    });

    it("OFF does not let even a pinned account propose a shape (master gate beats the bold pin)", async () => {
      const out = await proposeRecipeCandidates(
        { ...INPUT, boldShapesAllowed: true }, // pinned, but master switch OFF
        modelReturning([{ messageShape: "provocation" }, { messageShape: "trigger_consequence" }])
      );
      expect(out.some((c) => c.messageShape !== undefined)).toBe(false);
    });

    it("ON: maps a valid safe shape onto the candidate", async () => {
      const out = await proposeRecipeCandidates(
        ON,
        modelReturning([{ messageShape: "trigger_consequence" }])
      );
      expect(out.some((c) => c.messageShape === "trigger_consequence")).toBe(true);
    });

    it("ON: drops an unknown shape but keeps the candidate's other knobs (schema drops the bad value)", async () => {
      // z.enum rejects the unknown value; the object still parses, so askStyle survives.
      const out = await proposeRecipeCandidates(
        ON,
        modelReturning([{ messageShape: "banter", askStyle: "soft" }])
      );
      expect(out.some((c) => c.messageShape !== undefined)).toBe(false);
      expect(out.some((c) => c.askStyle === "soft")).toBe(true);
    });

    it("ON: drops observation_question (proposing the default is a no-op challenger)", async () => {
      const out = await proposeRecipeCandidates(
        ON,
        modelReturning([{ messageShape: "observation_question", followupLength: "tight" }])
      );
      expect(out.some((c) => c.messageShape !== undefined)).toBe(false);
      expect(out.some((c) => c.followupLength === "tight")).toBe(true);
    });

    it("ON: bold-shape pinning — safe shapes for all, bold only for a pinned account", async () => {
      const boldCandidate = [{ messageShape: "provocation" as const }];
      const notPinned = await proposeRecipeCandidates(ON, modelReturning(boldCandidate));
      expect(notPinned.some((c) => c.messageShape === "provocation")).toBe(false);

      const pinned = await proposeRecipeCandidates(
        { ...ON, boldShapesAllowed: true },
        modelReturning(boldCandidate)
      );
      expect(pinned.some((c) => c.messageShape === "provocation")).toBe(true);

      // and a SAFE shape is proposed for the non-pinned account when the master switch is on
      const safe = await proposeRecipeCandidates(ON, modelReturning([{ messageShape: "gift" as const }]));
      expect(safe.some((c) => c.messageShape === "gift")).toBe(true);
    });

    it("ON + high-trust: never proposes provocation/disqualifier even when bold-pinned; own_cold + safe shapes still allowed (config-aware eligibility, spec 2026-07-21)", async () => {
      const HT = { ...ON, boldShapesAllowed: true, highTrust: true };
      const out = await proposeRecipeCandidates(
        HT,
        modelReturning([
          { messageShape: "provocation" },
          { messageShape: "disqualifier" },
          { messageShape: "own_cold" },
          { messageShape: "gift" },
        ])
      );
      // the two aggressive shapes are excluded for a regulated seller's brand, pin or not
      expect(out.some((c) => c.messageShape === "provocation")).toBe(false);
      expect(out.some((c) => c.messageShape === "disqualifier")).toBe(false);
      // own_cold (the honest cold-open) and the safe gift shape survive
      expect(out.some((c) => c.messageShape === "own_cold")).toBe(true);
      expect(out.some((c) => c.messageShape === "gift")).toBe(true);
    });

    it("ON + standard trust: a self_serve-friendly gift is proposable; a bold shape still needs the pin", async () => {
      // gift is a SAFE shape → in-play for any account (a self_serve/traffic profile is its natural
      // fit). Bold shapes remain founder-account-pinned regardless of trust.
      const out = await proposeRecipeCandidates(
        ON, // standard trust (highTrust unset), not bold-pinned
        modelReturning([{ messageShape: "gift" }, { messageShape: "provocation" }])
      );
      expect(out.some((c) => c.messageShape === "gift")).toBe(true);
      expect(out.some((c) => c.messageShape === "provocation")).toBe(false);
    });

    it("ON: a shape makes the candidate signature distinct so the bandit aggregates it separately", async () => {
      const out = await proposeRecipeCandidates(
        ON,
        modelReturning([{ openWith: "trigger", messageShape: "gift" }])
      );
      // the knob-flip baseline is {openWith:trigger}; the shaped one must not collide with it.
      const shaped = out.find((c) => c.messageShape === "gift");
      expect(shaped).toBeDefined();
      expect(strategySignature(shaped!)).not.toBe(strategySignature({ openWith: "trigger" }));
    });
  });
});
