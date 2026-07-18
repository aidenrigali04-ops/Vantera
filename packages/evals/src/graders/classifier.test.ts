import { describe, expect, it } from "vitest";
import { MockLanguageModelV3 } from "ai/test";
import { recall, precision } from "./classifier";
import {
  runReplyFloors,
  runIntentFloors,
  loadReplyLabels,
  loadIntentLabels,
  REPLY_INTERESTED_RECALL_FLOOR,
  INTENT_RECALL_FLOOR,
  INTENT_PRECISION_FLOOR,
} from "../run-classifier";

function textResponse(json: unknown) {
  return {
    finishReason: { unified: "stop" as const, raw: "stop" },
    usage: { inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 1, text: 1, reasoning: 0 } },
    content: [{ type: "text" as const, text: JSON.stringify(json) }],
    warnings: [],
  };
}

describe("recall (pure)", () => {
  it("computes true-positive / actual-positive over parallel arrays", () => {
    expect(recall(["interested", "other", "interested"], ["interested", "interested", "interested"], "interested")).toBeCloseTo(
      2 / 3
    );
  });

  it("is 1 when every prediction for the positive class is correct", () => {
    expect(recall(["a", "b"], ["a", "b"], "a")).toBe(1);
  });

  it("only counts the given positive class, ignoring correct calls on other classes", () => {
    // labels: two "x" (one predicted right, one wrong) plus one "y" predicted right — the "y"
    // agreement is irrelevant to recall-of-"x".
    expect(recall(["x", "z", "y"], ["x", "x", "y"], "x")).toBe(0.5);
  });

  it("returns 1 when the positive class never appears in labels (vacuously satisfied — nothing to recall)", () => {
    expect(recall(["a", "b"], ["b", "b"], "a")).toBe(1);
  });

  it("throws on mismatched array lengths", () => {
    expect(() => recall(["a"], ["a", "b"], "a")).toThrow();
  });
});

describe("precision (pure)", () => {
  it("computes true-positive / predicted-positive over parallel boolean arrays", () => {
    // preds true at indices 0,1,3; labels there are true,false,true -> TP=2, predicted=3
    expect(precision([true, true, false, true], [true, false, false, true])).toBeCloseTo(2 / 3);
  });

  it("is 1 when every positive prediction has a true label", () => {
    expect(precision([true, false, true], [true, false, true])).toBe(1);
  });

  it("returns 1 when there are no positive predictions (vacuously precise — no false positives raised)", () => {
    expect(precision([false, false], [true, false])).toBe(1);
  });

  it("throws on mismatched array lengths", () => {
    expect(() => precision([true], [true, false])).toThrow();
  });
});

/**
 * `runReplyFloors`/`runIntentFloors` mock-model tests below. The metric MATH is the tested unit
 * here — these prove the floor runners wire `classifyReply`/`classifyIntent` output into
 * `recall`/`precision` correctly and compare against the right constant floor. A real-model run
 * (no mock) is the API-gated integration path and is deliberately NOT exercised in this suite.
 */

describe("runReplyFloors (mock model)", () => {
  it("scores a perfect classifier at recall 1.0 and passes the 0.90 floor, exercising the preClassify short-circuit too", async () => {
    const labels = loadReplyLabels();
    const model = new MockLanguageModelV3({
      doGenerate: async (opts) => {
        const prompt = JSON.stringify(opts.prompt);
        const label = labels.find((l) => prompt.includes(l.body));
        if (!label) throw new Error("mock could not match a labeled reply body to this call's prompt");
        return textResponse({ classification: label.expected, rationale: "mocked" });
      },
    });

    const reports = await runReplyFloors(model);
    const report = reports.find((r) => r.metric === "reply.interested_recall");
    expect(report).toBeDefined();
    expect(report!.value).toBe(1);
    expect(report!.floor).toBe(REPLY_INTERESTED_RECALL_FLOOR);
    expect(report!.pass).toBe(true);
    expect(report!.n).toBe(labels.length);

    // unsubscribe/out_of_office labels are pre-classified deterministically and never reach the
    // model — proves the short-circuit is exercised, not bypassed by this mock.
    const preClassifiedCount = labels.filter((l) => l.expected === "unsubscribe" || l.expected === "out_of_office").length;
    expect(preClassifiedCount).toBeGreaterThan(0);
    expect(model.doGenerateCalls.length).toBe(labels.length - preClassifiedCount);
  });

  it("drops interested-recall below the 0.90 floor on a hand-verified missed interested reply", async () => {
    const labels = loadReplyLabels();
    const interestedLabels = labels.filter((l) => l.expected === "interested");
    expect(interestedLabels.length).toBeGreaterThan(0);
    const missBody = interestedLabels[0]!.body;

    const model = new MockLanguageModelV3({
      doGenerate: async (opts) => {
        const prompt = JSON.stringify(opts.prompt);
        const label = labels.find((l) => prompt.includes(l.body));
        if (!label) throw new Error("mock could not match a labeled reply body to this call's prompt");
        const classification = label.body === missBody ? "neutral" : label.expected;
        return textResponse({ classification, rationale: "mocked" });
      },
    });

    const reports = await runReplyFloors(model);
    const report = reports.find((r) => r.metric === "reply.interested_recall")!;
    const expectedRecall = (interestedLabels.length - 1) / interestedLabels.length;

    expect(report.value).toBeCloseTo(expectedRecall);
    expect(report.pass).toBe(expectedRecall >= REPLY_INTERESTED_RECALL_FLOOR);
  });
});

