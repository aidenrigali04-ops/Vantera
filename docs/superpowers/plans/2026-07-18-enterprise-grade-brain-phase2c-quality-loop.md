# Enterprise-Grade Brain — Phase 2C (Copy Quality Loop) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]` checkboxes.

**Goal:** Move production copy from "decent" (uncalibrated judge avg 3.31/5) toward great, via the owner-selected sequence: **calibrate the judge → best-of-N generation selection → structured prompt-improvement pass → decide.**

**Architecture:** Promote the LLM judge from the eval-only `packages/evals` into a first-class copy-quality brain in `packages/agent-brains` so BOTH the eval harness and the production copy-draft pipeline consume one judge (single-AI-entry preserved: agent-brains already routes models via `@vantera/ai`). Best-of-N wraps the existing `draftLinkedInFn`/`draftFollowupFn` call sites (`copy-draft.ts:122`, the responder path), generating N candidates, judge-ranking, and sending the winner through the UNCHANGED humanizer/fix gate. Everything the judge governs stays **advisory / flagged-off until κ ≥ 0.7** — the calibration gate is the trust boundary.

**Tech Stack:** TS strict, Vitest 4, Vercel AI SDK v6 (`generateObject` from `ai`, models via `@vantera/ai`), judge model `claude-opus-4-8`. First live evals baseline: deterministic 1.000, classifier floors 1.000, pairwise 0.653 non-inferior, judge 3.31/5.

**Spec:** `docs/superpowers/specs/2026-07-16-enterprise-grade-brain-optimization-design.md` (WS-2 extension). Phase 2B shipped `1bc71eb`.

## Global Constraints
- Branch `phase-egb-2c-quality-loop` off origin/main (`1bc71eb`). Full gate green before merge. Ship `git push origin <branch>:main`. Web deploys via Git integration on push-to-main — do NOT `vercel deploy --prod` CLI; `.vercelignore` must not list `.git`; expect the domain pin (promote after).
- TDD; single-AI-entry (`@vantera/ai` only, never `@ai-sdk/*`); brains pure (`purity.test.ts`); drizzle only in `pg-store.ts`; thin triggers; no new `schedules.task()`; colocated tests; no `any`/`@ts-ignore`.
- **The judge is a QUALITY signal, never the ground truth.** Live outcomes (acceptance→reply→booking) remain the adjudicator; the judge accelerates selection/exploration. No task may make a copy decision on judge score ALONE that bypasses the humanizer gate or the outcome-based bandit. Anti-Goodhart is a review-blocking invariant.
- **Calibration labels are human-authored — never synthesize them.** Task 1 produces the labeling PACKET (drafts + judge scores + blank human column); the human column is filled by the owner. A committed `human-labels.json` with machine-filled `humanOverall` is a review-blocking defect.
- **Production copy-prompt changes are owner-approved.** Task 4 surfaces prompt winners as PROPOSALS in a report; it does NOT edit `LINKEDIN_SYSTEM`/`RESPOND_SYSTEM` in the same PR.
- Commits end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: Calibration harness + labeling packet (the unblocker)

**Files:** Create `packages/evals/src/calibration-prep.ts` (+ test), add `evals:calibration-prep` + `evals:calibration-score` scripts to `packages/evals/package.json`, add a `Calibration prep` job to `.github/workflows/evals.yml` (workflow_dispatch only, uploads the packet as an artifact). Modify `packages/evals/src/judge/kappa.ts` only if `runCalibration` needs a file-loading entry.

**Interfaces (produces):**
```ts
/** Generate N real drafts across the corpus, score each with the judge, write a labeling packet. */
export async function buildCalibrationPacket(n?: number, model?: LanguageModel): Promise<CalibrationPacketEntry[]>;
export type CalibrationPacketEntry = { draftId: string; brain: "linkedin"|"respond"; draftText: string; grounding: string; judgeOverall: number; humanOverall: null };
/** Read a human-filled packet, compute κ vs judgeOverall, print CalibrationReport. */
export async function scoreCalibration(path: string): Promise<CalibrationReport>;
```

