import { describe, it, expect } from "vitest";
import {
  decide,
  orchestrate,
  shouldSkipLiveEvals,
  JUDGE_OVERALL_GATE_FLOOR,
  DETERMINISTIC_LIVE_FLOOR,
  type CiDeps,
  type CiInputs,
} from "./ci";
import { PAIRWISE_NONINFERIORITY } from "./judge/pairwise";
import type { FloorReport } from "./graders/classifier";

/**
 * Tests the ORCHESTRATION logic (Phase 2B, Task 8) in complete isolation from any model call or
 * `process.exit`: `decide()` is exercised directly with hand-built result shapes, and
 * `orchestrate()` is exercised with injected fake run-fns (no real `runDeterministic`,
 * `runPairwise`, etc.) — this is the "fake run-fns" test the task brief calls out. Neither test
 * ever imports a provider or touches `ANTHROPIC_API_KEY`; `packages/ai/src/single-entry.test.ts`
 * remains the guardrail that `ci.ts` itself imports no `@ai-sdk/*` directly (it only goes through
 * `@vantera/ai`/`@vantera/agent-brains`, same as every other run-* module in this package).
 */

const PASSING_PAIRWISE = { candidateWins: 10, baselineWins: 5, ties: 2, winRate: 0.7, nonInferior: true };
const FAILING_PAIRWISE = { candidateWins: 2, baselineWins: 15, ties: 0, winRate: 2 / 17, nonInferior: false };

const PASSING_FLOOR: FloorReport = { metric: "reply.interested_recall", value: 0.95, floor: 0.9, pass: true, n: 20 };
const FAILING_FLOOR: FloorReport = { metric: "intent.recall", value: 0.7, floor: 0.85, pass: false, n: 20 };

function baseInputs(overrides: Partial<CiInputs> = {}): CiInputs {
  return {
    deterministic: { passRate: 1 },
    floors: [PASSING_FLOOR],
    pairwise: PASSING_PAIRWISE,
    judge: { averageOverall: 4.2, n: 34 },
    judgeGating: false,
    ...overrides,
  };
}

describe("decide — hard gates", () => {
  it("all green → exit 0, no failures", () => {
    const result = decide(baseInputs());
    expect(result.exitCode).toBe(0);
    expect(result.hardFailures).toEqual([]);
    expect(result.advisoryFlags).toEqual([]);
  });

  it("deterministic passRate below the live floor → hard failure, exit 1", () => {
    const result = decide(baseInputs({ deterministic: { passRate: 0.85 } }));
    expect(result.exitCode).toBe(1);
    expect(result.hardFailures).toHaveLength(1);
    expect(result.hardFailures[0]).toMatch(/deterministic copy gate \(HARD\)/);
  });

  it("deterministic passRate = 0.972 (one stochastic review-routed draft in 36) is NOT a hard failure — above the floor", () => {
    const result = decide(baseInputs({ deterministic: { passRate: 0.972 } }));
    expect(result.exitCode).toBe(0);
    expect(result.hardFailures).toEqual([]);
  });

  it("deterministic passRate exactly at DETERMINISTIC_LIVE_FLOOR passes (>= floor, not <)", () => {
    const result = decide(baseInputs({ deterministic: { passRate: DETERMINISTIC_LIVE_FLOOR } }));
    expect(result.exitCode).toBe(0);
    expect(result.hardFailures).toEqual([]);
  });

  it("deterministic hard-failure message surfaces the failing case ids + violation rules when provided", () => {
    const result = decide(
      baseInputs({
        deterministic: {
          passRate: 0.85,
          failures: [
            { caseId: "li-biotech-founder-procurement", rules: ["ungrounded-claim"] },
            { caseId: "re-manufacturing-plant-manager-downtime", rules: ["banned-phrase", "no-links"] },
          ],
        },
      })
    );
    expect(result.exitCode).toBe(1);
    expect(result.hardFailures[0]).toMatch(/li-biotech-founder-procurement/);
    expect(result.hardFailures[0]).toMatch(/ungrounded-claim/);
    expect(result.hardFailures[0]).toMatch(/re-manufacturing-plant-manager-downtime/);
    expect(result.hardFailures[0]).toMatch(/banned-phrase/);
  });

  it("any classifier floor miss → hard failure, exit 1", () => {
    const result = decide(baseInputs({ floors: [PASSING_FLOOR, FAILING_FLOOR] }));
    expect(result.exitCode).toBe(1);
    expect(result.hardFailures).toHaveLength(1);
    expect(result.hardFailures[0]).toMatch(/classifier floor miss \(HARD\): intent\.recall/);
  });

  it("multiple hard misses all surface (deterministic + floor)", () => {
    const result = decide(baseInputs({ deterministic: { passRate: 0.5 }, floors: [FAILING_FLOOR] }));
    expect(result.exitCode).toBe(1);
    expect(result.hardFailures).toHaveLength(2);
  });
});

