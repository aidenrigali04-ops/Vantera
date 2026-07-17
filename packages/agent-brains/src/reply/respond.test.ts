import { describe, expect, it } from "vitest";
import { MockLanguageModelV3 } from "ai/test";
import { draftConversationMessage, type ConversationMessageInput , allowedConversationLinks, validateConversationMessage } from "./respond";
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
      doGenerate: capturing({ message: "Totally fair, the difference is the qualify step. Worth 15 min to compare?" }, (p) => (seen = p)),
    });
    await draftConversationMessage(input({ incoming: "We already use Apollo for this." }), model);
    expect(seen).toContain("We already use Apollo");
  });
});

describe("draftConversationMessage — conversational posture (not every message pitches)", () => {
  it("carries the small-talk message + its classification to the brain, with a no-pitch-on-rapport rule", async () => {
    let seen = "";
    const model = new MockLanguageModelV3({
      doGenerate: async (opts) => {
        seen = JSON.stringify(opts);
        return textResponse({ message: "Going well thanks, hope yours is too. You?" });
      },
    });
    await draftConversationMessage(
      input({ incoming: "Hey Ryan, how's your week going?", classification: "neutral" }),
      model
    );
    // the actual message reaches the brain so it can match rapport, not reflexively pitch
    expect(seen).toContain("how's your week going");
    // and the system prompt grants explicit permission to just reply to small talk
    expect(seen.toLowerCase()).toContain("small talk");
    expect(seen.toLowerCase()).toContain("not every message should sell");
  });
});

describe("draftConversationMessage — proactive follow-up mode (no incoming)", () => {
  it("writes a follow-up that builds on the thread, told NOT to re-introduce or repeat", async () => {
    let seen = "";
    const model = new MockLanguageModelV3({
      doGenerate: capturing({ message: "One more angle, Ryan. Teams your size usually see the first qualified meeting in week one. Open to a quick look?" }, (p) => (seen = p)),
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

describe("draftConversationMessage — strategy-aware drafting (WS-3.1)", () => {
  it("renders strategy directives into the conversation prompt when context.strategy is set", async () => {
    let seen = "";
    const model = new MockLanguageModelV3({
      doGenerate: capturing(
        { message: "Happy to keep it low-key, no pressure at all." },
        (p) => (seen = p)
      ),
    });
    await draftConversationMessage(
      input({ context: { ...input().context, strategy: { askStyle: "soft" } } }),
      model
    );
    // the actual strategyDirectives line for askStyle:soft (copy/shared.ts STRATEGY_LINES)
    expect(seen).toContain("Keep the ask a soft, low-pressure interest check");
    expect(seen).toContain("Strategy for this message");
  });

  it("suppresses first-touch-only opener knobs mid-conversation (shape-aware, WS-3.1 fix)", async () => {
    let seen = "";
    const model = new MockLanguageModelV3({
      doGenerate: capturing({ message: "No rush at all, happy to keep it light." }, (p) => (seen = p)),
    });
    await draftConversationMessage(
      input({
        context: { ...input().context, strategy: { openWith: "trigger", askStyle: "soft" } },
      }),
      model
    );
    // openWith is first-touch wording ("Open by naming...") — rendered mid-thread it contradicts
    // the anti-restart rule, so the conversation shape must drop it...
    expect(seen).not.toContain("Open by naming");
    // ...while conversation-safe knobs still render
    expect(seen).toContain("Keep the ask a soft, low-pressure interest check");
  });

  it("prompt is byte-identical to before when strategy is absent", async () => {
    let withNoStrategyKey = "";
    let withUndefinedStrategy = "";
    const modelA = new MockLanguageModelV3({
      doGenerate: capturing({ message: "ok" }, (p) => (withNoStrategyKey = p)),
    });
    const modelB = new MockLanguageModelV3({
      doGenerate: capturing({ message: "ok" }, (p) => (withUndefinedStrategy = p)),
    });
    // context with no `strategy` key at all — the shape every prompt used before the optimizer
    const contextSansStrategy = {
      cta: "a quick 15-min intro",
      accountName: "Vantera",
      accountIndustry: "sales tech",
      valueProp: "qualifies leads before outreach",
    };
    await draftConversationMessage(input({ context: contextSansStrategy }), modelA);
    // same context, `strategy` present but explicitly undefined — must produce the identical prompt
    await draftConversationMessage(
      input({ context: { ...contextSansStrategy, strategy: undefined } }),
      modelB
    );
    expect(withNoStrategyKey).toBe(withUndefinedStrategy);
    expect(withNoStrategyKey).not.toContain("Strategy for this message");
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

describe("validateConversationMessage — link whitelist + action claims (2026-07-08)", () => {
  const BLOCK = "Seller company: Vantera\nSeller offer: outreach agents";

  it("allows the booking link when whitelisted", () => {
    const out = validateConversationMessage(
      "Happy to walk you through it, grab any time here: https://cal.com/aiden/15min",
      BLOCK,
      ["https://cal.com/aiden/15min"]
    );
    expect(out.filter((v) => v.rule === "unapproved-link")).toEqual([]);
  });

  it("flags any non-whitelisted URL", () => {
    const out = validateConversationMessage("See https://sketchy.example/pricing", BLOCK, []);
    expect(out.some((v) => v.rule === "unapproved-link")).toBe(true);
  });

  it("flags a reply that runs long past the 300-char / 52-word ceiling (a wall of text)", () => {
    const wall = Array.from({ length: 70 }, (_, i) => `bit${i % 7}`).join(" ");
    const out = validateConversationMessage(wall, BLOCK, []);
    expect(out.some((v) => v.rule === "length")).toBe(true);
  });

  it("flags fabricated platform actions", () => {
    const out = validateConversationMessage("That's kind, just joined!", BLOCK, []);
    expect(out.some((v) => v.rule === "action-claim")).toBe(true);
  });

  it("allowedConversationLinks collects booking + website + content links only", () => {
    expect(
      allowedConversationLinks({
        cta: "x",
        bookingUrl: "https://cal.com/a",
        websiteUrl: "https://cityscale.example/portfolio",
        contentLinks: ["https://v.dev/p", "deck.pdf"],
      })
    ).toEqual(["https://cal.com/a", "https://cityscale.example/portfolio", "https://v.dev/p"]);
  });

  it("the website destination passes the link whitelist (traffic-first conversion path)", () => {
    const out = validateConversationMessage(
      "Easiest is to just see the work: https://cityscale.example/portfolio",
      "Seller company: City Scale",
      allowedConversationLinks({ cta: "x", websiteUrl: "https://cityscale.example/portfolio" })
    );
    expect(out.filter((v) => v.rule === "unapproved-link")).toEqual([]);
  });
});
