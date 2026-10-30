import { describe, expect, it } from "vitest";
import { MockLanguageModelV3 } from "ai/test";
import { decideMove, POLICY_SYSTEM, shortlistMoves, type PolicyInput, type Shortlist } from "./policy";
import { emptyState } from "./state";
import type { Move } from "./moves";

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
const mockOf = (json: unknown, sink: (p: string) => void = () => {}) => new MockLanguageModelV3({ doGenerate: capturing(json, sink) });

const style = { lengthBand: "short", question: true, link: "none", mirror: false } as const;
const cand = (move: string, over: Record<string, unknown> = {}) => ({ move, style, rationale: "stage engaged, they asked a question", ...over });

const input = (over: Partial<PolicyInput> = {}): PolicyInput => ({
  state: { ...emptyState(), stage: "engaged" },
  trigger: "reply",
  incoming: "We already use Outreach for this",
  legal: ["answer", "poke", "ask_discovery", "wait"],
  vetoes: [{ move: "propose_times", rule: "no yes yet", source: "spec §6.1" }],
  priors: [{ move: "answer", rate: 0.31, n: 12, level: "move_phase" }],
  links: { booking: true, website: true, content: true },
  cta: "a 15-min intro",
  ...over,
});

describe("shortlistMoves", () => {
  it("the prompt carries the legal menu with definitions, vetoes, priors, links, cta, incoming and the method guide", async () => {
    let seen = "";
    await shortlistMoves(input(), mockOf({ candidates: [cand("answer")] }, (p) => (seen = p)));
    expect(seen).toContain("answer — Answer their question in one plain sentence");
    expect(seen).toContain("propose_times: no yes yet (spec §6.1)");
    expect(seen).toContain("answer: 0.31 (12, move_phase)");
    expect(seen).toContain("We already use Outreach for this");
    expect(seen).toContain("a 15-min intro");
    expect(seen).toContain("LINKS AVAILABLE: booking, website, content");
    expect(POLICY_SYSTEM.text).toContain("Never name a sales methodology");
    expect(POLICY_SYSTEM.text).toContain("One easy question per message");
  });

  it("keeps ranked candidates in the legal set", async () => {
    const out = await shortlistMoves(input(), mockOf({ candidates: [cand("poke"), cand("answer")] }));
    expect(out.candidates.map((c) => c.move)).toEqual(["poke", "answer"]);
  });

  it("drops a candidate outside the legal set; empty falls back to wait", async () => {
    const out = await shortlistMoves(input(), mockOf({ candidates: [cand("propose_times")] }));
    // schema rejects it or it is filtered: either way the result is the wait fallback
    expect(out.candidates).toEqual([
      { move: "wait", style: { lengthBand: "short", question: false, link: "none", mirror: false }, rationale: "no legal move fits; waiting" },
    ]);
    expect(out.degraded).toBe("no_legal_candidates");
  });

  it("keeps the legal candidate when another is illegal, with no degraded flag", async () => {
    const out = await shortlistMoves(input(), mockOf({ candidates: [cand("propose_times"), cand("answer")] }));
    expect(out.candidates.map((c) => c.move)).toEqual(["answer"]);
    expect(out.degraded).toBeUndefined();
  });

  it("flags degraded no_object when the model output cannot be parsed", async () => {
    const out = await shortlistMoves(input(), mockOf({ nope: true }));
    expect(out.degraded).toBe("no_object");
    expect(out.candidates[0]?.move).toBe("wait");
  });

  it("falls back to the first legal move when wait is illegal, and to an empty list when nothing is legal", async () => {
    const a = await shortlistMoves(input({ legal: ["answer", "poke"] }), mockOf({ candidates: [cand("reframe")] }));
    expect(a.candidates).toEqual([
      { move: "answer", style: { lengthBand: "short", question: false, link: "none", mirror: false }, rationale: "fallback: first legal move" },
    ]);
    expect(a.degraded).toBe("no_legal_candidates");
    const b = await shortlistMoves(input({ legal: [] }), mockOf({ candidates: [cand("wait")] }));
    expect(b.candidates).toEqual([]);
  });

  it("drops a candidate with an empty rationale", async () => {
    const out = await shortlistMoves(input(), mockOf({ candidates: [cand("answer", { rationale: "  " }), cand("poke")] }));
    expect(out.candidates.map((c) => c.move)).toEqual(["poke"]);
  });

  it("forces mirror false when mirroring is not allowed, keeps it when allowed", async () => {
    const m = { ...style, mirror: true };
    const off = await shortlistMoves(input(), mockOf({ candidates: [cand("answer", { style: m })] }));
    expect(off.candidates[0]?.style.mirror).toBe(false);
    const state = { ...emptyState(), stage: "engaged" as const, lastLeadMessageAt: "2026-01-01T00:00:00Z" };
    const on = await shortlistMoves(input({ state }), mockOf({ candidates: [cand("answer", { style: m })] }));
    expect(on.candidates[0]?.style.mirror).toBe(true);
  });

  it("forces question false for non-asking moves", async () => {
    const out = await shortlistMoves(input(), mockOf({ candidates: [cand("wait", { style: { ...style, question: true } })] }));
    expect(out.candidates[0]?.style.question).toBe(false);
    const asks = await shortlistMoves(input(), mockOf({ candidates: [cand("ask_discovery")] }));
    expect(asks.candidates[0]?.style.question).toBe(true);
  });

  it("forces link to none by flag, by move, and by prior shares", async () => {
    const withLink = (move: string, link: string) => cand(move, { style: { ...style, link } });
    const noFlags = input({ links: { booking: false, website: false, content: false } });
    const a = await shortlistMoves(noFlags, mockOf({ candidates: [withLink("answer", "website")] }));
    expect(a.candidates[0]?.style.link).toBe("none");
    const b = await shortlistMoves(input(), mockOf({ candidates: [withLink("ask_discovery", "website")] }));
    expect(b.candidates[0]?.style.link).toBe("none");
    const c = await shortlistMoves(input(), mockOf({ candidates: [withLink("answer", "website")] }));
    expect(c.candidates[0]?.style.link).toBe("website");
    const state = emptyState();
    state.memory.linksShared.website = 1;
    const d = await shortlistMoves(input({ state }), mockOf({ candidates: [withLink("answer", "website")] }));
    expect(d.candidates[0]?.style.link).toBe("none");
    const e = await shortlistMoves(input({ legal: ["offer_value", "wait"] }), mockOf({ candidates: [withLink("offer_value", "content")] }));
    expect(e.candidates[0]?.style.link).toBe("content");
    const f = await shortlistMoves(input({ legal: ["offer_value", "wait"] }), mockOf({ candidates: [withLink("offer_value", "booking")] }));
    expect(f.candidates[0]?.style.link).toBe("none");
  });
});

