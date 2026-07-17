# Enterprise-Grade Brain — Phase 2B (Evals Harness) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the `packages/evals` harness — golden sets, deterministic quality gate, classifier floors, a calibrated LLM judge, and a CI gate that blocks prompt/copy regressions — the WS-2 half of GATE 1.

**Architecture:** New leaf workspace package `packages/evals` that imports brains through `@vantera/agent-brains` and models through `@vantera/ai` (single-AI-entry guardrail preserved — never a provider import). Three grader layers: (1) deterministic lints reused verbatim from `humanizer.ts`, hard-gating; (2) classifier floors on labeled sets, hard-gating; (3) an LLM judge (Opus 4.8, different + stronger than the Sonnet-4.6 draft model, to avoid self-preference bias) + pairwise win-rate, shipped **advisory** until owner calibration proves κ ≥ 0.7, then flipped to gating. LLM-calling evals are ANTHROPIC_API_KEY-gated in CI with a loud skip when absent (the migration-drift pattern).

**Tech Stack:** TypeScript strict, Vitest 4, Vercel AI SDK v6 (`generateObject` from `ai`, models via `@vantera/ai`), zod, GitHub Actions. Judge model `claude-opus-4-8` (pinned via `getModel("claude-opus-4-8")`). Draft model default `claude-sonnet-4-6`.

**Spec:** `docs/superpowers/specs/2026-07-16-enterprise-grade-brain-optimization-design.md` (GREEN-LIT, WS-2). Phase 1 shipped the prompt registry (`packages/ai/src/prompts.ts` — `RegisteredPrompt {name,text,hash}`, `registerPrompt`, `listPrompts`, `fnv1a64`; 11 prompts registered). Phase 2A shipped the stats core (`5a5c653`).

## Global Constraints

- Branch: `phase-egb-2b-evals` off origin/main (`5a5c653`). Full gate (`pnpm lint && pnpm type-check && pnpm test && pnpm build`) green before merge. Ship via `git push origin phase-egb-2b-evals:main` (local `main` is worktree-locked). **Web deploys via the Git integration on push to main — do NOT use `vercel deploy --prod` CLI (it fails: omits `.git` → prepare hook exit 128); `.vercelignore` must not list `.git`.**
- TDD everywhere; colocated `*.test.ts`; no `any`/`@ts-ignore`; `noUncheckedIndexedAccess` (base tsconfig).
- **Single-AI-entry:** `packages/evals` gets models ONLY via `@vantera/ai` (`getModel`), never `@ai-sdk/*` — `packages/ai/src/single-entry.test.ts` will fail the build otherwise. `generateObject` is imported from `"ai"` (as every brain does).
- **No vendor names** in any fixture (Unipile/Explorium/Smartlead/Clay). **Fictional-names integrity:** all fixture names/companies are obviously fictional; use the codebase convention — single-first-name + fake company + `.example` TLD for any URL (e.g. `Dana @ Acme`, `https://cal.com/dana/15min` → prefer `https://acme.example/book`).
- **API-key-gated CI:** any eval that calls a real model runs only when `ANTHROPIC_API_KEY` is present; absent → a LOUD `::warning` skip, never a silent green (the `migration-drift.yml` pattern).
- **No new `schedules.task()`** (quota 10/10 — the guardrail test fails the build). The nightly eval run is a GitHub Actions `schedule`, NOT a Trigger schedule.
- Commit messages end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- **GATE 0 posture is untouched** by this plan — no optimize.ts / decide changes here. This plan builds the *eval* half of GATE 1; the autonomous-adoption re-enable is a separate tiny follow-up gated on BOTH this CI being green AND owner judge-calibration.

---

### Task 1: Scaffold `packages/evals` + widen the agent-brains barrel

The evals harness needs graders that exist in `humanizer.ts` but are NOT in the `@vantera/agent-brains` index barrel: `findActionClaims`, `findUnapprovedLinks`, `normalizeDashes`, plus `validateConversationMessage`/`allowedConversationLinks` from `respond.ts`. Widen the barrel so evals imports from the package public API, not deep `src/` paths.

**Files:**
- Create: `packages/evals/package.json`, `packages/evals/tsconfig.json`, `packages/evals/vitest.config.ts`, `packages/evals/src/index.ts`, `packages/evals/README.md`, `packages/evals/src/smoke.test.ts`
- Modify: `packages/agent-brains/src/index.ts` (widen barrel)

