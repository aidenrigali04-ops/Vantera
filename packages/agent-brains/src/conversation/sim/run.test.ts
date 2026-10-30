import { describe, expect, it } from "vitest";
import { MockLanguageModelV3 } from "ai/test";
import { mulberry32 } from "../../optimize/sim/harness";
import { PERSONAS, personaById } from "./personas";
import { hasHardCta, simulateProspectReply } from "./prospect";
import { judgePenalty, runSimThread, safeRunSimThread, simToPriors, suppressionOf, type SimDeps, type SimThread } from "./run";
import type { Readout } from "../read";
import type { Move } from "../moves";

const textResponse = (json: unknown) => ({
  finishReason: { unified: "stop" as const, raw: "stop" },
  usage: { inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 1, text: 1, reasoning: 0 } },
  content: [{ type: "text" as const, text: JSON.stringify(json) }],
  warnings: [],
});
const prospectModel = (text: string, sink?: () => void) =>
  new MockLanguageModelV3({
    doGenerate: async () => {
      sink?.();
      return textResponse({ text, disposition: "unchanged" });
    },
  });

const base = {
  stance: "neutral", confidence: 0.9, intent: "other", explicitOptOut: false, identitySuspicion: false, booked: false,
  answeredQuestionRef: null, newProblems: [], newPriorities: [], newObjection: null,
  personDelta: { directness: null, formality: null, warmth: null, skepticism: null, verbosity: null, seniority: null, role: null, roleConfidence: null, language: null, emoji: null, notes: [] },
  hookUsed: null, questionAsked: null, claims: [], linksShared: [], ask: "none", labeled: false,
} as Readout;

const style = { lengthBand: "short", question: false, link: "none", mirror: false } as const;

function deps(over: Partial<SimDeps> & { moves?: Move[]; model?: MockLanguageModelV3; calls?: { compose: Move[] } } = {}) {
  const queue = [...(over.moves ?? ["observe"])];
  const calls = over.calls ?? { compose: [] };
  const d: SimDeps = {
    shortlist: async (input) => {
      const want = queue.shift() ?? "observe";
      const move = (input.legal.includes(want) ? want : input.legal[0]) as Move;
      return { candidates: [{ move, style, rationale: "stage test" }] };
    },
    compose: async (input) => {
      calls.compose.push(input.decision.move);
      return { message: `Message for ${input.decision.move}.` };
    },
    read: async (_s, turn) => (/stop messaging/i.test(turn.text) ? { ...base, stance: "opt_out", intent: "opts_out", explicitOptOut: true } : { ...base, stance: "skeptical" }),
    rng: mulberry32(1),
    model: over.model ?? prospectModel("no thanks"),
    ...over,
  };
  return { d, calls };
}

describe("PERSONAS", () => {
  it("has the seven locked personas with calibrated probabilities", () => {
    expect(PERSONAS.map((p) => p.id)).toEqual(["busy_exec", "skeptic", "info_requester", "reverse_seller", "warm_operator", "rude", "ghost"]);
    expect(personaById("busy_exec").disposition.replyProbByPhase).toEqual({ pre_reply: 0.12, engaged: 0.5, exploring: 0.6, asked: 0.4, after_no: 0.05 });
    expect(Object.values(personaById("ghost").disposition.replyProbByPhase).every((x) => x === 0)).toBe(true);
  });
});

describe("simulateProspectReply", () => {
  const view = { turns: [], phase: "pre_reply" as const };
  it("silence never reaches the model", async () => {
    let called = 0;
    const r = await simulateProspectReply(personaById("ghost"), view, "hi", () => 0, prospectModel("x", () => called++));
    expect(r).toEqual({ text: null, disposition: "unchanged" });
    expect(called).toBe(0);
  });
  it("a hard CTA multiplies the reply probability by (1 - penalty)", async () => {
    const p = personaById("skeptic"); // pre_reply 0.18; with penalty 0.117
    const soft = "Curious how you handle outbound today?";
    const hard = "Can we book a meeting on my calendar for a demo?";
    expect(hasHardCta(hard)).toBe(true);
    expect(hasHardCta(soft)).toBe(false);
    const roll = () => 0.15; // between 0.117 and 0.18
    expect((await simulateProspectReply(p, view, soft, roll, prospectModel("ok"))).text).toBe("ok");
    expect((await simulateProspectReply(p, view, hard, roll, prospectModel("ok"))).text).toBeNull();
  });
  it("the system prompt says tone alone never changes disposition", async () => {
    let seen = "";
    const m = new MockLanguageModelV3({
      doGenerate: async (o: { prompt: unknown }) => {
        seen = JSON.stringify(o.prompt);
        return textResponse({ text: "ok", disposition: "unchanged" });
      },
    });
    await simulateProspectReply(personaById("skeptic"), view, "hi", () => 0, m);
    expect(seen).toMatch(/ONLY on substance/);
    expect(seen).toMatch(/at most 2 sentences/);
  });
});

