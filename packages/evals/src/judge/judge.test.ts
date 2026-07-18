import { describe, expect, it } from "vitest";
import { MockLanguageModelV3 } from "ai/test";
import { judgeCopy, JUDGE_MODEL_ID } from "./judge";

/**
 * Re-export smoke test (Phase 2C, Task 2). The substantive judge tests — verdict shape/bounds,
 * schema validation, prompt registration under `copy/judge` — now live in
 * `@vantera/agent-brains`'s `copy/judge.test.ts`, next to the implementation. This file only
 * proves the re-export in `./judge.ts` is wired correctly and behaves identically from an evals
 * call site's point of view.
 */

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

describe("./judge re-export (thin wrapper around @vantera/agent-brains)", () => {
  it("re-exports JUDGE_MODEL_ID unchanged", () => {
    expect(JUDGE_MODEL_ID).toBe("claude-opus-4-8");
  });

  it("re-exports a working judgeCopy that returns a JudgeVerdict", async () => {
    const canned = {
      specificity: 4,
      themFocus: 5,
      posture: 3,
      naturalness: 4,
      overall: 4,
      rationale: "Specific and peer-toned; one generic line keeps it from a 5.",
    };
    const model = new MockLanguageModelV3({
      doGenerate: async () => textResponse(canned),
    });

    const verdict = await judgeCopy(
      { text: "Saw you're scaling the eng team past 40 — curious how you're thinking about on-call load as headcount grows." },
      { grounding: "Prospect is VP Eng at a 40-person startup, recently posted about hiring 3 SREs." },
      model
    );

    expect(verdict).toEqual(canned);
  });
});
