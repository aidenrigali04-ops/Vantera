import { describe, expect, it } from "vitest";
import { MockLanguageModelV3 } from "ai/test";
import { cohensKappa, binOverall, runCalibration, KAPPA_TRUST_THRESHOLD, type HumanLabel } from "./kappa";

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

describe("cohensKappa (pure)", () => {
  it("is 1 on perfect agreement over a non-trivial (mixed-class) vector pair", () => {
    // a === b exactly, and both take on more than one class, so pe < 1 and (po-pe)/(1-pe) = 1.
    expect(cohensKappa([1, 1, 0, 0, 1], [1, 1, 0, 0, 1])).toBe(1);
  });

  it("is 1 on the degenerate case where both raters only ever use one, shared class (0/0 guarded)", () => {
    // po = pe = 1 here (both arrays are the constant 1) — dividing by (1-pe)=0 would be NaN;
    // this is trivial perfect agreement (no variability to disagree on), so kappa is defined as 1.
    expect(cohensKappa([1, 1, 1], [1, 1, 1])).toBe(1);
  });

  it("is ~0 for chance-level agreement (hand-computed: po=0.5, pe=0.5 -> kappa=0)", () => {
    // a: four 1s then four 0s. b: alternating 1/0/1/0/1/0/1/0 (also four 1s, four 0s -> matching
    // marginals, so pe = 0.5*0.5 + 0.5*0.5 = 0.5). Agreement at indices 0,2,5,7 = 4/8 = po = 0.5.
    // kappa = (0.5 - 0.5) / (1 - 0.5) = 0.
    const a = [1, 1, 1, 1, 0, 0, 0, 0];
    const b = [1, 0, 1, 0, 1, 0, 1, 0];
    expect(cohensKappa(a, b)).toBeCloseTo(0, 10);
  });

  it("matches a hand-computed known vector pair exactly", () => {
    // a = [1,1,1,0,0], b = [1,1,0,0,0].
    // Confusion (a,b): (1,1)x2, (1,0)x1, (0,0)x2 -> po = 4/5 = 0.8.
    // p(a=1)=3/5=0.6, p(a=0)=0.4; p(b=1)=2/5=0.4, p(b=0)=0.6.
    // pe = 0.6*0.4 + 0.4*0.6 = 0.48.
    // kappa = (0.8 - 0.48) / (1 - 0.48) = 0.32 / 0.52 = 8/13.
    const a = [1, 1, 1, 0, 0];
    const b = [1, 1, 0, 0, 0];
    expect(cohensKappa(a, b)).toBeCloseTo(8 / 13, 10);
  });

  it("throws on mismatched array lengths", () => {
    expect(() => cohensKappa([1], [1, 0])).toThrow();
  });

  it("throws on empty arrays (no basis to compute agreement)", () => {
    expect(() => cohensKappa([], [])).toThrow();
  });
});

describe("binOverall (binary-binning edge cases)", () => {
  it("bins overall >= 4 to 1 (good) — the exact boundary (4) counts as good", () => {
    expect(binOverall(4)).toBe(1);
    expect(binOverall(5)).toBe(1);
  });

  it("bins overall < 4 to 0 (not good), including the 3/4 boundary", () => {
    expect(binOverall(3)).toBe(0);
    expect(binOverall(1)).toBe(0);
  });
});

/**
 * Builds a HumanLabel set + judge-verdict lookup realizing an exact 2x2 confusion matrix between
 * binned human labels and binned judge labels:
 *   a = TP (human good, judge good)   c = FN (human good, judge bad)
 *   b = FP (human bad,  judge good)   d = TN (human bad,  judge bad)
 * `draftId` is embedded verbatim in `draftText` so the mock model can match a call's prompt back
 * to the intended judge score for that label (same pattern as run-classifier.test.ts's
 * label-lookup-by-substring mocks).
 */
function buildConfusionFixture(config: { a: number; b: number; c: number; d: number }): {
  labels: HumanLabel[];
  judgeOverallByDraftId: Map<string, number>;
} {
  const labels: HumanLabel[] = [];
  const judgeOverallByDraftId = new Map<string, number>();
  let idx = 0;
  const push = (humanOverall: number, judgeOverall: number, count: number) => {
    for (let i = 0; i < count; i++) {
      // Zero-padded so every id is the same length — otherwise "draft-1" is a substring of
      // "draft-10".."draft-19" and the find-by-substring lookup below resolves to the wrong
      // label (bit us during development: every case silently matched a low-index label).
      const draftId = `draft-${String(idx++).padStart(2, "0")}`;
      labels.push({ draftId, draftText: `${draftId} body text`, grounding: `${draftId} grounding`, humanOverall });
      judgeOverallByDraftId.set(draftId, judgeOverall);
    }
  };
  push(5, 5, config.a); // TP: human good, judge good
  push(5, 2, config.c); // FN: human good, judge bad
  push(2, 5, config.b); // FP: human bad, judge good
  push(2, 2, config.d); // TN: human bad, judge bad
  return { labels, judgeOverallByDraftId };
}

function mockJudgeModel(labels: HumanLabel[], judgeOverallByDraftId: Map<string, number>): MockLanguageModelV3 {
  return new MockLanguageModelV3({
    doGenerate: async (opts) => {
      const prompt = JSON.stringify(opts.prompt);
      const label = labels.find((l) => prompt.includes(l.draftId));
      if (!label) throw new Error("mock could not match a draftId to this call's prompt");
      const overall = judgeOverallByDraftId.get(label.draftId)!;
      return textResponse({
        specificity: overall,
        themFocus: overall,
        posture: overall,
        naturalness: overall,
        overall,
        rationale: "mocked",
      });
    },
  });
}

describe("runCalibration (mock judge) — 0.7 trust boundary", () => {
  it("trusted stays TRUE exactly at the 0.7 threshold (trusted uses >=, not >) — hand-computed a=17,b=3,c=3,d=17,n=40 -> kappa=0.7", async () => {
    const { labels, judgeOverallByDraftId } = buildConfusionFixture({ a: 17, b: 3, c: 3, d: 17 });
    const model = mockJudgeModel(labels, judgeOverallByDraftId);

    const report = await runCalibration(labels, model);

    expect(report.n).toBe(40);
    expect(report.kappa).toBeCloseTo(0.7, 10);
    expect(KAPPA_TRUST_THRESHOLD).toBe(0.7);
    expect(report.trusted).toBe(true);
  });

  it("trusted is FALSE just below the 0.7 threshold — hand-computed a=17,b=4,c=3,d=16,n=40 -> kappa=0.65", async () => {
    const { labels, judgeOverallByDraftId } = buildConfusionFixture({ a: 17, b: 4, c: 3, d: 16 });
    const model = mockJudgeModel(labels, judgeOverallByDraftId);

    const report = await runCalibration(labels, model);

    expect(report.n).toBe(40);
    expect(report.kappa).toBeCloseTo(0.65, 10);
    expect(report.trusted).toBe(false);
  });
});
