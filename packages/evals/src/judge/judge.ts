/**
 * Thin re-export (enterprise-grade-brain Phase 2C, Task 2 — "promote the judge to a production
 * copy-quality brain"). The judge itself (`judgeCopy`, `JudgeVerdict`, `JUDGE_MODEL_ID`, and its
 * registered `copy/judge` system prompt) moved to `@vantera/agent-brains`'s `copy/judge.ts` so
 * BOTH this evals harness AND the production `packages/jobs` copy pipeline (best-of-N, Task 3)
 * consume the exact same judge implementation.
 *
 * This file exists purely so `./judge/pairwise.ts`, `./judge/kappa.ts`, `../ci.ts`, and
 * `../calibration-prep.ts` keep importing from `"./judge"` / `"./judge/judge"` with zero churn —
 * the registered prompt name did change (`evals/judge` -> `copy/judge`, reflecting its new home),
 * but nothing in this package reads the prompt's registry name directly, so that rename is
 * invisible to every consumer here. See `@vantera/agent-brains`'s `copy/judge.test.ts` for the
 * substantive judge tests (verdict shape/bounds, prompt registration); `./judge.test.ts` here is
 * now just a re-export smoke test.
 */
export { judgeCopy, JUDGE_MODEL_ID, type JudgeVerdict } from "@vantera/agent-brains";
