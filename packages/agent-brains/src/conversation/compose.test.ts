import { describe, expect, it } from "vitest";
import { MockLanguageModelV3 } from "ai/test";
import { composeMessage, renderMoveBrief, COMPOSE_SYSTEM, type ComposeInput } from "./compose";
import { emptyState } from "./state";
import type { StoredInsights } from "../prospect/schema";

const insights: StoredInsights = {
  pain_points: ["reps waste hours on unqualified leads"],
  triggers: ["just raised a Series A"],
  motivations: ["hit the new pipeline number"],
  value_angle: "qualify before you spend a rep's time",
  aha_moment: "first booked meeting from a lead they'd have skipped",
  summary: "VP Sales scaling a young team",
};

function input(over: Partial<ComposeInput> = {}): ComposeInput {
  const state = emptyState();
  state.stage = "engaged";
  state.counters.leadTurns = 1;
  state.counters.agentTurnsSinceLastLead = 0;
  state.lastLeadMessageAt = "2026-10-28T10:00:00Z";
  state.person.register = { greeting: "Hey", signoff: "Cheers", emoji: true, avgSentenceWords: 9, language: "es" };
  state.memory.hooksUsed.push({ kind: "trigger", text: "your Series A announcement", messageRef: "m1" });
  state.memory.questionsAsked.push({ text: "how do you qualify leads today", answered: false, messageRef: "m1" });
  state.memory.claimsMade.push("we cut review time");
  return {
    lead: { firstName: "Ryan", lastName: "Cunningham", title: "VP Sales", companyName: "Northwind", industry: "SaaS" },
    insights,
    context: {
      cta: "a quick 15-min intro",
      accountName: "Vantera",
      accountIndustry: "sales tech",
      valueProp: "qualifies leads before outreach",
      bookingUrl: "https://cal.com/acme/intro",
      strategy: { askStyle: "specific" },
    },
    state,
    thread: [
      { role: "agent", text: "Congrats on the round." },
      { role: "lead", text: "Thanks! What does it do?" },
    ],
    incoming: "Thanks! What does it do?",
    decision: {
      move: "answer",
      style: { lengthBand: "short", question: false, link: "booking", mirror: true },
      rationale: "they asked a direct question",
    },
    sellerName: "Vantera",
    ...over,
  };
}

const reply = (m: string) => ({
  finishReason: { unified: "stop" as const, raw: "stop" },
  usage: { inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 1, text: 1, reasoning: 0 } },
  content: [{ type: "text" as const, text: JSON.stringify({ message: m }) }],
  warnings: [],
});

function model(messages: string[], sink: string[] = []) {
  let i = 0;
  return new MockLanguageModelV3({
    doGenerate: async (opts: { prompt: unknown }) => {
      sink.push(JSON.stringify(opts.prompt));
      return reply(messages[Math.min(i++, messages.length - 1)]!);
    },
  });
}

describe("composeMessage", () => {
  it("the prompt carries the move brief, the register to mirror, the do-not-say list and the open loop", async () => {
    const sink: string[] = [];
    const out = await composeMessage(input(), model(["It flags the leads worth your time before outreach."], sink));
    expect(out.violations).toEqual([]);
    const p = sink[0]!;
    expect(p).toContain("Answer their question in one plain sentence");
    expect(p).toContain("they asked a direct question");
    expect(p).toContain("240");
    expect(p).toContain("Do not ask a question");
    expect(p).toContain("https://cal.com/acme/intro");
    expect(p).toContain("Hey");
    expect(p).toContain("Cheers");
    expect(p).toContain("prospect's language");
    expect(p).toContain("your Series A announcement");
    expect(p).toContain("how do you qualify leads today");
    expect(p).toContain("we cut review time");
    expect(p).toContain("What does it do?");
    expect(p).toContain("write only the message text");
  });

  it("omits the register line when mirror is false", () => {
    const i = input();
    i.decision.style.mirror = false;
    expect(renderMoveBrief(i.decision, i.state)).not.toContain("Cheers");
  });

  it("lints with validateConversationMessage + lintForMove and does one bounded regenerate", async () => {
    const sink: string[] = [];
    // first draft: two questions + bump phrase + a question where none is allowed; second is clean
    const m = model(["Any thoughts? Does that help? Want to talk?", "It flags the leads worth your time before outreach."], sink);
    const out = await composeMessage(input(), m);
    expect(sink).toHaveLength(2);
    expect(sink[1]).toContain("too-many-questions");
    expect(out.message).toBe("It flags the leads worth your time before outreach.");
    expect(out.violations).toEqual([]);
  });

  it("surfaces persistent violations after the one regenerate", async () => {
    const out = await composeMessage(input(), model(["Any thoughts? Does that help you?"]));
    expect(out.violations.map((v) => v.rule)).toEqual(expect.arrayContaining(["bump-phrase", "question-not-allowed"]));
  });

  it("normalizes em-dashes before linting", async () => {
    const out = await composeMessage(input(), model(["It flags the right leads — before your reps spend time."]));
    expect(out.message).not.toContain("—");
  });

  it("wait and hand_to_human throw (never composed)", async () => {
    for (const move of ["wait", "hand_to_human"] as const) {
      const i = input();
      i.decision.move = move;
      await expect(composeMessage(i, model(["x"]))).rejects.toThrow(`move is not composable: ${move}`);
    }
  });

  it("the champion strategy directives are NOT in the prompt", async () => {
    const sink: string[] = [];
    await composeMessage(input(), model(["It flags the leads worth your time."], sink));
    expect(sink[0]).not.toContain("propose a specific short call");
  });

  it("registers a system prompt and calls with a 300 token cap", () => {
    expect(COMPOSE_SYSTEM.text).toContain("Seller company");
    expect(COMPOSE_SYSTEM.text).not.toContain("Reply mode");
  });
});