describe("runIntentFloors (mock model)", () => {
  it("scores a perfect classifier at recall/precision 1.0 and passes both floors, batching one call per shared context", async () => {
    const labels = loadIntentLabels();
    const model = new MockLanguageModelV3({
      doGenerate: async (opts) => {
        const prompt = JSON.stringify(opts.prompt);
        const matched = labels.filter((l) => prompt.includes(l.obs.ref));
        const verdicts = matched.map((l) => ({
          ref: l.obs.ref,
          reasoning: "mocked",
          is_intent: l.expectedIsIntent,
          level: l.expectedIsIntent ? "high" : "none",
          why_now: "mocked",
        }));
        return textResponse({ verdicts });
      },
    });

    const reports = await runIntentFloors(model);
    const recallReport = reports.find((r) => r.metric === "intent.recall")!;
    const precisionReport = reports.find((r) => r.metric === "intent.precision")!;

    expect(recallReport.value).toBe(1);
    expect(recallReport.floor).toBe(INTENT_RECALL_FLOOR);
    expect(recallReport.pass).toBe(true);
    expect(precisionReport.value).toBe(1);
    expect(precisionReport.floor).toBe(INTENT_PRECISION_FLOOR);
    expect(precisionReport.pass).toBe(true);
    expect(recallReport.n).toBe(labels.length);

    // the fixture spans two distinct seller contexts -> grouping by ctx means classifyIntent is
    // called once per context, not once per label.
    const distinctCtxCount = new Set(labels.map((l) => JSON.stringify(l.ctx))).size;
    expect(distinctCtxCount).toBeGreaterThan(1);
    expect(model.doGenerateCalls.length).toBe(distinctCtxCount);
  });

  it("drops intent-recall below the 0.85 floor on a hand-verified missed true-intent observation", async () => {
    const labels = loadIntentLabels();
    const positiveLabels = labels.filter((l) => l.expectedIsIntent);
    expect(positiveLabels.length).toBeGreaterThan(0);
    const missRef = positiveLabels[0]!.obs.ref;

    const model = new MockLanguageModelV3({
      doGenerate: async (opts) => {
        const prompt = JSON.stringify(opts.prompt);
        const matched = labels.filter((l) => prompt.includes(l.obs.ref));
        const verdicts = matched.map((l) => {
          const wantIntent = l.obs.ref === missRef ? false : l.expectedIsIntent;
          return {
            ref: l.obs.ref,
            reasoning: "mocked",
            is_intent: wantIntent,
            level: wantIntent ? "high" : "none",
            why_now: "mocked",
          };
        });
        return textResponse({ verdicts });
      },
    });

    const reports = await runIntentFloors(model);
    const recallReport = reports.find((r) => r.metric === "intent.recall")!;
    const expectedRecall = (positiveLabels.length - 1) / positiveLabels.length;

    expect(recallReport.value).toBeCloseTo(expectedRecall);
    expect(recallReport.pass).toBe(expectedRecall >= INTENT_RECALL_FLOOR);
  });

  it("drops intent-precision below the 0.80 floor on hand-verified false positives", async () => {
    const labels = loadIntentLabels();
    const negativeLabels = labels.filter((l) => !l.expectedIsIntent);
    expect(negativeLabels.length).toBeGreaterThanOrEqual(2);
    const falsePositiveRefs = new Set(negativeLabels.slice(0, 2).map((l) => l.obs.ref));

    const model = new MockLanguageModelV3({
      doGenerate: async (opts) => {
        const prompt = JSON.stringify(opts.prompt);
        const matched = labels.filter((l) => prompt.includes(l.obs.ref));
        const verdicts = matched.map((l) => {
          const wantIntent = falsePositiveRefs.has(l.obs.ref) ? true : l.expectedIsIntent;
          return {
            ref: l.obs.ref,
            reasoning: "mocked",
            is_intent: wantIntent,
            level: wantIntent ? "high" : "none",
            why_now: "mocked",
          };
        });
        return textResponse({ verdicts });
      },
    });

    const reports = await runIntentFloors(model);
    const precisionReport = reports.find((r) => r.metric === "intent.precision")!;
    const positiveCount = labels.filter((l) => l.expectedIsIntent).length;
    const expectedPrecision = positiveCount / (positiveCount + falsePositiveRefs.size);

    expect(precisionReport.value).toBeCloseTo(expectedPrecision);
    expect(precisionReport.pass).toBe(expectedPrecision >= INTENT_PRECISION_FLOOR);
  });
});
