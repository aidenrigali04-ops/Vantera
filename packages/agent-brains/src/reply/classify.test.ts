import { describe, expect, it } from "vitest";
import { MockLanguageModelV3 } from "ai/test";
import { classifyReply, preClassify } from "./classify";

function textResponse(json: unknown) {
  return {
    finishReason: { unified: "stop" as const, raw: "stop" },
    usage: { inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 1, text: 1, reasoning: 0 } },
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
    expect(preClassify("please remove me from your list")?.booked).toBe(false);
  });

  it("catches out-of-office auto-replies", () => {
    expect(preClassify("I am out of office until Monday")?.classification).toBe("out_of_office");
    expect(preClassify("Automatic reply: on parental leave")?.classification).toBe("out_of_office");
  });

  it("passes everything else to the model", () => {
    expect(preClassify("sounds interesting, tell me more")).toBeNull();
  });

  // Over-match audit: "remove me from" / "out of office" / "auto-reply" used to fire anywhere in a
  // message, so a human loop-in became an opt-out (suppressed forever) and any mention of OOO
  // silenced a real reply. Removal must name a LIST; OOO must read like an auto-responder.
  it("does not treat a cc/thread removal or a loop-in as an unsubscribe", () => {
    expect(preClassify("remove me from the cc, loop in Sara — she owns this")).toBeNull();
    expect(preClassify("Please remove me from this thread and add my colleague Dan")).toBeNull();
    expect(preClassify("take me off the email chain, Priya will run point")).toBeNull();
  });

  it("still catches list-removal requests in their common phrasings", () => {
    expect(preClassify("remove me from your mailing list")?.classification).toBe("unsubscribe");
    expect(preClassify("Remove me from your contact list please")?.classification).toBe("unsubscribe");
    expect(preClassify("take me off your list")?.classification).toBe("unsubscribe");
    expect(preClassify("please remove me from all future messages")?.classification).toBe("unsubscribe");
    expect(preClassify("don't contact me again")?.classification).toBe("unsubscribe");
  });

  it("does not treat a human mentioning OOO / auto-replies as an auto-responder", () => {
    expect(preClassify("Out of office stuff aside — yes, I'm interested, send it over")).toBeNull();
    expect(preClassify("Does your tool send an auto-reply when someone answers?")).toBeNull();
    expect(preClassify("I was out of the office last week, sorry for the delay — what's the price?")).toBeNull();
  });

  it("still catches real auto-responder phrasings", () => {
    expect(preClassify("I'm currently out of the office until June 30 with limited access to email.")?.classification).toBe("out_of_office");
    expect(preClassify("Auto-reply: I am away until Monday")?.classification).toBe("out_of_office");
    expect(preClassify("This is an automatic reply. I am on annual leave until the 4th.")?.classification).toBe("out_of_office");
    expect(preClassify("I am on parental leave and will return in September.")?.classification).toBe("out_of_office");
    expect(preClassify("Out of the office this week at a conference, will reply when I'm back.")?.classification).toBe("out_of_office");
  });
});

describe("classifyReply", () => {
  it("returns the pre-classification without calling the model", async () => {
    // model double that throws if invoked
    const model = new MockLanguageModelV3({
      doGenerate: async () => {
        throw new Error("model should not be called for unsubscribe pre-classification");
      },
    });

    const result = await classifyReply("please unsubscribe me", model);

    expect(result.classification).toBe("unsubscribe");
  });

  it("uses the model for nuanced replies", async () => {
    const model = new MockLanguageModelV3({
      doGenerate: async () =>
        textResponse({ classification: "interested", rationale: "asks to learn more" }),
    });

    const result = await classifyReply("sounds interesting, tell me more", model);

    expect(result.classification).toBe("interested");
    expect(result.rationale).toBe("asks to learn more");
    expect(result.booked).toBe(false);
    expect(model.doGenerateCalls).toHaveLength(1);
  });

  it("flags a booked meeting when the prospect confirms a scheduled time", async () => {
    const model = new MockLanguageModelV3({
      doGenerate: async () =>
        textResponse({ classification: "interested", rationale: "agreed to Tuesday 2pm", booked: true }),
    });

    const result = await classifyReply("Tuesday at 2pm works — sending an invite now", model);

    expect(result.classification).toBe("interested");
    expect(result.booked).toBe(true);
  });

  it("never fails a reply over an over-long rationale — it is clipped, not rejected", async () => {
    // A schema-level max would throw on a chatty model and lose the reply's whole processing run.
    const long = "x".repeat(900);
    const model = new MockLanguageModelV3({
      doGenerate: async () => textResponse({ classification: "neutral", rationale: long }),
    });

    const result = await classifyReply("what does it cost?", model);

    expect(result.classification).toBe("neutral");
    expect(result.rationale.length).toBeLessThanOrEqual(300);
  });

  it("defaults booked to false when the model omits it", async () => {
    const model = new MockLanguageModelV3({
      doGenerate: async () => textResponse({ classification: "neutral", rationale: "a question" }),
    });

    const result = await classifyReply("what does it cost?", model);

    expect(result.booked).toBe(false);
  });
});
