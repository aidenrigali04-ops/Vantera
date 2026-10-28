import { describe, expect, it } from "vitest";
import { EXPLORE_SAFE, legalMoves, mirrorAllowed, pitchPattern, type ReadoutLike } from "./rules";
import { MOVE_DEFINITIONS, MOVES, styleKey } from "./moves";
import { emptyState, type ConversationState } from "./state";

const all = { booking: true, website: true, content: true };

type P = {
  stage?: ConversationState["stage"];
  counters?: Partial<ConversationState["counters"]>;
  memory?: Partial<ConversationState["memory"]>;
  person?: Partial<ConversationState["person"]>;
  lastMove?: string | null;
};
function mk(p: P): ConversationState {
  const s = emptyState();
  return {
    ...s,
    stage: p.stage ?? s.stage,
    person: { ...s.person, ...p.person },
    memory: { ...s.memory, ...p.memory },
    counters: { ...s.counters, ...p.counters },
    lastMove: p.lastMove ? { move: p.lastMove, at: "2026-01-01T00:00:00Z" } : null,
  };
}
const exploring = (p: P = {}) =>
  mk({ stage: "exploring", counters: { agentTurns: 2, leadTurns: 2 }, ...p });
const engaged = (p: P = {}) => mk({ stage: "engaged", counters: { agentTurns: 1, leadTurns: 1 }, ...p });
const neutral = (o: Partial<ReadoutLike> = {}): ReadoutLike => ({
  stance: "neutral",
  confidence: 0.7,
  intent: "small_talk",
  explicitOptOut: false,
  identitySuspicion: false,
  ...o,
});

