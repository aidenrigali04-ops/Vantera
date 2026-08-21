import { describe, expect, it } from "vitest";
import { MockLanguageModelV3 } from "ai/test";
import { listPrompts } from "@vantera/ai";
import { judgeCopy, JUDGE_MODEL_ID, JUDGE_PROMPT } from "./judge";

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

describe("JUDGE_MODEL_ID / JUDGE_PROMPT (promoted from evals/judge — Phase 2C, Task 2)", () => {
  it("is claude-opus-4-8 — deliberately stronger + different from the Sonnet-4.6 draft model, to avoid self-preference bias", () => {
    expect(JUDGE_MODEL_ID).toBe("claude-opus-4-8");
  });

  it("registers the judge system prompt under copy/judge (its agent-brains home) so generations are attributable", () => {
    expect(JUDGE_PROMPT.name).toBe("copy/judge");
    expect(JUDGE_PROMPT.text.length).toBeGreaterThan(0);

    const registered = listPrompts().find((p) => p.name === "copy/judge");
    expect(registered).toBeDefined();
    expect(registered!.hash).toBe(JUDGE_PROMPT.hash);
  });

  it("no longer registers anything under the old evals/judge name", () => {
    expect(listPrompts().find((p) => p.name === "evals/judge")).toBeUndefined();
  });
});

describe("judgeCopy (mock model)", () => {
  it("parses a canned verdict JSON into a JudgeVerdict with the right shape and 1-5 int bounds", async () => {
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
    for (const dim of ["specificity", "themFocus", "posture", "naturalness", "overall"] as const) {
      expect(Number.isInteger(verdict[dim])).toBe(true);
      expect(verdict[dim]).toBeGreaterThanOrEqual(1);
      expect(verdict[dim]).toBeLessThanOrEqual(5);
    }
    expect(typeof verdict.rationale).toBe("string");
  });

  it("passes the draft text, grounding, and cta into the model prompt (grounded scoring, not vibes)", async () => {
    let capturedPrompt = "";
    const model = new MockLanguageModelV3({
      doGenerate: async (opts) => {
        capturedPrompt = JSON.stringify(opts.prompt);
        return textResponse({
          specificity: 3,
          themFocus: 3,
          posture: 3,
          naturalness: 3,
          overall: 3,
          rationale: "ok",
        });
      },
    });

    await judgeCopy(
      { text: "UNIQUE_DRAFT_TEXT_MARKER" },
      { grounding: "UNIQUE_GROUNDING_MARKER", cta: "UNIQUE_CTA_MARKER" },
      model
    );

    expect(capturedPrompt).toContain("UNIQUE_DRAFT_TEXT_MARKER");
    expect(capturedPrompt).toContain("UNIQUE_GROUNDING_MARKER");
    expect(capturedPrompt).toContain("UNIQUE_CTA_MARKER");
  });

  it("omits the cta line entirely when no cta is given (no 'undefined' leaking into the prompt)", async () => {
    let capturedPrompt = "";
    const model = new MockLanguageModelV3({
      doGenerate: async (opts) => {
        capturedPrompt = JSON.stringify(opts.prompt);
        return textResponse({
          specificity: 3,
          themFocus: 3,
          posture: 3,
          naturalness: 3,
          overall: 3,
          rationale: "ok",
        });
      },
    });

    await judgeCopy({ text: "draft text" }, { grounding: "grounding text" }, model);

    expect(capturedPrompt).not.toContain("undefined");
  });

  it("rejects a verdict with an out-of-range dimension (schema enforces the 1-5 bound, not just the type)", async () => {
    const model = new MockLanguageModelV3({
      doGenerate: async () =>
        textResponse({
          specificity: 7, // out of the 1-5 bound
          themFocus: 3,
          posture: 3,
          naturalness: 3,
          overall: 3,
          rationale: "ok",
        }),
    });

    await expect(
      judgeCopy({ text: "draft text" }, { grounding: "grounding text" }, model)
    ).rejects.toThrow();
  });

  it("rejects a verdict with a non-integer dimension (schema enforces int, not just numeric range)", async () => {
    const model = new MockLanguageModelV3({
      doGenerate: async () =>
        textResponse({
          specificity: 3.5, // not an integer
          themFocus: 3,
          posture: 3,
          naturalness: 3,
          overall: 3,
          rationale: "ok",
        }),
    });

    await expect(
      judgeCopy({ text: "draft text" }, { grounding: "grounding text" }, model)
    ).rejects.toThrow();
  });
});