describe("decideMove", () => {
  const sl = (moves: Move[]): Shortlist => ({ candidates: moves.map((m) => ({ move: m, style: { ...style }, rationale: "r" })) });
  const seeded = (seed: number) => {
    let s = seed;
    return () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
  };
  const post = new Map<Move, { alpha: number; beta: number }>();

  it("never explores away from a top-ranked propose_times: propensity 1", () => {
    const d = decideMove(sl(["propose_times", "answer"]), post, seeded(1));
    expect(d.move).toBe("propose_times");
    expect(d.propensity).toBe(1);
    expect(d.shortlist).toHaveLength(2);
  });

  it("explores among safe candidates only and records the shortlist", () => {
    const list = sl(["answer", "poke", "ask_discovery"]);
    const picks = new Set<Move>();
    for (let i = 1; i < 40; i++) {
      const d = decideMove(list, post, seeded(i));
      picks.add(d.move);
      expect(d.move).not.toBe("poke");
      expect(d.propensity).toBeGreaterThan(0);
      expect(d.propensity).toBeLessThanOrEqual(1);
      expect(d.shortlist).toEqual(list.candidates);
    }
    expect(picks.size).toBeGreaterThan(1);
  });

  it("throws on an empty shortlist", () => {
    expect(() => decideMove({ candidates: [] }, post, seeded(1))).toThrow("empty shortlist");
  });
});