describe("legalMoves hard rules", () => {
  it("propose_times is vetoed without explicitPositive (R rule 6)", () => {
    const { legal, vetoes } = legalMoves({ state: exploring(), trigger: "reply", readout: neutral(), links: all });
    expect(legal).not.toContain("propose_times");
    expect(vetoes).toContainEqual({ move: "propose_times", rule: "needs-explicit-positive", source: "R rule 6" });
  });
  it("propose_times is legal with explicitPositive", () => {
    const r = legalMoves({ state: exploring({ memory: { explicitPositive: true } }), trigger: "reply", readout: neutral(), links: all });
    expect(r.legal).toContain("propose_times");
  });
  it("ask_discovery is vetoed once the 5-question budget is spent (R rule 24)", () => {
    const r = legalMoves({ state: exploring({ counters: { questionsBudgetUsed: 5 } }), trigger: "reply", readout: neutral(), links: all });
    expect(r.legal).not.toContain("ask_discovery");
    expect(r.vetoes).toContainEqual({ move: "ask_discovery", rule: "question-budget-spent", source: "R rule 24" });
  });
  it("ask_discovery is vetoed right after a question move", () => {
    const r = legalMoves({ state: exploring({ lastMove: "poke" }), trigger: "reply", readout: neutral(), links: all });
    expect(r.vetoes.map((v) => v.rule)).toContain("last-move-was-a-question");
  });
  it("acknowledge is vetoed after one label in the thread (R rule 23)", () => {
    const r = legalMoves({ state: exploring({ counters: { labelsUsed: 1 } }), trigger: "reply", readout: neutral({ stance: "positive" }), links: all });
    expect(r.legal).not.toContain("acknowledge");
    expect(r.vetoes).toContainEqual({ move: "acknowledge", rule: "label-overuse", source: "R rule 23" });
  });
  it("acknowledge needs affect in the lead turn", () => {
    const r = legalMoves({ state: exploring(), trigger: "reply", readout: neutral(), links: all });
    expect(r.vetoes.map((v) => v.rule)).toContain("acknowledge-needs-affect");
    const ok = legalMoves({ state: exploring(), trigger: "reply", readout: neutral({ stance: "positive" }), links: all });
    expect(ok.legal).toContain("acknowledge");
  });
  it("answer needs an open loop or a question", () => {
    const r = legalMoves({ state: exploring(), trigger: "reply", readout: neutral(), links: all });
    expect(r.vetoes.map((v) => v.rule)).toContain("answer-needs-open-loop");
    const ok = legalMoves({ state: exploring(), trigger: "reply", readout: neutral({ intent: "asks_question" }), links: all });
    expect(ok.legal).toContain("answer");
  });
  it("a follow-up with 2 unanswered follow-ups leaves only breakup and wait (R rule 14)", () => {
    const r = legalMoves({ state: mk({ stage: "opened", counters: { agentTurns: 1, followupsSinceLastReply: 2 } }), trigger: "followup", links: all });
    expect([...r.legal].sort()).toEqual(["breakup", "wait"]);
    expect(r.vetoes.some((v) => v.rule === "followups-exhausted" && v.source === "R rule 14")).toBe(true);
  });
  it("breakup is vetoed before two follow-ups", () => {
    const r = legalMoves({ state: engaged(), trigger: "followup", links: all });
    expect(r.vetoes.map((v) => v.rule)).toContain("breakup-needs-followups");
    expect(r.legal).not.toContain("breakup");
  });
  it("on the last allowed touch, breakup is the only proactive move", () => {
    const r = legalMoves({ state: engaged(), trigger: "followup", isLastTouch: true, links: all });
    expect(r.legal).toEqual(["breakup", "wait"]);
    expect(r.vetoes.map((v) => v.rule)).toContain("last-touch-breakup-only");
  });
  it("after a breakup only wait remains", () => {
    const r = legalMoves({ state: engaged({ lastMove: "breakup" }), trigger: "followup", isLastTouch: true, links: all });
    expect(r.legal).toEqual(["wait"]);
  });
  it("a seller_to_us role leaves answer, graceful_exit, hand_to_human", () => {
    const s = engaged({ counters: { agentTurns: 2, leadTurns: 1 }, person: { role: "seller_to_us", roleConfidence: 0.7 }, memory: { openLoops: ["pricing?"] } });
    const r = legalMoves({ state: s, trigger: "reply", readout: neutral({ confidence: 0.7 }), links: all });
    expect([...r.legal].sort()).toEqual(["answer", "graceful_exit", "hand_to_human"]);
    expect(r.vetoes.some((v) => v.rule === "seller-to-us")).toBe(true);
  });
  it("a low-confidence role read does not trigger the role rule", () => {
    const s = engaged({ counters: { agentTurns: 2, leadTurns: 1 }, person: { role: "recruiter", roleConfidence: 0.4 } });
    const r = legalMoves({ state: s, trigger: "reply", readout: neutral({ confidence: 0.9 }), links: all });
    expect(r.vetoes.map((v) => v.rule)).not.toContain("seller-to-us");
  });
  it("a sells_to_us intent counts as a role signal for this turn", () => {
    const s = engaged({ counters: { agentTurns: 2, leadTurns: 1 }, memory: { openLoops: ["x"] } });
    const r = legalMoves({ state: s, trigger: "reply", readout: neutral({ intent: "sells_to_us" }), links: all });
    expect([...r.legal].sort()).toEqual(["answer", "graceful_exit", "hand_to_human"]);
  });
  it("identity suspicion leaves only hand_to_human", () => {
    const r = legalMoves({ state: engaged(), trigger: "reply", readout: neutral({ identitySuspicion: true }), links: all });
    expect(r.legal).toEqual(["hand_to_human"]);
    expect(r.vetoes.map((v) => v.rule)).toContain("identity-suspicion");
  });
  it("skeptical stance narrows to answer, acknowledge, poke, observe, graceful_exit (spec §6.4)", () => {
    const s = exploring({ memory: { openLoops: ["why us?"] }, counters: { agentTurns: 2, leadTurns: 2 }, person: { skepticism: { value: 0.8, confidence: 0.7 } } });
    const r = legalMoves({ state: s, trigger: "reply", readout: neutral({ stance: "skeptical" }), links: all });
    expect([...r.legal].sort()).toEqual(["acknowledge", "answer", "graceful_exit", "observe", "poke", "wait"]);
    expect(r.vetoes.map((v) => v.rule)).toContain("skeptical-narrowing");
  });
  it("a high-confidence decline leaves graceful_exit and hand_to_human", () => {
    const r = legalMoves({ state: engaged(), trigger: "reply", readout: neutral({ stance: "negative", confidence: 0.9, intent: "declines" }), links: all });
    expect([...r.legal].sort()).toEqual(["graceful_exit", "hand_to_human"]);
    expect(r.vetoes.map((v) => v.rule)).toContain("declined");
  });
  it("graceful_exit happens only once, then wait", () => {
    const r = legalMoves({ state: engaged({ lastMove: "graceful_exit", memory: { declined: true } }), trigger: "reply", readout: neutral({ stance: "negative", confidence: 0.9, intent: "declines" }), links: all });
    expect(r.legal).not.toContain("graceful_exit");
    expect(r.vetoes.map((v) => v.rule)).toContain("graceful-exit-once");
    expect(r.legal).toContain("wait");
  });
  it("an explicit opt-out is treated as a decline", () => {
    const r = legalMoves({ state: engaged(), trigger: "reply", readout: neutral({ explicitOptOut: true, stance: "opt_out" }), links: all });
    expect([...r.legal].sort()).toEqual(["graceful_exit", "hand_to_human"]);
  });
  it("a low-confidence decline is not a decline", () => {
    const r = legalMoves({ state: engaged(), trigger: "reply", readout: neutral({ stance: "negative", confidence: 0.5 }), links: all });
    expect(r.vetoes.map((v) => v.rule)).not.toContain("declined");
    expect(r.legal).toContain("hand_to_human");
  });
  it("the same move kind twice in a row is vetoed", () => {
    const r = legalMoves({ state: exploring({ lastMove: "observe" }), trigger: "reply", readout: neutral(), links: all });
    expect(r.legal).not.toContain("observe");
    expect(r.vetoes).toContainEqual({ move: "observe", rule: "same-move-twice", source: "spec §6.2 rule 6" });
  });
  it("reframe is vetoed for ic seniority", () => {
    const r = legalMoves({ state: exploring({ person: { seniority: "ic" } }), trigger: "reply", readout: neutral(), links: all });
    expect(r.legal).not.toContain("reframe");
    expect(r.vetoes.map((v) => v.rule)).toContain("reframe-needs-seniority");
    const ok = legalMoves({ state: exploring({ person: { seniority: "vp" } }), trigger: "reply", readout: neutral(), links: all });
    expect(ok.legal).toContain("reframe");
  });
  it("offer_value needs a content link not yet shared", () => {
    const noLink = legalMoves({ state: exploring(), trigger: "reply", readout: neutral(), links: { ...all, content: false } });
    expect(noLink.vetoes.map((v) => v.rule)).toContain("no-content-to-offer");
    const shared = legalMoves({ state: exploring({ memory: { linksShared: { booking: 0, website: 0, content: 1 } } }), trigger: "reply", readout: neutral(), links: all });
    expect(shared.vetoes.map((v) => v.rule)).toContain("offer-already-shared");
    expect(legalMoves({ state: exploring(), trigger: "reply", readout: neutral(), links: all }).legal).toContain("offer_value");
  });
  it("soft_ask needs exploring and fewer than 2 asks", () => {
    const early = legalMoves({ state: engaged(), trigger: "reply", readout: neutral(), links: all });
    expect(early.vetoes.map((v) => v.rule)).toContain("soft-ask-needs-exploring");
    const spent = legalMoves({ state: exploring({ counters: { asksMade: 2 } }), trigger: "reply", readout: neutral(), links: all });
    expect(spent.legal).not.toContain("soft_ask");
  });
  it("narrow needs an unhandled info request; poke needs skepticism or an existing solution", () => {
    const sk = legalMoves({ state: exploring(), trigger: "reply", readout: neutral({ stance: "skeptical" }), links: all });
    expect(sk.vetoes.map((v) => v.rule)).toContain("skeptical-narrowing");
    const base = legalMoves({ state: exploring(), trigger: "reply", readout: neutral(), links: all });
    expect(base.vetoes.map((v) => v.rule)).toEqual(expect.arrayContaining(["narrow-needs-info-request", "poke-needs-skepticism"]));
    const obj = (kind: "info_request" | "existing_solution") =>
      exploring({ memory: { objections: [{ kind, text: "x", handled: false }] } });
    expect(legalMoves({ state: obj("info_request"), trigger: "reply", readout: neutral(), links: all }).legal).toContain("narrow");
    expect(legalMoves({ state: exploring(), trigger: "reply", readout: neutral({ intent: "requests_info" }), links: all }).legal).toContain("narrow");
    expect(legalMoves({ state: obj("existing_solution"), trigger: "reply", readout: neutral(), links: all }).legal).toContain("poke");
  });
  it("confirm needs an agreement on an asked stage", () => {
    const r = legalMoves({ state: exploring(), trigger: "reply", readout: neutral(), links: all });
    expect(r.vetoes.map((v) => v.rule)).toContain("confirm-needs-agreement");
    const ok = legalMoves({ state: mk({ stage: "asked", memory: { explicitPositive: true }, counters: { agentTurns: 3, leadTurns: 2 } }), trigger: "reply", readout: neutral(), links: all });
    expect(ok.legal).toContain("confirm");
  });
  it("first_message trigger: legal = observe, ask_discovery (and wait); never soft_ask", () => {
    const r = legalMoves({ state: mk({ stage: "connected", memory: { explicitPositive: true }, counters: { connection: { invited: true, connected: true } } as never }), trigger: "first_message", links: all });
    expect(r.legal).toEqual(["observe", "ask_discovery", "wait"]);
    expect(r.legal).not.toContain("soft_ask");
    expect(r.vetoes).toContainEqual({ move: "propose_times", rule: "first-message-menu", source: "spec §6.1" });
  });
  it("wait is vetoed on a reply that asks a question", () => {
    const r = legalMoves({ state: exploring(), trigger: "reply", readout: neutral({ intent: "asks_question" }), links: all });
    expect(r.legal).not.toContain("wait");
    expect(r.vetoes).toContainEqual({ move: "wait", rule: "never-leave-a-question-hanging", source: "spec §6.1" });
  });
  it("wait is legal otherwise", () => {
    expect(legalMoves({ state: exploring(), trigger: "reply", readout: neutral(), links: all }).legal).toContain("wait");
  });
  it("hand_to_human fires on the turn cap", () => {
    const r = legalMoves({ state: exploring({ counters: { agentTurns: 6, leadTurns: 5 } }), trigger: "reply", readout: neutral(), links: all });
    expect(r.legal).toEqual(["wait", "hand_to_human"].sort((a, b) => MOVES.indexOf(a as never) - MOVES.indexOf(b as never)));
    expect(r.vetoes.map((v) => v.rule)).toContain("turn-cap");
  });
  it("a closed or handed-off thread only waits", () => {
    expect(legalMoves({ state: exploring({ memory: { handedOff: true } }), trigger: "reply", readout: neutral(), links: all }).legal).toEqual(["wait"]);
  });
});

