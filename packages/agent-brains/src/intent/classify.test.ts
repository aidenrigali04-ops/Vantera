import { describe, expect, it } from "vitest";
import { MockLanguageModelV3 } from "ai/test";
import { classifyIntent, normalizeVerdict } from "./classify";

function textResponse(json: unknown) {
  return {
    finishReason: { unified: "stop" as const, raw: "stop" },
    usage: { inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 1, text: 1, reasoning: 0 } },
    content: [{ type: "text" as const, text: JSON.stringify(json) }],
    warnings: [],
  };
}

describe("normalizeVerdict (pure)", () => {
  it("keeps is_intent true only for high/medium and caps text", () => {
    expect(normalizeVerdict({ ref: "r", reasoning: "x", is_intent: true, level: "none", why_now: "y" }).is_intent).toBe(false);
    expect(normalizeVerdict({ ref: "r", reasoning: "x", is_intent: true, level: "low", why_now: "y" }).is_intent).toBe(false);
    expect(normalizeVerdict({ ref: "r", reasoning: "x", is_intent: true, level: "medium", why_now: "y" }).is_intent).toBe(true);
    expect(normalizeVerdict({ ref: "r", reasoning: "x", is_intent: false, level: "high", why_now: "y" }).is_intent).toBe(false);
    expect(normalizeVerdict({ ref: "r", reasoning: "a".repeat(400), is_intent: false, level: "none", why_now: "b".repeat(400) }).why_now.length).toBe(200);
  });
});

describe("classifyIntent", () => {
  it("classifies a batch, maps verdicts back by ref, and drops unknown refs", async () => {
    const model = new MockLanguageModelV3({
      doGenerate: async () =>
        textResponse({
          verdicts: [
            { ref: "p/a", reasoning: "asks for a churn tool", is_intent: true, level: "high", why_now: "commented asking for a churn tool" },
            // model over-claims is_intent on a tangential like → normalized to false
            { ref: "p/b", reasoning: "tangential", is_intent: true, level: "low", why_now: "liked a general post" },
            // ref not in the batch → dropped
            { ref: "ghost", reasoning: "x", is_intent: true, level: "high", why_now: "y" },
          ],
        }),
    });
    const verdicts = await classifyIntent(
      [
        { ref: "p/a", signalKind: "engagement", action: "commented", text: "anyone recommend a churn tool?" },
        { ref: "p/b", signalKind: "engagement", action: "reacted", text: "great RevOps tips" },
      ],
      { accountIndustry: "SaaS", valueProp: "reduce churn" },
      model
    );
    expect(verdicts).toEqual([
      { ref: "p/a", reasoning: "asks for a churn tool", is_intent: true, level: "high", why_now: "commented asking for a churn tool" },
      { ref: "p/b", reasoning: "tangential", is_intent: false, level: "low", why_now: "liked a general post" },
    ]);
  });

  it("judges empty-text observations as none without calling the model", async () => {
    const model = new MockLanguageModelV3({
      doGenerate: async () => {
        throw new Error("model should not be called when nothing is readable");
      },
    });
    const verdicts = await classifyIntent(
      [{ ref: "p/x", signalKind: "engagement", action: "reacted", text: "   " }],
      {},
      model
    );
    expect(verdicts).toEqual([{ ref: "p/x", reasoning: "no readable post text", is_intent: false, level: "none", why_now: "" }]);
  });
});
