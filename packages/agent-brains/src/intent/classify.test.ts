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
    expect(verdicts).toEqual([{ ref: "p/x", reasoning: "no readable evidence", is_intent: false, level: "none", why_now: "" }]);
  });

  it("judges an empty reaction as none even when context carries the post they liked — model is never called", async () => {
    const model = new MockLanguageModelV3({
      doGenerate: async () => {
        throw new Error("model should not be called for a like with no comment");
      },
    });
    const verdicts = await classifyIntent(
      [
        {
          ref: "p/like",
          signalKind: "engagement",
          action: "reacted",
          text: "",
          context: "We're bleeding customers every renewal — anyone have a churn tool?",
        },
      ],
      { accountIndustry: "SaaS", valueProp: "reduces churn" },
      model
    );
    expect(verdicts).toEqual([
      { ref: "p/like", reasoning: "no readable evidence", is_intent: false, level: "none", why_now: "" },
    ]);
  });

  it("sends the person's words as evidence and the engaged post as labeled context", async () => {
    let prompt = "";
    const model = new MockLanguageModelV3({
      doGenerate: async (opts) => {
        prompt = JSON.stringify(opts);
        return textResponse({
          verdicts: [
            { ref: "p/c", reasoning: "asks for a churn tool", is_intent: true, level: "high", why_now: "commented asking for a churn tool" },
          ],
        });
      },
    });
    await classifyIntent(
      [
        {
          ref: "p/c",
          signalKind: "engagement",
          action: "commented",
          text: "anyone recommend a churn tool?",
          context: "we keep struggling with onboarding churn",
        },
      ],
      { accountIndustry: "SaaS", valueProp: "reduce churn" },
      model
    );
    expect(prompt).toContain("evidence:anyone recommend a churn tool?");
    expect(prompt).toContain("context:we keep struggling with onboarding churn");
    // the post they engaged is labeled context, not unlabeled text the model could treat as theirs
    expect(prompt).not.toMatch(/ \| we keep struggling with onboarding churn"/);
  });
});
