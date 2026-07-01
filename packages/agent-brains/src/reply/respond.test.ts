import { describe, expect, it } from "vitest";
import { MockLanguageModelV3 } from "ai/test";
import { draftConversationMessage, type ConversationMessageInput } from "./respond";
import type { StoredInsights } from "../prospect/schema";

const insights: StoredInsights = {
  pain_points: ["reps waste hours on unqualified leads"],
  triggers: ["just raised a Series A"],
  motivations: ["hit the new pipeline number"],
  value_angle: "qualify before you spend a rep's time",
  aha_moment: "first booked meeting from a lead they'd have skipped",
  summary: "VP Sales scaling a young team",
};

const input = (over: Partial<ConversationMessageInput> = {}): ConversationMessageInput => ({
  lead: { firstName: "Ryan", lastName: "Cunningham", title: "VP Sales", companyName: "Northwind", industry: "SaaS" },
  insights,
  context: { cta: "a quick 15-min intro", accountName: "Vantera", accountIndustry: "sales tech", valueProp: "qualifies leads before outreach" },
  thread: [
    { role: "agent", text: "Thanks for connecting, Ryan." },
    { role: "lead", text: "Thanks! What does Vantera actually do?" },
  ],
  incoming: "Thanks! What does Vantera actually do?",
  classification: "neutral",
  ...over,
});

function textResponse(json: unknown) {
  return {
    finishReason: { unified: "stop" as const, raw: "stop" },
    usage: { inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 1, text: 1, reasoning: 0 } },
    content: [{ type: "text" as const, text: JSON.stringify(json) }],
    warnings: [],
  };
}

/** doGenerate that records the rendered prompt so we can assert the grounding reached the model. */
function capturing(json: unknown, sink: (prompt: string) => void) {
  return async (opts: { prompt: unknown }) => {
    sink(JSON.stringify(opts.prompt));
    return textResponse(json);
  };
}

describe("draftConversationMessage — reply mode", () => {
  it("answers the prospect, grounded in the lead facts + the running thread", async () => {
    let seen = "";
    const model = new MockLanguageModelV3({
      doGenerate: capturing(
        { message: "It flags the leads worth a rep's time before you reach out. Want a quick look?" },
        (p) => (seen = p)
      ),
    });
    const out = await draftConversationMessage(input(), model);
    expect(out.message).toContain("rep");
    expect(out.violations).toEqual([]);
    // grounding carried: the prospect's question + the prior thread + the seller facts all reach the model
    expect(seen).toContain("What does Vantera actually do?");
    expect(seen).toContain("Thanks for connecting, Ryan.");
    expect(seen).toContain("qualify before you spend a rep's time");
  });

  it("flags a fabricated metric not present in the grounding (anti-hallucination)", async () => {
    const model = new MockLanguageModelV3({
      doGenerate: textResponse({ message: "We boost reply rates by 312% for every customer, guaranteed." }),
    });
    const out = await draftConversationMessage(input(), model);
    expect(out.violations.length).toBeGreaterThan(0);
  });

  it("passes the incoming objection through to the model", async () => {
    let seen = "";
    const model = new MockLanguageModelV3({
      doGenerate: capturing({ message: "Totally fair — the difference is the qualify step. Worth 15 min to compare?" }, (p) => (seen = p)),
    });
    await draftConversationMessage(input({ incoming: "We already use Apollo for this." }), model);
    expect(seen).toContain("We already use Apollo");
  });
});

describe("draftConversationMessage — proactive follow-up mode (no incoming)", () => {
  it("writes a follow-up that builds on the thread, told NOT to re-introduce or repeat", async () => {
    let seen = "";
    const model = new MockLanguageModelV3({
      doGenerate: capturing({ message: "One more angle, Ryan — teams your size usually see the first qualified meeting in week one. Open to a quick look?" }, (p) => (seen = p)),
    });
    const out = await draftConversationMessage(
      input({ incoming: undefined, classification: undefined, thread: [{ role: "agent", text: "Thanks for connecting, Ryan." }] }),
      model
    );
    expect(out.message.length).toBeGreaterThan(0);
    expect(out.violations).toEqual([]);
    // the prompt tells the model it's a follow-up that must build on the thread (not a cold open)
    expect(seen).toContain("hasn't replied");
    expect(seen).toContain("Thanks for connecting, Ryan.");
  });
});

describe("draftConversationMessage — restart guard", () => {
  it("flags a reply that re-introduces / cold-opens mid-thread", async () => {
    const model = new MockLanguageModelV3({
      doGenerate: textResponse({ message: "Wanted to connect and show you what Vantera does." }),
    });
    const out = await draftConversationMessage(input(), model);
    expect(out.violations.some((v) => v.rule === "restart")).toBe(true);
  });
});