describe("rule helpers", () => {
  it("EXPLORE_SAFE excludes propose_times, reframe, poke", () => {
    for (const m of ["propose_times", "reframe", "poke"] as const) expect(EXPLORE_SAFE.has(m)).toBe(false);
    expect(EXPLORE_SAFE.size).toBe(MOVES.length - 3);
  });
  it("mirrorAllowed is true for the first two agent turns after a lead turn and false after", () => {
    const base = { ...emptyState(), lastLeadMessageAt: "2026-01-01T00:00:00Z" };
    const at = (n: number) => ({ ...base, counters: { ...base.counters, agentTurnsSinceLastLead: n } });
    expect(mirrorAllowed(at(0))).toBe(true);
    expect(mirrorAllowed(at(1))).toBe(true);
    expect(mirrorAllowed(at(2))).toBe(false);
    expect(mirrorAllowed(emptyState())).toBe(false);
  });
  it("pitchPattern matches the seller name, platform, AI, all-in-one and ROI percentages, case-insensitively", () => {
    const re = pitchPattern("Acme Labs");
    for (const t of ["we at acme labs", "our PLATFORM", "an AI tool", "an all-in-one suite", "get 300% ROI", "up 40 %"]) expect(re.test(t)).toBe(true);
    for (const t of ["how do you handle hiring", "said hello"]) expect(re.test(t)).toBe(false);
    expect(pitchPattern(null).test("our platform")).toBe(true);
    expect(pitchPattern("a.b").test("axb")).toBe(false);
  });
  it("styleKey and definitions", () => {
    expect(styleKey({ lengthBand: "short", question: true, link: "none", mirror: true })).toBe("short|q|none|m");
    expect(styleKey({ lengthBand: "one_line", question: false, link: "booking", mirror: false })).toBe("one_line|-|booking|-");
    for (const m of MOVES) expect(MOVE_DEFINITIONS[m].length).toBeGreaterThan(10);
  });
});
