import { describe, expect, it } from "vitest";
import { MockLanguageModelV3 } from "ai/test";
import { listPrompts } from "@vantera/ai";
import { pairwiseCompare, runPairwise, PAIRWISE_NONINFERIORITY, PAIRWISE_PROMPT } from "./pairwise";

function textResponse(json: unknown) {
  return {
    finishReason: { unified: "stop" as const, raw: "stop" },
    usage: {
      inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
      outputTokens: { total: 1, text: 1, reasoning: 0 },
    },
    content: [{ type: "text" as const, text: JSON.stringify(json) }],
    warnings: [],
  };
}

/**
 * pairwise.ts's head-to-head prompt always renders "Draft A (first):" then the first draft's
 * text, then "Draft B (second):" then the second draft's text (see `judgeHeadToHead`). Splitting
 * the serialized prompt on the "Draft B (second):" marker tells us whether `marker` (a string we
 * embedded in one specific draft's text) landed in the FIRST or SECOND slot for this particular
 * call — which flips between `pairwiseCompare`'s two swapped rounds. This is what lets a mock
 * "judge" track an actual draft's identity across the position swap instead of just echoing
 * whichever slot came first.
 */
function slotOf(promptStr: string, marker: string): "first" | "second" {
  const splitIdx = promptStr.indexOf("Draft B (second):");
  const beforeSecondSlot = promptStr.slice(0, splitIdx);
  return beforeSecondSlot.includes(marker) ? "first" : "second";
}

// A real, committed golden-set case (Task 3 fixtures) — reused as the frozen baseline across
// every test below. Its frozenDraft/grounding content don't matter to these tests (the mocks key
// off marker strings embedded in the CANDIDATE text, never the real fixture prose), only that a
// real caseId with a real frozenDraft exists for runPairwise to resolve.
const REAL_CASE_ID = "li-accounting-partner-reconciliation";

describe("PAIRWISE_PROMPT", () => {
  it("registers the head-to-head prompt under evals/pairwise so generations are attributable", () => {
    expect(PAIRWISE_PROMPT.name).toBe("evals/pairwise");
    expect(PAIRWISE_PROMPT.text.length).toBeGreaterThan(0);

    const registered = listPrompts().find((p) => p.name === "evals/pairwise");
    expect(registered).toBeDefined();
    expect(registered!.hash).toBe(PAIRWISE_PROMPT.hash);
  });
});

describe("pairwiseCompare (mock judge)", () => {
  it("agrees on the same actual draft across both swapped orderings -> that draft wins (not whichever happened to go first)", async () => {
    // This mock is content-aware, not position-aware: whichever slot the marker lands in, it picks
    // that slot. Since the marker travels with draft `a` through the swap, a correct (unbiased)
    // judge call returns "a" both times.
    const model = new MockLanguageModelV3({
      doGenerate: async (opts) => {
        const promptStr = JSON.stringify(opts.prompt);
        return textResponse({ winner: slotOf(promptStr, "STRONGER_DRAFT_MARKER"), rationale: "mocked" });
      },
    });

    const a = { text: "STRONGER_DRAFT_MARKER: specific, grounded, natural." };
    const b = { text: "generic filler with no real specifics." };

    const result = await pairwiseCompare(a, b, { grounding: "some grounding" }, model);
    expect(result).toBe("a");
  });

  it("agreement also works the other direction — the same mock crowns `b` when the marker is on b", async () => {
    const model = new MockLanguageModelV3({
      doGenerate: async (opts) => {
        const promptStr = JSON.stringify(opts.prompt);
        return textResponse({ winner: slotOf(promptStr, "STRONGER_DRAFT_MARKER"), rationale: "mocked" });
      },
    });

    const a = { text: "generic filler with no real specifics." };
    const b = { text: "STRONGER_DRAFT_MARKER: specific, grounded, natural." };

    const result = await pairwiseCompare(a, b, { grounding: "some grounding" }, model);
    expect(result).toBe("b");
  });

  it("a position-biased judge (always picks 'first' regardless of content) resolves to a TIE, never a spurious winner — proves the swap cancels position bias", async () => {
    const model = new MockLanguageModelV3({
      doGenerate: async () => textResponse({ winner: "first", rationale: "whichever is first wins, always" }),
    });

    const result = await pairwiseCompare(
      { text: "draft one" },
      { text: "draft two" },
      { grounding: "some grounding" },
      model
    );
    // Round 1 (a=first,b=second) raw "first" -> maps to a. Round 2 (b=first,a=second) raw "first"
    // -> maps to b. The two rounds disagree (a vs b), so pairwiseCompare must report "tie".
    expect(result).toBe("tie");
  });

  it("a judge that always picks 'second' regardless of content also resolves to a tie (bias in either direction cancels the same way)", async () => {
    const model = new MockLanguageModelV3({
      doGenerate: async () => textResponse({ winner: "second", rationale: "whichever is second wins, always" }),
    });

    const result = await pairwiseCompare(
      { text: "draft one" },
      { text: "draft two" },
      { grounding: "some grounding" },
      model
    );
    expect(result).toBe("tie");
  });
});