describe("decide — judge + pairwise are advisory unless EVALS_JUDGE_GATING flips", () => {
  it("pairwise non-inferiority miss + judgeGating=false → advisory only, exit STAYS 0", () => {
    const result = decide(baseInputs({ pairwise: FAILING_PAIRWISE, judgeGating: false }));
    expect(result.exitCode).toBe(0);
    expect(result.hardFailures).toEqual([]);
    expect(result.advisoryFlags).toHaveLength(1);
    expect(result.advisoryFlags[0]).toMatch(new RegExp(`< ${PAIRWISE_NONINFERIORITY}`));
  });

  it("pairwise non-inferiority miss + judgeGating=true → HARD failure, exit 1", () => {
    const result = decide(baseInputs({ pairwise: FAILING_PAIRWISE, judgeGating: true }));
    expect(result.exitCode).toBe(1);
    expect(result.hardFailures).toHaveLength(1);
    expect(result.hardFailures[0]).toMatch(/pairwise non-inferiority miss/);
    expect(result.hardFailures[0]).toMatch(/EVALS_JUDGE_GATING=1/);
  });

  it("judge average-overall below floor + judgeGating=false → advisory only, exit STAYS 0", () => {
    const result = decide(baseInputs({ judge: { averageOverall: 2.1, n: 34 }, judgeGating: false }));
    expect(result.exitCode).toBe(0);
    expect(result.advisoryFlags).toHaveLength(1);
    expect(result.advisoryFlags[0]).toMatch(/judge average-overall miss/);
  });

  it("judge average-overall below floor + judgeGating=true → HARD failure, exit 1", () => {
    const result = decide(baseInputs({ judge: { averageOverall: 2.1, n: 34 }, judgeGating: true }));
    expect(result.exitCode).toBe(1);
    expect(result.hardFailures).toHaveLength(1);
  });

  it("judge.n === 0 (nothing scored) is never a miss, regardless of judgeGating", () => {
    const result = decide(baseInputs({ judge: { averageOverall: 0, n: 0 }, judgeGating: true }));
    expect(result.exitCode).toBe(0);
    expect(result.hardFailures).toEqual([]);
    expect(result.advisoryFlags).toEqual([]);
  });

  it("a judge score exactly at the floor does not miss (>= floor passes)", () => {
    const result = decide(baseInputs({ judge: { averageOverall: JUDGE_OVERALL_GATE_FLOOR, n: 10 } }));
    expect(result.advisoryFlags).toEqual([]);
  });

  it("hard misses stay hard even when a judgeGating advisory ALSO misses in the same run", () => {
    const result = decide(
      baseInputs({
        deterministic: { passRate: DETERMINISTIC_LIVE_FLOOR - 0.1 },
        pairwise: FAILING_PAIRWISE,
        judgeGating: true,
      })
    );
    expect(result.exitCode).toBe(1);
    expect(result.hardFailures).toHaveLength(2);
  });
});