describe("runSimThread", () => {
  it("ghost: no replies, two silences stop the thread", async () => {
    const { d } = deps({ moves: ["observe", "observe", "observe"] });
    const t = await runSimThread(personaById("ghost"), d);
    expect(t.readouts).toHaveLength(0);
    expect(t.turns.every((x) => x.role === "agent")).toBe(true);
    expect(t.end).toBe("silence");
    expect(t.decisions).toHaveLength(2);
    expect(t.outcome.replied).toBe(false);
  });

  it("rude: one curt reply, then opt-out, then graceful_exit and stop", async () => {
    const { d, calls } = deps({ moves: ["observe", "ask_discovery", "graceful_exit"], model: prospectModel("Not interested.") });
    d.rng = () => 1e-7; // always passes the reply roll
    const t = await runSimThread(personaById("rude"), d);
    const leadTexts = t.turns.filter((x) => x.role === "lead").map((x) => x.text);
    expect(leadTexts).toEqual(["Not interested.", "Please stop messaging me."]);
    expect(t.decisions[t.decisions.length - 1]!.move).toBe("graceful_exit");
    expect(t.end).toBe("graceful_exit");
    expect(t.outcome.optOut).toBe(true);
    expect(calls.compose[calls.compose.length - 1]).toBe("graceful_exit");
    expect(t.turns[t.turns.length - 1]!.role).toBe("agent");
  });

  it("never calls compose for wait", async () => {
    const calls = { compose: [] as Move[] };
    const { d } = deps({ moves: ["wait", "wait"], calls });
    const t = await runSimThread(personaById("ghost"), d);
    expect(t.decisions.map((x) => x.move)).toEqual(["wait", "wait"]);
    expect(t.end).toBe("silence");
    expect(calls.compose).toEqual([]);
  });

  it("records decisions with phase, archetype and propensity", async () => {
    const { d } = deps({ moves: ["observe"] });
    const t = await runSimThread(personaById("ghost"), d, 1);
    expect(t.decisions[0]).toMatchObject({ move: "observe", phase: "pre_reply", propensity: expect.any(Number) });
    expect(t.decisions[0]!.archetype).toMatch(/^(ic_mgr|dir_vp|cxo_founder):/);
    expect(t.end).toBe("max_turns");
  });
});

describe("simToPriors", () => {
  it("emits only source sim, with judge penalties applied", async () => {
    const { d } = deps({ moves: ["observe", "observe"] });
    const clean = await runSimThread(personaById("ghost"), d);
    const judged: SimThread = { ...clean, judge: { pressure: 5, manipulation: 5, repetition: 1, identityDetection: true } };
    const table = simToPriors([clean, judged]);
    expect(table.length).toBeGreaterThan(0);
    expect(table.every((c) => c.source === "sim")).toBe(true);
    expect(judgePenalty(judged.judge)).toBe(-12);
    expect(judgePenalty({ pressure: 3, manipulation: 3, repetition: 5, identityDetection: false })).toBe(0);
    const cell = table.find((c) => c.level === "move" && c.move === "observe")!;
    expect(cell.rewardSum).toBeLessThan(0);
  });
});

describe("review round 1", () => {
  it("a thread whose compose throws is reported, not propagated", async () => {
    const { d } = deps({ compose: async () => { throw new Error("boom"); } });
    d.seed = 3;
    const r = await safeRunSimThread(personaById("ghost"), d);
    expect(r).toEqual({ ok: false, persona: "ghost", seed: 3, error: "boom" });
  });

  it("spreads the judge penalty so the thread total is exact", async () => {
    const { d } = deps({ moves: ["observe"] });
    const t = await runSimThread(personaById("ghost"), d, 1);
    const dec = { ...t.decisions[0]!, move: "observe" as const, propensity: 1 };
    const thread: SimThread = {
      ...t,
      decisions: [dec, dec, dec],
      judge: { pressure: 4, manipulation: 1, repetition: 1, identityDetection: false },
    };
    const cell = simToPriors([thread]).find((c) => c.level === "move" && c.move === "observe")!;
    expect(cell.rewardSum).toBeCloseTo(-3, 10);
  });

  it("a rude thread that opted out records suppression written", async () => {
    const { d } = deps({ moves: ["observe", "ask_discovery", "graceful_exit"], model: prospectModel("Not interested.") });
    d.rng = () => 1e-7;
    const t = await runSimThread(personaById("rude"), d);
    expect(suppressionOf(t.finalState)).toBe("written");
    const ghost = await runSimThread(personaById("ghost"), deps().d);
    expect(suppressionOf(ghost.finalState)).toBe("none");
  });

  it("call / hop on / quick chat are hard CTAs", () => {
    for (const m of ["Can we have a call?", "Want to hop on Tuesday?", "Up for a quick chat?"]) expect(hasHardCta(m)).toBe(true);
  });
});