describe("runPairwise (mock judge) — win-rate aggregation", () => {
  /**
   * Builds `count` synthetic candidates against the SAME real corpus case (`REAL_CASE_ID`),
   * each carrying a unique marker so the mock judge can track it through pairwiseCompare's swap
   * (see `slotOf`). `script[i]` decides how candidate `i` resolves:
   *   - "candidate": the mock always picks whichever slot has the marker -> candidate wins.
   *   - "baseline":  the mock always picks whichever slot does NOT have the marker -> baseline wins.
   *   - "biased":    the mock ignores content and always answers "first" -> the swap disagrees -> tie.
   */
  function buildScriptedCandidates(script: ("candidate" | "baseline" | "biased")[]) {
    // Zero-padded to a fixed width so e.g. "CAND_MARKER_01" is never a PREFIX of "CAND_MARKER_010"
    // — same substring-collision hazard `kappa.test.ts`'s `buildConfusionFixture` calls out
    // ("draft-1" is a substring of "draft-10".."draft-19"). All markers same length -> a substring
    // match only ever means an exact match.
    const width = String(script.length - 1).length;
    const marker = (i: number) => `CAND_MARKER_${String(i).padStart(width, "0")}`;
    const candidates = script.map((_, i) => ({ caseId: REAL_CASE_ID, text: `${marker(i)} candidate draft body` }));
    const model = new MockLanguageModelV3({
      doGenerate: async (opts) => {
        const promptStr = JSON.stringify(opts.prompt);
        const idx = script.findIndex((_, i) => promptStr.includes(marker(i)));
        if (idx === -1) throw new Error("mock could not match a candidate marker to this call's prompt");
        const outcome = script[idx]!;
        if (outcome === "biased") {
          return textResponse({ winner: "first", rationale: "mocked position bias" });
        }
        const markerSlot = slotOf(promptStr, marker(idx));
        const winnerSlot = outcome === "candidate" ? markerSlot : markerSlot === "first" ? "second" : "first";
        return textResponse({ winner: winnerSlot, rationale: "mocked" });
      },
    });
    return { candidates, model };
  }

  it("aggregates fixed judge outcomes into exact win/loss/tie counts (6 candidate wins, 2 baseline wins, 2 ties over 10) -> winRate = (6 + 0.5*2)/10 = 0.7", async () => {
    const script: ("candidate" | "baseline" | "biased")[] = [
      "candidate",
      "candidate",
      "candidate",
      "candidate",
      "candidate",
      "candidate",
      "baseline",
      "baseline",
      "biased",
      "biased",
    ];
    const { candidates, model } = buildScriptedCandidates(script);

    const report = await runPairwise(candidates, model);

    expect(report.candidateWins).toBe(6);
    expect(report.baselineWins).toBe(2);
    expect(report.ties).toBe(2);
    expect(report.winRate).toBe((6 + 0.5 * 2) / 10);
    expect(report.winRate).toBeCloseTo(0.7, 10);
    expect(report.nonInferior).toBe(true);
  });

  it("nonInferior is TRUE exactly at the PAIRWISE_NONINFERIORITY boundary (winRate === PAIRWISE_NONINFERIORITY, not just >)", async () => {
    // 12 candidate wins, 0 ties, 13 baseline wins over 25 -> winRate = 12/25 = 0.48 exactly.
    expect(PAIRWISE_NONINFERIORITY).toBe(0.48);
    const script: ("candidate" | "baseline" | "biased")[] = [
      ...Array(12).fill("candidate"),
      ...Array(13).fill("baseline"),
    ];
    const { candidates, model } = buildScriptedCandidates(script);

    const report = await runPairwise(candidates, model);

    expect(report.candidateWins).toBe(12);
    expect(report.baselineWins).toBe(13);
    expect(report.winRate).toBe(PAIRWISE_NONINFERIORITY);
    expect(report.nonInferior).toBe(true);
  });

  it("nonInferior is FALSE just below the PAIRWISE_NONINFERIORITY boundary (one fewer candidate win than the exact-boundary case)", async () => {
    // 11 candidate wins, 0 ties, 14 baseline wins over 25 -> winRate = 11/25 = 0.44 < 0.48.
    const script: ("candidate" | "baseline" | "biased")[] = [
      ...Array(11).fill("candidate"),
      ...Array(14).fill("baseline"),
    ];
    const { candidates, model } = buildScriptedCandidates(script);

    const report = await runPairwise(candidates, model);

    expect(report.winRate).toBeLessThan(PAIRWISE_NONINFERIORITY);
    expect(report.nonInferior).toBe(false);
  });

  it("throws when a candidate's caseId has no match in either golden-set corpus", async () => {
    const model = new MockLanguageModelV3({
      doGenerate: async () => textResponse({ winner: "first", rationale: "unreachable" }),
    });

    await expect(runPairwise([{ caseId: "not-a-real-case-id", text: "draft" }], model)).rejects.toThrow(
      /not-a-real-case-id/
    );
  });
});
