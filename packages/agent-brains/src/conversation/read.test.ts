import { describe, expect, it } from "vitest";
import { MockLanguageModelV3 } from "ai/test";
import { applyReadout, isSellerTurn, readTurn, readoutSchema, type Readout } from "./read";
import { emptyState, type StoredTurn } from "./state";
import type { ReadoutLike } from "./rules";

const base: Readout = {
  stance: "neutral", confidence: 0.6, intent: "other", explicitOptOut: false, identitySuspicion: false, booked: false,
  answeredQuestionRef: null, newProblems: [], newPriorities: [], newObjection: null,
  personDelta: { directness: null, formality: null, warmth: null, skepticism: null, verbosity: null, seniority: null, role: null, roleConfidence: null, language: null, emoji: null, notes: [] },
  hookUsed: null, questionAsked: null, claims: [], linksShared: [], ask: "none", labeled: false,
};
const ro = (o: Partial<Readout> = {}): Readout => ({ ...base, ...o });
const turn = (role: StoredTurn["role"], text: string, ref = "t1", at = "2026-10-28T10:00:00Z"): StoredTurn => ({ ref, role, text, at });

function textResponse(json: unknown) {
  return {
    finishReason: { unified: "stop" as const, raw: "stop" },
    usage: { inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 1, text: 1, reasoning: 0 } },
    content: [{ type: "text" as const, text: JSON.stringify(json) }],
    warnings: [],
  };
}
function capturing(json: unknown, sink: (p: string) => void) {
  return async (opts: { prompt: unknown }) => {
    sink(JSON.stringify(opts.prompt));
    return textResponse(json);
  };
}

describe("readTurn", () => {
  it("a lead turn's readout is parsed and the prompt carries the compact state and the turn text", async () => {
    let seen = "";
    const model = new MockLanguageModelV3({ doGenerate: capturing(ro({ intent: "asks_question", stance: "positive" }), (p) => (seen = p)) });
    const out = await readTurn(emptyState(), turn("lead", "What does it cost?"), "Seller sells X", model);
    expect(out.intent).toBe("asks_question");
    expect(seen).toContain("What does it cost?");
    expect(seen).toContain("stage: pre_contact");
    expect(seen).toContain("Seller sells X");
  });

  it("reads a non-English reply: stance neutral, intent asks_question", async () => {
    let seen = "";
    const model = new MockLanguageModelV3({ doGenerate: capturing(ro({ intent: "asks_question", personDelta: { ...base.personDelta, language: "es" } }), (p) => (seen = p)) });
    const out = await readTurn(emptyState(), turn("lead", "Hola, ¿cuánto cuesta el servicio?"), "g", model);
    expect(seen).toContain("cuánto cuesta");
    expect(out.stance).toBe("neutral");
    expect(out.intent).toBe("asks_question");
    expect(applyReadout(emptyState(), turn("lead", "x"), out).person.register.language).toBe("es");
  });

  it("an emoji-only reply is small talk, never opt_out", async () => {
    const model = new MockLanguageModelV3({ doGenerate: textResponse(ro({ intent: "small_talk" })) });
    const out = await readTurn(emptyState(), turn("lead", "👍"), "g", model);
    expect(out.intent).toBe("small_talk");
    expect(out.stance).not.toBe("opt_out");
    expect(out.explicitOptOut).toBe(false);
  });

  it("preClassify opt-out regexes force explicitOptOut=true regardless of the model (deterministic floor)", async () => {
    const model = new MockLanguageModelV3({ doGenerate: textResponse(ro({ stance: "positive", intent: "answers_question" })) });
    const out = await readTurn(emptyState(), turn("lead", "Please unsubscribe me, stop messaging me"), "g", model);
    expect(out.explicitOptOut).toBe(true);
    expect(out.stance).toBe("opt_out");
    expect(out.intent).toBe("opts_out");
    expect(applyReadout(emptyState(), turn("lead", "x"), out).stage).toBe("declined");
  });

  it("readout is assignable to ReadoutLike and the schema accepts the base", () => {
    const like: ReadoutLike = ro();
    expect(like.stance).toBe("neutral");
    expect(readoutSchema.safeParse(base).success).toBe(true);
  });
});

