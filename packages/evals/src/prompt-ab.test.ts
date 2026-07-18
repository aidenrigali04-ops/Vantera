import { describe, expect, it } from "vitest";
import { MockLanguageModelV3 } from "ai/test";
import { loadCopyLinkedinCorpus, loadCopyRespondCorpus } from "./corpus";
import { PAIRWISE_NONINFERIORITY } from "./judge/pairwise";
import { promptAB } from "./prompt-ab";

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

// A unique marker embedded in the candidate system prompt under test. Every DRAFT-generation
// call (linkedin connection_note/followup_message, or respond message) is made with
// `system: candidateSystem`, so this marker's presence in `opts.prompt`'s serialized system
// message is how the mock (and the assertions below) tell a drafting call apart from a
// PAIRWISE JUDGE call (`./judge/pairwise.ts`'s `judgeHeadToHead`, which always uses its own
// fixed `PAIRWISE_PROMPT` as `system` and never sees this marker).
const CANDIDATE_MARKER = "CANDIDATE_SYSTEM_PROMPT_MARKER_9f3a";
const candidateSystem = `${CANDIDATE_MARKER}: write a sharper, more specific opening hook than the baseline.`;

// A marker embedded in the CANDIDATE DRAFT text this rig's mock returns, so the position-swapped
// pairwise judge call (a separate schema/system entirely) can track that specific draft's
// identity through `pairwiseCompare`'s swap — same technique `judge/pairwise.test.ts` uses via
// its `slotOf` helper.
const WINNING_DRAFT_MARKER = "STRONGER_CANDIDATE_DRAFT_MARKER";

function isDraftCall(promptStr: string): boolean {
  return promptStr.includes(CANDIDATE_MARKER);
}

function slotOf(promptStr: string, marker: string): "first" | "second" {
  const splitIdx = promptStr.indexOf("Draft B (second):");
  const beforeSecondSlot = promptStr.slice(0, splitIdx);
  return beforeSecondSlot.includes(marker) ? "first" : "second";
}

describe("promptAB — linkedin brain", () => {
  it("drafts every corpus case under the candidate system prompt, and a judge that correctly prefers the marked candidate draft reports the candidate winning every case", async () => {
    const draftCalls: string[] = [];

    const model = new MockLanguageModelV3({
      doGenerate: async (opts) => {
        const promptStr = JSON.stringify(opts.prompt);
        if (isDraftCall(promptStr)) {
          draftCalls.push(promptStr);
          return textResponse({
            connection_note: `${WINNING_DRAFT_MARKER} connection note, specific and grounded.`,
            followup_message: `${WINNING_DRAFT_MARKER} sharp, curious follow-up question.`,
          });
        }
        // Pairwise judge call: an UNBIASED judge that correctly tracks the marked candidate
        // draft through the position swap (same content-aware pattern as pairwise.test.ts).
        return textResponse({ winner: slotOf(promptStr, WINNING_DRAFT_MARKER), rationale: "mocked" });
      },
    });

    const report = await promptAB(candidateSystem, "linkedin", model);

    const cases = loadCopyLinkedinCorpus();
    expect(draftCalls.length).toBe(cases.length);
    // Every drafting call actually carried the exact candidate system prompt string, not just the
    // marker substring — proves `system: candidateSystem` reaches the model verbatim.
    expect(draftCalls.every((p) => p.includes(candidateSystem))).toBe(true);

    expect(report.candidateWins).toBe(cases.length);
    expect(report.baselineWins).toBe(0);
    expect(report.ties).toBe(0);
    expect(report.winRate).toBe(1);
    expect(report.nonInferior).toBe(true);
  });

  it("a position-biased judge (always 'first', ignoring content) resolves every case to a tie — the rig's candidates still flow through pairwiseCompare's swap defense, not a shortcut path", async () => {
    const model = new MockLanguageModelV3({
      doGenerate: async (opts) => {
        const promptStr = JSON.stringify(opts.prompt);
        if (isDraftCall(promptStr)) {
          return textResponse({
            connection_note: `${WINNING_DRAFT_MARKER} connection note.`,
            followup_message: `${WINNING_DRAFT_MARKER} follow-up.`,
          });
        }
        return textResponse({ winner: "first", rationale: "whichever is first wins, always" });
      },
    });

    const report = await promptAB(candidateSystem, "linkedin", model);

    const cases = loadCopyLinkedinCorpus();
    expect(report.ties).toBe(cases.length);
    expect(report.candidateWins).toBe(0);
    expect(report.baselineWins).toBe(0);
    // Tie-heavy win-rate arithmetic: winRate = (0 + 0.5*n)/n = 0.5, above the non-inferiority bar.
    expect(report.winRate).toBe(0.5);
    expect(report.winRate).toBeGreaterThanOrEqual(PAIRWISE_NONINFERIORITY);
    expect(report.nonInferior).toBe(true);
  });
});

describe("promptAB — respond brain", () => {
  it("drafts every corpus case under the candidate system prompt for the respond brain too, and aggregates a correct win-rate", async () => {
    const draftCalls: string[] = [];

    const model = new MockLanguageModelV3({
      doGenerate: async (opts) => {
        const promptStr = JSON.stringify(opts.prompt);
        if (isDraftCall(promptStr)) {
          draftCalls.push(promptStr);
          return textResponse({ message: `${WINNING_DRAFT_MARKER} sharp, grounded reply.` });
        }
        return textResponse({ winner: slotOf(promptStr, WINNING_DRAFT_MARKER), rationale: "mocked" });
      },
    });

    const report = await promptAB(candidateSystem, "respond", model);

    const cases = loadCopyRespondCorpus();
    expect(draftCalls.length).toBe(cases.length);
    expect(draftCalls.every((p) => p.includes(candidateSystem))).toBe(true);

    expect(report.candidateWins).toBe(cases.length);
    expect(report.winRate).toBe(1);
    expect(report.nonInferior).toBe(true);
  });
});