**Interfaces:**
- Produces: `@vantera/agent-brains` additionally exports `findActionClaims`, `findUnapprovedLinks`, `normalizeDashes` (from `./copy/humanizer`) and `validateConversationMessage`, `allowedConversationLinks` (from `./reply/respond`). `@vantera/evals` package builds + type-checks.

- [ ] **Step 1:** `packages/evals/package.json` — copy `packages/ai/package.json`'s shape:

```json
{
  "name": "@vantera/evals",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "scripts": { "type-check": "tsc --noEmit", "test": "vitest run" },
  "dependencies": {
    "@vantera/agent-brains": "workspace:*",
    "@vantera/ai": "workspace:*",
    "ai": "^6.0.0",
    "zod": "^4.4.3"
  },
  "devDependencies": { "typescript": "^5.8.0", "vitest": "^4.1.9" }
}
```

Verify the `ai`/`zod` version ranges against `packages/agent-brains/package.json` and match them exactly. `tsconfig.json` = `{ "extends": "../../tsconfig.base.json", "include": ["src", "*.ts"] }`. `vitest.config.ts` = copy `packages/help-agent/vitest.config.ts` (`environment: "node"`, `include: ["src/**/*.test.ts"]`). `src/index.ts` starts as `export {};` (filled by later tasks). README: one paragraph on what the harness is + the API-key-gated contract.

- [ ] **Step 2:** Widen `packages/agent-brains/src/index.ts` — add to the humanizer re-export line: `findActionClaims, findUnapprovedLinks, normalizeDashes`; add a new export line for `validateConversationMessage, allowedConversationLinks` from `./reply/respond`. (Verify these are exported from those modules — the scout confirmed they are.)

- [ ] **Step 3:** `smoke.test.ts` — import each newly-barreled grader from `@vantera/agent-brains` and assert it's a function; assert `getModel` and `registerPrompt` import from `@vantera/ai`. This proves wiring + that the barrel widening didn't break the existing `purity.test.ts`/`single-entry.test.ts`.

- [ ] **Step 4:** `pnpm install` (new package), then `pnpm --filter @vantera/evals test && pnpm --filter @vantera/evals type-check && pnpm --filter @vantera/agent-brains test` (barrel change must not break its suites) → green.

- [ ] **Step 5:** Commit `feat(evals): scaffold packages/evals + widen agent-brains grader barrel (WS-2)`.

---

### Task 2: Prompt-registry call-site enforcement (completes WS-2.1)

Phase 1 shipped the raw-constant scanner (no bare `*_SYSTEM = "..."`). The missing WS-2.1 guardrail: every `generateObject`/`generateText` call site must source its `system:` from a registered handle's `.text`, not an inline string — so a prompt can never be un-attributable.

**Files:**
- Create: `packages/agent-brains/src/prompt-callsite.test.ts`

**Interfaces:** none — static-analysis guardrail (the `structure.test.ts` genre).

