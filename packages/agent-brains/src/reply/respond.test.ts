import { describe, expect, it } from "vitest";
import { MockLanguageModelV3 } from "ai/test";
import { draftConversationReply, type ConversationReplyInput } from "./respond";
import type { StoredInsights } from "../prospect/schema";

const insights: StoredInsights = {
  pain_points: ["reps waste hours on unqualified leads"],
  triggers: ["just raised a Series A"],
  motivations: ["hit the new pipeline number"],
  value_angle: "qualify before you spend a rep's time",
  aha_moment: "first booked meeting from a lead they'd have skipped",
  summary: "VP Sales scaling a young team",
};

const input = (over: Partial<ConversationReplyInput> = {}): ConversationReplyInput => ({
  lead: { firstName: "Ryan", lastName: "Cunningham", title: "VP Sales", companyName: "Northwind", industry: "SaaS" },
  insights,
  context: { cta: "a quick 15-min intro", accountName: "Vantera", accountIndustry: "sales tech", valueProp: "qualifies leads before outreach" },
  thread: [
    { role: "agent", text: "Saw you just raised a Series A — congrats on the round." },
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

describe("draftConversationReply", () => {
  it("drafts a contextual next message and grounds the prompt in the lead facts + thread", async () => {
    let seen = "";
    const model = new MockLanguageModelV3({
      doGenerate: capturing(
        { message: "It flags the leads worth a rep's time before you reach out. Want a quick look at how it'd score Northwind's list?" },
        (p) => (seen = p)
      ),
    });
    const out = await draftConversationReply(input(), model);
    expect(out.message).toContain("rep");
    expect(out.violations).toEqual([]);
    // grounding carried: the prospect's question + the seller facts both reach the model
    expect(seen).toContain("What does Vantera actually do?");
    expect(seen).toContain("qualify before you spend a rep's time");
  });

  it("flags a fabricated metric not present in the grounding (anti-hallucination)", async () => {
    const model = new MockLanguageModelV3({
      doGenerate: textResponse({ message: "We boost reply rates by 312% for every customer, guaranteed." }),
    });
    const out = await draftConversationReply(input(), model);
    expect(out.violations.length).toBeGreaterThan(0);
  });

  it("passes the incoming objection through to the model", async () => {
    let seen = "";
    const model = new MockLanguageModelV3({
      doGenerate: capturing(
        { message: "Totally fair — most teams already have a tool. The difference is the qualify step. Worth 15 min to compare?" },
        (p) => (seen = p)
      ),
    });
    const out = await draftConversationReply(
      input({ incoming: "We already use Apollo for this.", classification: "neutral" }),
      model
    );
    expect(out.message.length).toBeGreaterThan(0);
    expect(seen).toContain("We already use Apollo");
  });
});