- [ ] **Step 1 (TDD):** `calibration-prep.test.ts` — `buildCalibrationPacket(6, mockModel)` (mock returns canned drafts + judge verdicts) writes 6 entries, each with `humanOverall: null`, a real `judgeOverall` 1-5, and `draftText` from the actual brain output. Assert NO entry has a non-null humanOverall (the machine must never fill it). `scoreCalibration` on a hand-filled fixture (known judge+human vectors) → the exact κ from `cohensKappa` + `trusted` at the 0.7 boundary.
- [ ] **Step 2:** Implement. `buildCalibrationPacket`: sample ~100 cases (loop the copy corpora; for coverage, also draft a few fresh from lightly-varied inputs), call `draftLinkedIn`/`draftConversationMessage` (real model in CI), then `judgeCopy` each, emit the packet JSON to `fixtures/judge-calibration/packet.json`. `scoreCalibration`: load a filled packet, extract (judgeOverall, humanOverall) pairs skipping any still-null, feed to `runCalibration`/`cohensKappa`.
- [ ] **Step 3:** `evals.yml` `calibration-prep` job (workflow_dispatch, API-key-gated): runs `evals:calibration-prep`, `actions/upload-artifact` the packet. Document in `docs/evals.md`: owner runs the workflow, downloads `packet.json`, fills each `humanOverall` (1-5, or a good/bad binary → 5/1), commits to `human-labels.json` (ANONYMIZED per the existing human-labels integrity test), runs `evals:calibration-score` → κ. **On κ ≥ 0.7: set the `EVALS_JUDGE_GATING=1` repo variable + replace the provisional `JUDGE_OVERALL_GATE_FLOOR=3.5` with a calibration-derived value (e.g. the human-score median).**
- [ ] **Step 4:** `pnpm --filter @vantera/evals test` green; YAML validates. Commit `feat(evals): calibration packet builder + score command — unblocks the owner labeling session (WS-2.3)`.

---

### Task 2: Promote the judge to a production copy-quality brain

The judge must run in the jobs pipeline for best-of-N, but it currently lives in eval-only `packages/evals`. Move the judge (prompt + `judgeCopy` + `JudgeVerdict` + `JUDGE_MODEL_ID`) into `packages/agent-brains/src/copy/judge.ts`; re-export from the agent-brains barrel; make `packages/evals/src/judge/judge.ts` re-export from agent-brains (zero behavior change to evals). Pairwise stays in evals (eval-only concern) but imports the brain judge.

**Files:** Create `packages/agent-brains/src/copy/judge.ts` (+ test) — move `judgeCopy`, `JudgeVerdict`, `JUDGE_MODEL_ID`, the `evals/judge` registered prompt (rename registry name to `copy/judge` for the brain home; update the evals calibration/ci references). Modify `packages/agent-brains/src/index.ts` (export). Modify `packages/evals/src/judge/judge.ts` → thin re-export. Modify `packages/evals/src/judge/pairwise.ts` + `ci.ts` + calibration imports to source the judge from `@vantera/agent-brains`.

**Interfaces:** unchanged public surface — `judgeCopy(draft, context, model?)`, `JudgeVerdict`, `JUDGE_MODEL_ID` now exported from `@vantera/agent-brains`. Registry name `copy/judge`.

- [ ] TDD: agent-brains `judge.test.ts` (mock model → verdict shape/bounds; prompt registered as `copy/judge`; JUDGE_MODEL_ID==="claude-opus-4-8"); `purity.test.ts` + `prompt-callsite.test.ts` + `single-entry.test.ts` stay green (judge uses generateObject from "ai" + getModel — same pattern as every brain). evals suites stay green (re-export is behavior-preserving; update the `listPrompts` name assertion to `copy/judge`). Commit `refactor(brain): promote the copy judge to a first-class agent-brains brain (shared by evals + production)`.

---

### Task 3: Best-of-N generation selection (the immediate quality lift)