describe("applyReadout", () => {
  it("a seller turn records hookUsed, questionAsked, claims, links; bumps agentTurns only for role=agent", () => {
    const r = ro({
      hookUsed: { kind: "observation", text: "hiring SDRs" }, questionAsked: "How do you qualify today?",
      claims: ["we cut research time"], linksShared: ["website"], ask: "soft", labeled: true,
    });
    const s = applyReadout(emptyState(), turn("agent", "msg", "a1", "2026-10-28T10:00:00+02:00"), r);
    expect(s.counters.agentTurns).toBe(1);
    expect(s.counters.agentTurnsSinceLastLead).toBe(1);
    expect(s.memory.hooksUsed).toEqual([{ kind: "observation", text: "hiring SDRs", messageRef: "a1" }]);
    expect(s.memory.questionsAsked).toEqual([{ text: "How do you qualify today?", answered: false, messageRef: "a1" }]);
    expect(s.counters.questionsBudgetUsed).toBe(1);
    expect(s.memory.claimsMade).toEqual(["we cut research time"]);
    expect(s.memory.linksShared.website).toBe(1);
    expect(s.counters.asksMade).toBe(1);
    expect(s.counters.labelsUsed).toBe(1);
    expect(s.lastAgentMessageAt).toBe("2026-10-28T08:00:00.000Z");
    expect(s.stage).toBe("asked");
  });

  it("a lead turn with answeredQuestionRef marks that question answered and zeroes agentTurnsSinceLastLead", () => {
    let s = applyReadout(emptyState(), turn("agent", "q", "a1"), ro({ questionAsked: "Q1?" }));
    s = applyReadout(s, turn("agent", "q2", "a2"), ro({ questionAsked: "Q2?" }));
    expect(s.counters.agentTurnsSinceLastLead).toBe(2);
    const after = applyReadout(s, turn("lead", "answer", "l1", "2026-10-28T11:00:00Z"), ro({ intent: "answers_question", answeredQuestionRef: "a1" }));
    expect(after.memory.questionsAsked.map((q) => q.answered)).toEqual([true, false]);
    expect(after.counters.questionsBudgetUsed).toBe(2);
    expect(after.counters.agentTurnsSinceLastLead).toBe(0);
    expect(after.counters.leadTurns).toBe(1);
    expect(after.lastLeadMessageAt).toBe("2026-10-28T11:00:00.000Z");
  });

  it("explicitOptOut flips stage to declined", () => {
    const s = applyReadout(emptyState(), turn("lead", "stop"), ro({ explicitOptOut: true, stance: "opt_out", intent: "opts_out" }));
    expect(s.memory.explicitOptOut).toBe(true);
    expect(s.stage).toBe("declined");
  });

  it("a confident decline sets memory.declined; a weak one does not; booked sets booked", () => {
    expect(applyReadout(emptyState(), turn("lead", "no"), ro({ stance: "negative", confidence: 0.9, intent: "declines" })).memory.declined).toBe(true);
    expect(applyReadout(emptyState(), turn("lead", "no"), ro({ stance: "negative", confidence: 0.5, intent: "declines" })).memory.declined).toBe(false);
    const b = applyReadout(emptyState(), turn("lead", "Tue 3pm works"), ro({ booked: true }));
    expect(b.memory.booked).toBe(true);
    expect(b.stage).toBe("booked");
  });

  it("personDelta averages traits weighted by confidence and never exceeds 6 notes", () => {
    let s = emptyState();
    s.person.directness = { value: 0.2, confidence: 0.5 };
    s = applyReadout(s, turn("lead", "x"), ro({ personDelta: { ...base.personDelta, directness: { value: 0.8, confidence: 0.5 }, warmth: { value: 0.6, confidence: 0.4 }, notes: ["a", "b", "c"] } }));
    expect(s.person.directness!.value).toBeCloseTo(0.5);
    expect(s.person.directness!.confidence).toBeCloseTo(0.75);
    expect(s.person.warmth).toEqual({ value: 0.6, confidence: 0.4 });
    s = applyReadout(s, turn("lead", "y"), ro({ personDelta: { ...base.personDelta, notes: ["c", "d", "e"] } }));
    s = applyReadout(s, turn("lead", "z"), ro({ personDelta: { ...base.personDelta, notes: ["f", "g", "h"] } }));
    expect(s.person.notes.length).toBe(6);
    expect(s.person.notes).toEqual(["c", "d", "e", "f", "g", "h"]);
  });

  it("a human (native) turn counts as seller side but not an agent turn", () => {
    expect(isSellerTurn(turn("human", "hi"))).toBe(true);
    expect(isSellerTurn(turn("lead", "hi"))).toBe(false);
    const s = applyReadout(emptyState(), turn("human", "hi"), ro());
    expect(s.counters.agentTurns).toBe(0);
    expect(s.counters.agentTurnsSinceLastLead).toBe(1);
    expect(s.lastAgentMessageAt).not.toBeNull();
  });

  it("role updates are confidence-aware: weaker never replaces stronger, stronger does", () => {
    const delta = (role: Readout["personDelta"]["role"], c: number) => ro({ personDelta: { ...base.personDelta, role, roleConfidence: c } });
    let s = applyReadout(emptyState(), turn("lead", "x"), delta("seller_to_us", 0.9));
    s = applyReadout(s, turn("lead", "y"), delta("buyer", 0.1));
    expect(s.person.role).toBe("seller_to_us");
    expect(s.person.roleConfidence).toBe(0.9);
    s = applyReadout(s, turn("lead", "z"), delta("buyer", 0.95));
    expect(s.person.role).toBe("buyer");
    expect(s.person.roleConfidence).toBe(0.95);
  });

  it("sells_to_us sets seller_to_us at >= 0.7 and a later weaker delta cannot clobber it", () => {
    let s = applyReadout(emptyState(), turn("lead", "we do lead gen"), ro({ intent: "sells_to_us" }));
    expect(s.person.role).toBe("seller_to_us");
    expect(s.person.roleConfidence).toBe(0.7);
    s = applyReadout(s, turn("lead", "ok"), ro({ personDelta: { ...base.personDelta, role: "buyer", roleConfidence: 0.3 } }));
    expect(s.person.role).toBe("seller_to_us");
    expect(s.person.roleConfidence).toBe(0.7);
  });

  it("does not mutate its input and never sets handedOff/closed", () => {
    const before = emptyState();
    const snap = JSON.stringify(before);
    const s = applyReadout(before, turn("lead", "x"), ro({ newProblems: ["slow ramp"], newObjection: { kind: "not_now", text: "busy" } }));
    expect(JSON.stringify(before)).toBe(snap);
    expect(s.memory.handedOff).toBe(false);
    expect(s.memory.closed).toBe(false);
    expect(s.qualification.painIdentified).toBe(true);
    expect(s.memory.objections[0]).toEqual({ kind: "not_now", text: "busy", handled: false });
  });

  it("three consecutive agent turns count two follow-ups", () => {
    let s = emptyState();
    for (const r of ["a1", "a2", "a3"]) s = applyReadout(s, turn("agent", "m", r), ro());
    expect(s.counters.followupsSinceLastReply).toBe(2);
  });

  it("a lead turn in between resets follow-ups to 0", () => {
    let s = emptyState();
    s = applyReadout(s, turn("agent", "m", "a1"), ro());
    s = applyReadout(s, turn("agent", "m", "a2"), ro());
    expect(s.counters.followupsSinceLastReply).toBe(1);
    s = applyReadout(s, turn("lead", "hi", "l1"), ro());
    expect(s.counters.followupsSinceLastReply).toBe(0);
    s = applyReadout(s, turn("agent", "m", "a3"), ro());
    expect(s.counters.followupsSinceLastReply).toBe(0);
  });
});
