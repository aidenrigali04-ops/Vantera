import { describe, expect, it } from "vitest";
import { MockLanguageModelV3 } from "ai/test";
import { fixConversationMessage, fixDraftText, fixLinkedInDraft } from "./fix";
import type { ConversationMessageInput } from "../reply/respond";
import type { DraftInput } from "./shared";
import type { StoredInsights } from "../prospect/schema";

const insights: StoredInsights = {
  pain_points: ["reps waste hours on unqualified leads"],
  triggers: ["just raised a Series A"],
  motivations: ["hit the new pipeline number"],
  value_angle: "qualify before you spend a rep's time",
  aha_moment: "first booked meeting from a lead they'd have skipped",
  summary: "VP Sales scaling a young team",
};

const draftInput: DraftInput = {
  lead: { firstName: "Ryan", lastName: "Cunningham", title: "VP Sales", companyName: "Northwind", industry: "SaaS" },
  insights,
  context: { cta: "a quick 15-min intro", accountName: "Vantera", accountIndustry: "sales tech", valueProp: "qualifies leads before outreach" },
};

const convoInput: ConversationMessageInput = {
  ...draftInput,
  thread: [
    { role: "agent", text: "Thanks for connecting, Ryan." },
    { role: "lead", text: "What does Vantera actually do?" },
  ],
};

function textResponse(json: unknown) {
  return {
    finishReason: { unified: "stop" as const, raw: "stop" },
    usage: { inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 1, text: 1, reasoning: 0 } },
    content: [{ type: "text" as const, text: JSON.stringify(json) }],
    warnings: [],
  };
}

function capturing(json: unknown, sink: (prompt: string) => void) {
  return async (opts: { prompt: unknown }) => {
    sink(JSON.stringify(opts.prompt));
    return textResponse(json);
  };
}

describe("fixDraftText — review-queue fix", () => {
  it("returns the cleaned text with no violations when the model fixes the flags", async () => {
    let seen = "";
    const model = new MockLanguageModelV3({
      doGenerate: capturing({ message: "Your post on rev ops landed. Worth comparing notes?" }, (p) => (seen = p)),
    });
    const out = await fixDraftText(
      { text: "Quick question — hope you don't mind me touching base!", flags: "banned phrase: quick question", maxChars: 300 },
      model
    );
    expect(out.violations).toEqual([]);
    expect(out.text).toContain("rev ops");
    // the flagged original and the violations both reach the model
    expect(seen).toContain("touching base");
    expect(seen).toContain("quick question");
  });

  it("keeps the violations when the fix still fails the linter (never dodges the bar)", async () => {
    const model = new MockLanguageModelV3({
      doGenerate: textResponse({ message: "Just touching base on this game-changer — quick question for you!" }),
    });
    const out = await fixDraftText(
      { text: "original", flags: "banned phrase: touching base", maxChars: 300 },
      model
    );
    expect(out.violations.length).toBeGreaterThan(0);
  });

  it("re-flags a link when banLinks is set, even if the humanizer alone would pass it", async () => {
    const model = new MockLanguageModelV3({
      doGenerate: textResponse({ message: "Here it is: https://example.com/deck — thoughts?" }),
    });
    const out = await fixDraftText(
      { text: "original", flags: "no links in a connection note", maxChars: 200, banLinks: true },
      model
    );
    expect(out.violations.some((v) => v.rule === "no-links")).toBe(true);
  });
});

describe("fixConversationMessage — automatic-send fix", () => {
  it("holds the fix to the full mid-conversation bar (restart phrases still flagged)", async () => {
    const model = new MockLanguageModelV3({
      doGenerate: textResponse({ message: "Thought I'd reach out — wanted to connect about rev ops." }),
    });
    const out = await fixConversationMessage(
      { message: "orig", violations: [{ rule: "banned-phrase", detail: "touching base" }] },
      convoInput,
      model
    );
    expect(out.violations.some((v) => v.rule === "restart")).toBe(true);
  });

  it("returns a clean fix with the thread + grounding in the prompt", async () => {
    let seen = "";
    const model = new MockLanguageModelV3({
      doGenerate: capturing({ message: "It flags the leads worth a rep's time. Want a quick look?" }, (p) => (seen = p)),
    });
    const out = await fixConversationMessage(
      { message: "orig", violations: [{ rule: "banned-phrase", detail: "touching base" }] },
      convoInput,
      model
    );
    expect(out.violations).toEqual([]);
    expect(seen).toContain("Thanks for connecting, Ryan.");
    expect(seen).toContain("qualify before you spend a rep's time");
  });
});

describe("fixLinkedInDraft — automatic-send first-touch fix", () => {
  it("fixes the pair and re-validates both messages against the grounding", async () => {
    const model = new MockLanguageModelV3({
      doGenerate: textResponse({
        connection_note: "Your Series A news caught my eye — congrats, Ryan.",
        followup_message: "Thanks for connecting. Curious how you qualify leads before reps dig in — open to comparing notes?",
      }),
    });
    const out = await fixLinkedInDraft(
      {
        connectionNote: "Quick question — love what you're doing at Northwind!",
        followupMessage: "Touching base about our game-changer platform.",
        violations: [{ rule: "banned-phrase", detail: "quick question" }],
      },
      draftInput,
      model
    );
    expect(out.violations).toEqual([]);
    expect(out.connectionNote).toContain("Series A");
  });

  it("keeps violations when the fixed pair still fails (stays reviewable, never silent-sends)", async () => {
    const model = new MockLanguageModelV3({
      doGenerate: textResponse({
        connection_note: "Big fan of what you're doing — game-changer stuff!",
        followup_message: "Touching base again about our seamless platform.",
      }),
    });
    const out = await fixLinkedInDraft(
      {
        connectionNote: "orig note",
        followupMessage: "orig follow-up",
        violations: [{ rule: "banned-phrase", detail: "quick question" }],
      },
      draftInput,
      model
    );
    expect(out.violations.length).toBeGreaterThan(0);
  });
});