**Files:** Create `packages/agent-brains/src/copy/best-of-n.ts` (+ test) — a pure selector. Modify `packages/jobs/src/pipeline/copy-draft.ts` (wrap the `draftLinkedInFn` call ~122) + the responder draft path + `types.ts` (deps + config). Config via an app-setting `best_of_n` (default 1 = today's behavior; enable to 5 post-calibration).

**Interfaces (produces):**
```ts
/** Generate n candidates via draftFn, judge-rank, return the highest-overall (ties → first). n<=1 short-circuits to a single draft (no judge call). */
export async function bestOfN<T extends { text: string }>(
  n: number, draftFn: () => Promise<T>, toText: (d: T) => string,
  context: { grounding: string; cta?: string }, judge?: JudgeFn, rand?: () => number
): Promise<{ chosen: T; candidates: T[]; scores: number[] }>;
```
Locked rules: `n<=1` → exactly one draft, ZERO judge calls (byte-identical to today — the feature is OFF by default). `n>1` → n parallel drafts, judge each, pick max overall. The winner then flows through the UNCHANGED humanizer/`fixLinkedInFn` gate (a judge-preferred draft that's lint-dirty still gets fixed/reviewed — the humanizer stays the hard floor; the judge only ranks among candidates). Budget: n is per-account config, capped (e.g. ≤5) in code. The recipe stamp records `exemplars`/knobs as today plus `bestOfN: n` for attribution.

- [ ] TDD: `best-of-n.test.ts` — n=1 calls draftFn once, judge zero times, returns it. n=3 with a mock judge scoring candidates [2,4,3] → returns the index-1 draft; ties → first; deterministic under injected rand. copy-draft.test.ts: with `best_of_n=1` the pipeline is byte-identical (existing tests unchanged); with `best_of_n=3` + mock draft/judge, the highest-scored candidate is what gets stamped + linted. Suppression/rules-gate/humanizer invariants all still hold (a suppressed lead is still never drafted; the winner still passes the humanizer or routes to review). Commit `feat(copy): best-of-N judge-ranked draft selection — off by default, budget-capped (quality lever 2)`.

---

### Task 4: Prompt-improvement rig + one offline pass (proposals only)

**Files:** Create `packages/evals/src/prompt-ab.ts` (+ test) + `evals:prompt-ab` script. Create `docs/prompt-experiments/2026-07-18-copy-v1.md` (the pass's findings). Does NOT edit `LINKEDIN_SYSTEM`/`RESPOND_SYSTEM`.

**Interfaces (produces):**
```ts
/** Draft the corpus under a CANDIDATE system prompt, pairwise vs the current-prompt baseline drafts. */
export async function promptAB(candidateSystem: string, brain: "linkedin"|"respond", model?: LanguageModel): Promise<PairwiseReport>;
```
- [ ] TDD: `prompt-ab.test.ts` — mock model returns different drafts per system prompt; `promptAB` runs the existing position-swapped pairwise; win-rate arithmetic asserted. Then (offline, owner-run with the key, NOT in CI unit tests): author 2-3 candidate LINKEDIN_SYSTEM/RESPOND_SYSTEM variants (sharper hook / harder them-focus / tighter anti-slop), run `promptAB` each vs baseline over the corpus, record win-rates in the findings doc. Surface any variant with a clear pairwise win as a PROPOSAL (diff + numbers) for owner review — do not merge. Commit `feat(evals): prompt A/B rig + offline copy-prompt experiment (winners = owner proposals)`.

---

### Task 5: Wire config + docs + the decide framework

**Files:** `docs/evals.md` (+ the quality-loop section), the `best_of_n` app-setting documented, `apps/web` optimize/settings surface if a toggle is warranted (else app-setting only). Help-content per knowledge-sync (rule 09) if best-of-N becomes user-visible.
- [ ] Document: the sequence + trust boundary (nothing judge-driven gates/ships until κ≥0.7); how to enable best-of-N (`best_of_n` setting) and its cost (n× generation + n judge calls per send); the decide framework — after calibration, compare the three levers' measured lift and pick the next (more knobs / richer grounding / the conversation-to-booking funnel, which the audit flagged as the real realized-value gap: 10 interested → 0 meetings). Commit `docs: phase 2C quality-loop wiring + post-calibration decide framework`.

---

### Final verification / GATE
- [ ] Full gate green; single-entry/purity/callsite/schedule-quota guardrails green; best-of-N OFF-by-default proven byte-identical.
- [ ] PR body: the owner critical path — run `Calibration prep` workflow → label the packet (~1hr, anonymized) → `evals:calibration-score` → κ≥0.7 → set `EVALS_JUDGE_GATING=1` + calibrated floor → enable `best_of_n=5` → review prompt proposals. THEN the WS-3.2 autonomous-adoption flip. Note the anti-Goodhart invariant and that realized value ultimately gates on the funnel (Phase 3 meetings loop), not the opener judge score.