- [ ] **Step 1:** Write the test — walk `packages/agent-brains/src/**/*.ts` (excluding `*.test.ts`), find every `generateObject(`/`generateText(` call, and for each assert the `system:` property value matches `/\b[A-Z_]+\.text\b/` (a registered handle's `.text`) and is NOT a string/template literal. Report offenders with file paths. (Regex-scan the call's object literal region; if a robust AST-free scan is awkward, assert the simpler invariant: no `system:\s*[\`"']` inside any file that imports `generateObject`/`generateText`.) Include a sanity assertion that the scan found ≥ 8 call sites (proves it's actually scanning).

- [ ] **Step 2:** Run `pnpm --filter @vantera/agent-brains test -- prompt-callsite` → PASS (all current call sites already use `.text` per the scout). If any offender surfaces, that's a real finding — fix the call site to use the registered handle.

- [ ] **Step 3:** Commit `test(brains): guardrail — every generateObject system prompt comes from the registry (WS-2.1)`.

---

### Task 3: Golden-set format + copy corpora (linkedin + respond)

**Files:**
- Create: `packages/evals/src/corpus.ts` (types + loader), `packages/evals/src/corpus.test.ts`
- Create: `packages/evals/fixtures/copy-linkedin/*.json` (~18 cases), `packages/evals/fixtures/copy-respond/*.json` (~18 cases)

**Interfaces (produces):**

```ts
export type CopyLinkedinCase = {
  id: string;                     // kebab, unique
  input: DraftInput;              // { lead, insights, context } — the real brain input type
  grounding: string;              // the citable-facts string the lints check against
  frozenDraft?: LinkedInDraft;    // an accepted baseline draft (for frozen-lint + pairwise)
  notes?: string;
};
export type CopyRespondCase = {
  id: string;
  input: ConversationMessageInput; // { lead, insights, context, thread, incoming?, classification? }
  grounding: string;
  frozenDraft?: ConversationDraft;
  notes?: string;
};
export function loadCopyLinkedinCorpus(): CopyLinkedinCase[];   // reads fixtures/*.json (resolveJsonModule)
export function loadCopyRespondCorpus(): CopyRespondCase[];
```

- [ ] **Step 1:** Define the types in `corpus.ts` (import `DraftInput`, `LinkedInDraft`, `ConversationMessageInput`, `ConversationDraft` from `@vantera/agent-brains` — verify they're exported; if `DraftInput`/`ConversationMessageInput` aren't in the barrel, add them in Task 1's widening or re-declare structurally). Loader reads the fixture JSON directory.

- [ ] **Step 2:** Author fixtures — DISPATCH a fixture-authoring subagent (see the plan's execution note): ~18 anonymized cases per brain spanning the real value space (different industries, seniorities, pain points, with/without proof metrics, with/without booking URL; for respond: interested / not_interested / neutral / question threads). Every name/company fictional, every URL `.example`, zero vendor names. Each case's `frozenDraft` is a hand-written, lint-clean exemplar draft (the accepted baseline). A subset intentionally carries a metric in `grounding` so the ungrounded-claim lint is exercised downstream.

- [ ] **Step 3:** `corpus.test.ts` — assert both corpora load, every `id` is unique, every case validates against its zod-ish shape, every URL matches `/\.example\b/` or is a whitelisted booking domain, and no case body contains a banned vendor name (reuse a small deny-list). This test is the fixture-integrity guardrail.

- [ ] **Step 4:** `pnpm --filter @vantera/evals test` → green.

- [ ] **Step 5:** Commit `feat(evals): golden-set format + anonymized copy corpora (linkedin + respond)`.

---

### Task 4: Deterministic quality gate (the hard copy gate)

**Files:**
- Create: `packages/evals/src/graders/deterministic.ts`, `packages/evals/src/graders/deterministic.test.ts`
- Create: `packages/evals/src/run-deterministic.ts` (the runner entry the CI calls)

**Interfaces (produces):**

```ts
export type GradeResult = { caseId: string; brain: string; violations: Violation[]; pass: boolean };
/** Lint a produced draft with the exact production graders. Pure — no model. */
export function gradeLinkedinDraft(draft: LinkedInDraft, c: CopyLinkedinCase, sellerName?: string | null): GradeResult;
export function gradeRespondDraft(draft: ConversationDraft, c: CopyRespondCase): GradeResult;
/** Full run: mode "frozen" lints each case's frozenDraft (no API); mode "live" generates then lints (needs API). */
export function runDeterministic(mode: "frozen" | "live", model?: LanguageModel): Promise<{ results: GradeResult[]; passRate: number }>;
```

Grader composition (reuse verbatim): linkedin → `validateLinkedInDraft(draft, grounding, sellerName)` + `findActionClaims(note+msg)` + `findUnapprovedLinks(msg, allowed)`; respond → `validateConversationMessage(message, block, allowedLinks)` + `findActionClaims` + `findUngroundedClaims(message, grounding)`. `pass = violations.length === 0`. The hard gate is `passRate === 1`.

- [ ] **Step 1: Failing tests** — `deterministic.test.ts`: `gradeLinkedinDraft` on a known-CLEAN frozen draft → `pass: true, violations: []`; on a known-DIRTY draft (contains a banned phrase + an ungrounded `40%` not in grounding + a bare `.com` link) → `pass: false` with the expected rules. `runDeterministic("frozen")` over the corpus → `passRate === 1` (every fixture's frozenDraft is clean by construction — this is what makes them baselines). `runDeterministic("live", mockModel)` with a mock returning a dirty draft → catches it (`passRate < 1`).

- [ ] **Step 2: RED**, then implement `deterministic.ts` (pure graders) + `run-deterministic.ts` (live mode calls `draftLinkedIn(c.input, model)` / `draftConversationMessage(c.input, model)`; frozen mode lints `c.frozenDraft`). Live mode default model = `getModel()` (the real draft model); tests inject a mock.

- [ ] **Step 3: GREEN** — `pnpm --filter @vantera/evals test`. If any frozenDraft fails its own lint, the fixture is wrong — fix the fixture (baselines must be clean).

- [ ] **Step 4:** Commit `feat(evals): deterministic copy quality gate (100%-pass, frozen + live modes)`.

---

### Task 5: Classifier floors (reply/classify + intent/classify)

**Files:**
- Create: `packages/evals/src/graders/classifier.ts`, `.test.ts`
- Create: `packages/evals/fixtures/classify-reply/labeled.json`, `packages/evals/fixtures/classify-intent/labeled.json`
- Create: `packages/evals/src/run-classifier.ts`

**Interfaces (produces):**

```ts
export type ReplyLabel = { id: string; body: string; expected: ReplyVerdict["classification"] };
export type IntentLabel = { id: string; obs: IntentObservationInput; ctx: IntentContext; expectedIsIntent: boolean };
/** Pure metric math over predictions vs labels. */
export function recall(preds: string[], labels: string[], positive: string): number;
export function precision(preds: boolean[], labels: boolean[]): number;
export type FloorReport = { metric: string; value: number; floor: number; pass: boolean; n: number };
export function runReplyFloors(model?: LanguageModel): Promise<FloorReport[]>;   // interested-recall ≥ 0.90
export function runIntentFloors(model?: LanguageModel): Promise<FloorReport[]>;  // intent-recall ≥ 0.85, intent-precision ≥ 0.80
```

Rationale for floors (in code comments): a missed `interested` reply is the most expensive classifier error in the product → interested-recall ≥ 0.90 is the load-bearing floor. Intent floors bound the high+medium in-market gate. (The spec's "needs_human precision" is a downstream reply-backlog pipeline concern, not a classifier label — noted, not gated here.)

- [ ] **Step 1:** Labeled fixtures — DISPATCH the fixture subagent: ~28 clear-cut labeled reply cases (unambiguous `interested` — "yes let's find time"; `not_interested` — "not interested, please remove"; plus neutral/OOO/unsubscribe/other) and ~24 intent-observation cases (clear high/medium in-market vs none). Labels must be unambiguous (owner reviews once). Fictional names, `.example`.

- [ ] **Step 2: Failing tests** — `classifier.test.ts`: unit-test `recall`/`precision` with hand vectors (e.g. `recall(["interested","other","interested"], ["interested","interested","interested"], "interested") === 2/3`). Test `runReplyFloors(mockModel)` with a mock that returns fixed classifications → asserts the computed recall matches and the floor comparison is correct. (The metric math is the tested unit; the real-model run is the API-gated integration.)

- [ ] **Step 3: RED**, implement. `runReplyFloors` maps each label through `classifyReply(body, model)`, computes interested-recall, returns the FloorReport. Note: `classifyReply` short-circuits unsubscribe/OOO via `preClassify` before the model — that's correct and should be counted. `runIntentFloors` batches through `classifyIntent`.

- [ ] **Step 4: GREEN** — `pnpm --filter @vantera/evals test`.

- [ ] **Step 5:** Commit `feat(evals): classifier floors — interested-recall + intent recall/precision (labeled sets)`.

---

### Task 6: LLM judge + κ-calibration harness (advisory until calibrated)

**Files:**
- Create: `packages/evals/src/judge/judge.ts` (+ `.test.ts`), `packages/evals/src/judge/kappa.ts` (+ `.test.ts`)
- Create: `packages/evals/fixtures/judge-calibration/human-labels.json` (schema + empty seed the owner fills)
- Modify: `packages/ai` OR `packages/evals` prompt registration — register the judge system prompt (`evals/judge` name) via `registerPrompt` from `@vantera/ai`.

**Interfaces (produces):**

```ts
export type JudgeVerdict = { specificity: number; themFocus: number; posture: number; naturalness: number; overall: number; rationale: string }; // 1–5 each
export function judgeCopy(draft: { text: string }, context: { grounding: string; cta?: string }, model?: LanguageModel): Promise<JudgeVerdict>;
export const JUDGE_MODEL_ID = "claude-opus-4-8";  // stronger + different from the Sonnet-4.6 draft model → mitigates self-preference bias
/** Cohen's kappa between two integer-label vectors. Pure. */
export function cohensKappa(a: number[], b: number[]): number;
export type CalibrationReport = { kappa: number; trusted: boolean; n: number };  // trusted = kappa >= 0.7
export function runCalibration(humanLabels: HumanLabel[], model?: LanguageModel): Promise<CalibrationReport>;
```

Judge prompt: a rubric scoring specificity / them-focus / posture / naturalness on a copy draft, `generateObject` with a zod schema, `system: JUDGE_PROMPT.text`, default `model = getModel(JUDGE_MODEL_ID)`. The judge is **advisory** — nothing gates on it until `runCalibration` reports `trusted: true`. `human-labels.json` ships as `[]` with a documented schema (`{draftId, humanOverall: 1-5}`); the owner labels ~100 during calibration.

- [ ] **Step 1: Failing tests** — `kappa.test.ts`: `cohensKappa` on perfect agreement → 1; on chance-level → ~0; on a known vector pair → the hand-computed value. `judge.test.ts`: `judgeCopy` with a mock model returning a canned verdict JSON → parses to `JudgeVerdict`; `runCalibration` with mock judge + a small human-label set → computes κ and sets `trusted` correctly at the 0.7 boundary.

- [ ] **Step 2: RED**, implement. Cohen's κ formula: `(po - pe) / (1 - pe)` with `po` observed agreement, `pe` expected-by-chance (bin the 1–5 scores or a binary good/bad threshold — pick binary `overall ≥ 4` for a robust κ and document it). Register `JUDGE_PROMPT`.

- [ ] **Step 3: GREEN** — evals + agent-brains (registry) + ai suites green; root type-check.

- [ ] **Step 4:** Commit `feat(evals): LLM judge (Opus 4.8) + Cohen's-kappa calibration harness — advisory until kappa >= 0.7`.

---

### Task 7: Pairwise win-rate (advisory)

**Files:**
- Create: `packages/evals/src/judge/pairwise.ts` (+ `.test.ts`)

**Interfaces (produces):**

```ts
/** Position-swapped A/B: judge picks the better of two drafts, run twice with order flipped to cancel position bias. */
export function pairwiseCompare(a: { text: string }, b: { text: string }, context: { grounding: string }, model?: LanguageModel): Promise<"a" | "b" | "tie">;
export type PairwiseReport = { candidateWins: number; baselineWins: number; ties: number; winRate: number; nonInferior: boolean }; // nonInferior = winRate >= 0.48
export function runPairwise(candidates: { caseId: string; text: string }[], model?: LanguageModel): Promise<PairwiseReport>;  // candidate vs each case's frozenDraft baseline
```

`pairwiseCompare` runs two judge calls (A-first, then B-first); agree → that winner, disagree → tie. `winRate = (candidateWins + 0.5*ties) / total`. Non-inferiority bar 0.48. Uses `getModel(JUDGE_MODEL_ID)`. Advisory until calibration.

- [ ] **Step 1: Failing tests** — `pairwise.test.ts`: `runPairwise` win-rate aggregation with a mock judge returning fixed winners → asserts the arithmetic and the `nonInferior` boundary; a position-bias test (mock returns "first draft always") → the swap yields ties, not a spurious winner.

- [ ] **Step 2: RED**, implement. **GREEN** — suites green.

- [ ] **Step 3:** Commit `feat(evals): pairwise win-rate vs frozen baselines, position-swapped, non-inferiority ≥ 0.48 (advisory)`.

---

### Task 8: Evals CI wiring + model-upgrade protocol doc

**Files:**
- Create: `.github/workflows/evals.yml`
- Create: `packages/evals/src/ci.ts` (the entry the workflow runs: orchestrates deterministic + classifier hard gates, judge + pairwise advisory reports, prints a summary, exits non-zero only on a hard-gate failure)
- Create: `docs/evals.md` (model-upgrade shadow protocol + how to add fixtures + the API-key-gated contract)
- Modify: `packages/evals/package.json` (add a `evals:ci` script → `tsx src/ci.ts` or a vitest entry)

**Interfaces:** `ci.ts` reads `ANTHROPIC_API_KEY`; absent → prints `::warning` and runs only the pure-logic vitest suites (already run by the normal `test` job), exits 0; present → runs live deterministic (hard), classifier floors (hard), pairwise + judge (advisory, reported not gating until a `EVALS_JUDGE_GATING=1` flag flips post-calibration).

- [ ] **Step 1:** `evals.yml` — path-triggered:

```yaml
name: Evals
on:
  pull_request:
    paths:
      - "packages/agent-brains/src/copy/**"
      - "packages/agent-brains/src/reply/**"
      - "packages/agent-brains/src/optimize/**"
      - "packages/ai/**"
      - "packages/evals/**"
  push: { branches: [main], paths: ["packages/agent-brains/src/**", "packages/ai/**", "packages/evals/**"] }
  schedule: [{ cron: "23 6 * * *" }]     # nightly full run (GitHub schedule — NOT a Trigger schedule)
  workflow_dispatch:

jobs:
  evals:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @vantera/evals test   # pure-logic layer — always hard
      - name: Live evals (API-gated)
        env: { ANTHROPIC_API_KEY: "${{ secrets.ANTHROPIC_API_KEY }}" }
        run: |
          if [ -z "$ANTHROPIC_API_KEY" ]; then
            echo "::warning::ANTHROPIC_API_KEY not set — live evals (deterministic gate, classifier floors, judge, pairwise) SKIPPED. GATE 1 requires them; add the secret."
            exit 0
          fi
          pnpm --filter @vantera/evals evals:ci
```

Cost note in a YAML comment: bounded to the fixture-set size (~$2–5/run); the nightly run is the fuller sweep.

- [ ] **Step 2:** `ci.ts` — orchestrate: `runDeterministic("live")` (fail on passRate < 1), `runReplyFloors()` + `runIntentFloors()` (fail on any floor miss), then judge + pairwise as advisory reports to stdout. Exit non-zero only on a hard-gate miss.

- [ ] **Step 3:** `docs/evals.md` — document: the three layers + which gate hard vs advisory; the model-upgrade shadow protocol (any `ANTHROPIC_MODEL` change requires the full eval suite green + a 48h shadow-generation window before flip — the shadow-generation automation is a named follow-up); how to add a fixture; the fictional-names rule; the κ ≥ 0.7 calibration step and the `EVALS_JUDGE_GATING` flip.

- [ ] **Step 4:** Validate YAML parses (`python3 -c "import yaml; yaml.safe_load(open('.github/workflows/evals.yml'))"`); `pnpm --filter @vantera/evals type-check`.

- [ ] **Step 5:** Commit `feat(ci): evals.yml — deterministic + classifier hard gates, judge + pairwise advisory, API-key-gated (WS-2.4)`.

---

### Final verification (before merge)

- [ ] `pnpm lint && pnpm type-check && pnpm test && pnpm build` — full gate green (evals pure-logic suites included).
- [ ] `single-entry.test.ts` + `purity.test.ts` + `prompt-registry.test.ts` + the new `prompt-callsite.test.ts` all green (evals never imports a provider; brains all registry-sourced).
- [ ] Fixture-integrity test green; zero vendor names, all URLs `.example`/whitelisted.
- [ ] PR body carries the owner arm-steps + the GATE 1 unlock criteria (below).

### GATE 1 unlock (stated for the PR body — NOT done in this plan)

GATE 1 = **both halves green**: (a) this evals CI hard-gating (deterministic copy gate + classifier floors) on prompt/copy PRs, AND (b) WS-1's calibration gates (shipped in 2A: null false-adoption ≤ 5%). Then, gated on those PLUS owner judge-calibration (label ~100 pairs → κ ≥ 0.7 → flip `EVALS_JUDGE_GATING=1` so judge + pairwise also gate), a **tiny follow-up** flips autonomous adoption back on via the unified `ready_to_adopt` + 24h-grace config (WS-3.2). That flip is deliberately not in this plan.

**Owner arm-steps (blocking GATE 1, in the PR body):**
1. Add `ANTHROPIC_API_KEY` as a GitHub Actions secret (evals CI is inert without it — loud-skips today).
2. Review + sign off the anonymized golden/labeled fixtures (one pass).
3. Judge-calibration labeling session (~1–2h, ~100 copy drafts good/bad) → run `runCalibration` → confirm κ ≥ 0.7 → flip `EVALS_JUDGE_GATING=1`.
4. Eval budget (~$50–100/mo at nightly cadence).

**Deferred (noted, next, NOT built here):** the weekly drift monitor (samples 50 live drafts → judge scores + lint/regen rates as a time series, 2σ alert — needs an `eval_runs` table + a plain Trigger task piggybacked on the agent-scheduler tick, never a new schedule) and the shadow-generation automation for the model-upgrade protocol.
