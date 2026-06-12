import { describe, expect, it } from "vitest";
import { MockLanguageModelV2 } from "ai/test";
import { classifyReply, preClassify } from "./classify";

function textResponse(json: unknown) {
  return {
    finishReason: "stop" as const,
    usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
    content: [{ type: "text" as const, text: JSON.stringify(json) }],
    warnings: [],
  };
}

describe("preClassify (deterministic, no model call)", () => {
  it("does not fire on redirections or idioms that merely contain contact verbs", () => {
    expect(preClassify("please don't contact my assistant, contact me directly")).toBeNull();
    expect(preClassify("let me remove any ambiguity — I'm interested")).toBeNull();
  });

  it("catches unsubscribe requests", () => {
    expect(preClassify("please remove me from your list")?.classification).toBe("unsubscribe");
    expect(preClassify("STOP EMAILING ME")?.classification).toBe("unsubscribe");
  });

  it("catches out-of-office auto-replies", () => {
    expect(preClassify("I am out of office until Monday")?.classification).toBe("out_of_office");
    expect(preClassify("Automatic reply: on parental leave")?.classification).toBe("out_of_office");
  });

  it("passes everything else to the model", () => {
    expect(preClassify("sounds interesting, tell me more")).toBeNull();
  });
});

describe("classifyReply", () => {
  it("returns the pre-classification without calling the model", async () => {
    // model double that throws if invoked
    const model = new MockLanguageModelV2({
      doGenerate: async () => {
        throw new Error("model should not be called for unsubscribe pre-classification");
      },
    });

    const result = await classifyReply("please unsubscribe me", model);

    expect(result.classification).toBe("unsubscribe");
  });

  it("uses the model for nuanced replies", async () => {
    const model = new MockLanguageModelV2({
      doGenerate: async () =>
        textResponse({ classification: "interested", rationale: "asks to learn more" }),
    });

    const result = await classifyReply("sounds interesting, tell me more", model);

    expect(result.classification).toBe("interested");
    expect(result.rationale).toBe("asks to learn more");
    expect(model.doGenerateCalls).toHaveLength(1);
  });
});