describe("shouldSkipLiveEvals", () => {
  it("true when ANTHROPIC_API_KEY is absent", () => {
    expect(shouldSkipLiveEvals({ ANTHROPIC_API_KEY: undefined })).toBe(true);
  });
  it("false when ANTHROPIC_API_KEY is present", () => {
    expect(shouldSkipLiveEvals({ ANTHROPIC_API_KEY: "sk-ant-test" })).toBe(false);
  });
});

describe("orchestrate — wiring with injected fake run-fns (no real model/network calls)", () => {
  function fakeDeps(overrides: Partial<CiDeps> = {}): CiDeps {
    return {
      runDeterministic: async () => ({ passRate: 1 }),
      runReplyFloors: async () => [PASSING_FLOOR],
      runIntentFloors: async () => [],
      runIntentHardFloors: async () => [],
      runRankFloors: async () => [],
      generateLiveCandidates: async () => [{ caseId: "c1", text: "draft", grounding: "g", cta: "book a call" }],
      runPairwise: async () => PASSING_PAIRWISE,
      scoreJudge: async () => ({ averageOverall: 4.5, n: 1 }),
      ...overrides,
    };
  }

  it("all-green fakes → exit 0", async () => {
    const result = await orchestrate(fakeDeps(), false);
    expect(result.decision.exitCode).toBe(0);
  });

  it("a fake runDeterministic reporting passRate below the live floor fails the orchestration", async () => {
    const result = await orchestrate(
      fakeDeps({ runDeterministic: async () => ({ passRate: 0.8 }) }),
      false
    );
    expect(result.decision.exitCode).toBe(1);
    expect(result.decision.hardFailures[0]).toMatch(/deterministic/);
  });

  it("a fake runDeterministic reporting passRate above the live floor (e.g. 0.972) does NOT fail the orchestration", async () => {
    const result = await orchestrate(
      fakeDeps({ runDeterministic: async () => ({ passRate: 0.972 }) }),
      false
    );
    expect(result.decision.exitCode).toBe(0);
    expect(result.decision.hardFailures).toEqual([]);
  });

  it("threads per-case deterministic failures through to the hard-failure message", async () => {
    const result = await orchestrate(
      fakeDeps({
        runDeterministic: async () => ({
          passRate: 0.85,
          failures: [{ caseId: "li-biotech-founder-procurement", rules: ["ungrounded-claim"] }],
        }),
      }),
      false
    );
    expect(result.decision.exitCode).toBe(1);
    expect(result.decision.hardFailures[0]).toMatch(/li-biotech-founder-procurement/);
    expect(result.decision.hardFailures[0]).toMatch(/ungrounded-claim/);
  });

  it("a fake runPairwise reporting a miss never flips exit code unless judgeGating=1", async () => {
    const notGating = await orchestrate(fakeDeps({ runPairwise: async () => FAILING_PAIRWISE }), false);
    expect(notGating.decision.exitCode).toBe(0);
    expect(notGating.decision.advisoryFlags).toHaveLength(1);

    const gating = await orchestrate(fakeDeps({ runPairwise: async () => FAILING_PAIRWISE }), true);
    expect(gating.decision.exitCode).toBe(1);
  });

  it("passes the SAME candidates generated once into both runPairwise and scoreJudge", async () => {
    const seen: { pairwise?: unknown; judge?: unknown } = {};
    const deps = fakeDeps({
      generateLiveCandidates: async () => [{ caseId: "shared", text: "t", grounding: "g" }],
      runPairwise: async (candidates) => {
        seen.pairwise = candidates;
        return PASSING_PAIRWISE;
      },
      scoreJudge: async (candidates) => {
        seen.judge = candidates;
        return { averageOverall: 5, n: candidates.length };
      },
    });
    await orchestrate(deps, false);
    expect(seen.pairwise).toEqual([{ caseId: "shared", text: "t" }]);
    expect((seen.judge as { caseId: string }[])[0]?.caseId).toBe("shared");
  });
});
