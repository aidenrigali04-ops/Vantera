# Enterprise-Grade Brain — Phase 2A (Stats Core) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the anytime-valid decision core (e-process + expected-loss cap + alpha-investing), full-brain strategy threading + SendRecipe v2, stage-scoped outcome attribution, and EB shrinkage — the WS-1/WS-3 half of GATE 1 (Phase 2B evals is the other half).

**Architecture:** Pure math in `packages/agent-brains/src/optimize/` (injected RNG, exhaustively sim-tested); pipeline changes follow the locked skeleton (pure cores, drizzle only in `pg-store.ts`); one migration (view + wealth columns) via the vantera-db-migrations skill. The GATE 0 suggest-only posture is UNCHANGED by this plan — V2 verdicts still land as `ready_to_adopt`; auto-adopt-with-grace ships config-gated OFF and flips only at GATE 1.

**Tech Stack:** TypeScript strict, Vitest 4, Drizzle/Supabase Postgres (view + columns), no new deps (log-gamma implemented in-package).

**Spec:** `docs/superpowers/specs/2026-07-16-enterprise-grade-brain-optimization-design.md` (GREEN-LIT). Phase 1 shipped `6ef30b1` (suggest-only flip, A/A canary, prompt registry with `RegisteredPrompt.hash`, sim harness `optimize/sim/harness.ts` with `runMonteCarlo(runs, seed, config)` — measured old-gate null false-adoption 30.6%).

## Global Constraints

- Branch: `phase-egb-2a-stats-core` off origin/main (`6ef30b1` or later). Full gate (`pnpm lint && pnpm type-check && pnpm test && pnpm build`) green before merge. Local `main` is locked by the `~/vantera-fix` worktree — ship via `git push origin <branch>:main` (fast-forward only).
- TDD everywhere; brains pure (`purity.test.ts`); drizzle only in `pg-store.ts`; thin triggers; colocated tests; no `any`/`@ts-ignore`; no new `schedules.task()` (quota guardrail at 10/10 will fail the build).
- **GATE 0 invariants that must survive this plan:** adopt verdicts → `markReadyToAdopt` only; A/A canary interception (`accountId === deps.canaryAccountId` + identical arms) stays ahead of every action branch; identical-arm non-canary heal path stays.
- Commit messages end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Migration work MUST invoke the `vantera-db-migrations` skill; next free migration number is 0058 (verify at build time).
- All tuned constants (priors, thresholds, pseudo-counts) earn their values in the sim suite — a constant changed without a sim run backing it is a review-blocking defect.

---

### Task 1: Thread CopyStrategy into conversation drafting + complete the two stamps

Reply and follow-up sends already stamp `{brain, experimentId, variant}` (from `bundle.attribution`) but pass no `strategy`/`playbookVersion`, and `draftConversationMessage` never renders strategy directives — knobs only shape first-touch today. This task completes WS-3.1: conversation drafting becomes strategy-aware and its stamps carry the full recipe.

**Files:**
- Modify: `packages/jobs/src/pipeline/pg-store.ts` (`getResponderBundle`, ~lines 1790-1921)
- Modify: `packages/jobs/src/pipeline/types.ts` (`ResponderBundle.attribution`, ~line 831)
- Modify: `packages/agent-brains/src/reply/respond.ts` (prompt assembly, ~lines 144-157)
- Modify: `packages/jobs/src/pipeline/inbound.ts` (stamp, ~lines 173-177)
- Modify: `packages/jobs/src/pipeline/sequence-touch.ts` (stamp, ~lines 124-128)
- Tests: `packages/agent-brains/src/reply/respond.test.ts`, `packages/jobs/src/pipeline/inbound.test.ts`, `packages/jobs/src/pipeline/sequence-touch.test.ts`

**Interfaces:**
- Consumes: `getActiveExperiment(accountId)` → `{id, allocationPct, challengerStrategy}` (pg-store ~884), `getChampion(accountId)` → `{strategy, version}` (~907), `strategyDirectives(strategy?)` (`copy/shared.ts:88`), `CopyContext.strategy?` (already typed, never populated).
- Produces: `ResponderBundle.attribution` gains `strategy: CopyStrategy` and `playbookVersion: number | null`; `bundle.context.strategy` populated; both conversation stamps carry `strategy` + `playbookVersion` (+ `exemplars: 0` implicitly — conversation paths inject no exemplars).

- [ ] **Step 1: Failing brain test** — in `respond.test.ts` (mock model, existing pattern):

```ts
it("renders strategy directives into the conversation prompt when context.strategy is set", async () => {
  const calls: string[] = [];
  const model = mockModelCapturing(calls); // reuse the file's existing mock helper
  await draftConversationMessage(
    { lead, insights, context: { ...baseContext, strategy: { askStyle: "soft" } }, thread: [] },
    model
  );
  expect(calls.join("\n")).toContain("Ask style"); // the strategyDirectives line for askStyle
});

it("prompt is byte-identical to before when strategy is absent", async () => {
  // capture prompt with and without `strategy: undefined` — must be equal
});
```

- [ ] **Step 2: RED** — `pnpm --filter @vantera/agent-brains test -- respond` fails (no directives rendered).

- [ ] **Step 3: Implement brain change** — in `respond.ts`, where the prompt user-block is assembled (~150), insert the directives exactly the way `copy/linkedin.ts` does:

```ts
  const strategyBlock = strategyDirectives(input.context.strategy);
```

and append `strategyBlock` to the prompt sections (after the lead block, before the task instruction), importing `strategyDirectives` from `../copy/shared`. Absent strategy ⇒ `strategyDirectives` returns "" ⇒ byte-identical prompt (that's the second test).

- [ ] **Step 4: Failing pipeline tests** — `inbound.test.ts` + `sequence-touch.test.ts`: extend the existing fake-bundle fixtures so `attribution` carries `strategy: { askStyle: "specific" }, playbookVersion: 3`; assert the inserted send's `recipe` contains `strategy.askStyle === "specific"` and `playbookVersion === 3` (today both are `{}`/null).

- [ ] **Step 5: Implement plumbing.**

`types.ts` — `ResponderBundle.attribution` becomes:

```ts
  /** the lead's experiment arm + the resolved strategy that should shape THIS message */
  attribution: {
    experimentId: string | null;
    variant: "champion" | "challenger" | null;
    /** challenger strategy only while the lead's experiment is the account's LIVE one; else current champion */
    strategy: CopyStrategy;
    playbookVersion: number | null;
  };
```

`pg-store.ts` `getResponderBundle` — after the existing lead fetch, resolve once:

```ts
      const [experiment, champion] = await Promise.all([
        this.getActiveExperiment(accountId),
        this.getChampion(accountId),
      ]);
      const onLiveChallenger =
        lead.strategyVariant === "challenger" && lead.experimentId != null &&
        experiment != null && lead.experimentId === experiment.id;
      const strategy = onLiveChallenger ? experiment.challengerStrategy : champion.strategy;
```

(if `this.` isn't available in the store-literal style, call the sibling closures the way other methods do — follow the file's existing pattern), then set `context.strategy = strategy` in the context construction and extend `attribution` with `strategy` and `playbookVersion: champion.version`. Resolution rule (locked): a lead drafts with the challenger strategy ONLY while its own experiment is the account's live one; any lead from a concluded experiment gets the current champion.

`inbound.ts` + `sequence-touch.ts` — the two `buildSendRecipe` calls each gain:

```ts
      strategy: bundle.attribution.strategy,
      playbookVersion: bundle.attribution.playbookVersion,
```

- [ ] **Step 6: GREEN + suites** — `pnpm --filter @vantera/agent-brains test && pnpm --filter @vantera/jobs test && pnpm --filter @vantera/jobs type-check` (every fake `ResponderBundle` in jobs tests needs the two new attribution fields — type-check is the checklist).

- [ ] **Step 7: Commit** — `feat(brain): conversation drafting is strategy-aware; reply/followup stamps carry the full recipe (WS-3.1)`

---

### Task 2: SendRecipe v2 — promptHash, modelId, stage

**Files:**
- Modify: `packages/agent-brains/src/optimize/recipe.ts`
- Modify: `packages/ai/src/client.ts` (add `getModelId()`)
- Modify: `packages/ai/src/index.ts` (export)
- Modify stamp sites: `packages/jobs/src/pipeline/copy-draft.ts` (~129), `inbound.ts`, `sequence-touch.ts`
- Modify: `packages/agent-brains/src/copy/linkedin.ts`, `packages/agent-brains/src/reply/respond.ts` (export their registered prompt handles)
- Tests: `packages/agent-brains/src/optimize/recipe.test.ts` + the three stamp-site tests

**Interfaces:**
- Consumes: Phase 1's `RegisteredPrompt` (`{name, text, hash}`) — `copy/linkedin.ts` has `LINKEDIN_SYSTEM`, `respond.ts` has `RESPOND_SYSTEM` (registered constants; export each as e.g. `export const LINKEDIN_PROMPT = LINKEDIN_SYSTEM` if not already exported).
- Produces:

```ts
export type SendRecipe = {
  v: 2;
  brain: RecipeBrain;
  strategy: CopyStrategy;
  experimentId: string | null;
  variant: "champion" | "challenger" | null;
  playbookVersion: number | null;
  exemplars: number;
  /** registry hash of the system prompt that drafted this message (null = pre-v2 stamp) */
  promptHash: string | null;
  /** resolved model id at draft time */
  modelId: string | null;
};
export function getModelId(): string; // packages/ai — the resolved ANTHROPIC_MODEL default
```

- [ ] **Step 1: Failing tests** — `recipe.test.ts`: `buildSendRecipe({brain:"first_touch", promptHash:"abc", modelId:"claude-x"})` returns `v: 2` with both fields; omitted ⇒ nulls. `packages/ai` test: `getModelId()` returns the same default the model factory uses and respects `ANTHROPIC_MODEL` env stub.
- [ ] **Step 2: RED**, then implement: bump `v` to 2 in the type + constructor (`v: 2 as const`), add the two nullable fields with `?? null` normalization. `getModelId()` in `client.ts` returns the exact expression the model default uses (extract the shared constant so they cannot drift). Readers: `getStampedOutcomes` reads `recipe->'strategy'` and `recipe->>'brain'` only — v1 rows stay readable; note this in the recipe.ts docblock (honesty rule: never backfill).
- [ ] **Step 3: Stamp sites** — each of the three sites adds `promptHash: <BRAIN>_SYSTEM.hash, modelId: getModelId()` (first_touch → `LINKEDIN_SYSTEM.hash` — thread it from the brain package via an export, do NOT re-register; conversation/followup → `RESPOND_SYSTEM.hash`). Update the site tests to assert the fields.
- [ ] **Step 4: GREEN** — brains + jobs suites + root type-check.
- [ ] **Step 5: Commit** — `feat(brain): SendRecipe v2 — promptHash + modelId + honest nulls (WS-3.4 partial)`

---

### Task 3: Migration 0058 — stage-scoped attribution view + alpha wealth

**REQUIRED: invoke the `vantera-db-migrations` skill before writing SQL.**

**Files:**
- Create: `packages/db/migrations/0058_stage_attribution_alpha.sql`
- Modify: `packages/db/src/schema.ts` (playbook + experiments columns)
- Test: `packages/db/src/schema.test.ts` additions (view grants asserted)

**Interfaces:**
- Produces: view `public.recipe_stage_outcomes` (service-role read only); `optimization_playbook.alpha_wealth numeric not null default 0.05`; `optimization_experiments.alpha_spent numeric` (nullable — pre-2A experiments have honest null).

- [ ] **Step 1:** Migration SQL (adapt to what the skill + schema.test.ts require; the semantic contract is locked):

```sql
-- 0058: stage-scoped recipe attribution + alpha-investing wealth (enterprise-grade-brain 2A).
-- retention: view over existing tables (no new prospect data). alpha columns are optimizer state.

alter table public.optimization_playbook
  add column alpha_wealth numeric not null default 0.05;
alter table public.optimization_experiments
  add column alpha_spent numeric;

-- Stage-scoped outcome attribution: each SENT recipe-stamped message judged on ITS stage only.
--  * first_touch invites → acceptance (did this lead connect?)
--  * conversation_reply / sequence_followup messages → reply-stage outcome of the NEXT
--    classified reply in the window (this send .. next agent send to the same lead).
-- Kills the first-touch-gets-everything leakage (audit 2026-07-16). Service-role read only.
create view public.recipe_stage_outcomes as
with agent_msgs as (
  select s.id, s.account_id, s.lead_id, s.recipe, s.sent_at,
         s.recipe->>'brain' as brain,
         lead(s.sent_at) over (partition by s.lead_id order by s.sent_at) as next_agent_at
  from public.scheduled_sends s
  where s.status = 'sent' and s.recipe is not null and s.sent_at is not null
)
select m.id as send_id, m.account_id, m.lead_id, m.brain,
       m.recipe->'strategy' as strategy,
       m.recipe->>'variant' as variant,
       (m.recipe->>'experimentId')::uuid as experiment_id,
       case when m.brain = 'first_touch'
            then (l.linkedin_connected_at is not null)
            else exists (
              select 1 from public.replies r
              where r.lead_id = m.lead_id
                and r.classification = 'interested'
                and r.created_at >= m.sent_at
                and r.created_at < coalesce(m.next_agent_at, 'infinity'::timestamptz))
       end as success,
       case when m.brain = 'first_touch' then false
            else exists (
              select 1 from public.replies r
              where r.lead_id = m.lead_id
                and r.classification in ('not_interested','unsubscribe')
                and r.created_at >= m.sent_at
                and r.created_at < coalesce(m.next_agent_at, 'infinity'::timestamptz))
       end as negative
from agent_msgs m
join public.leads l on l.id = m.lead_id;

revoke all on public.recipe_stage_outcomes from anon, authenticated;
```

VERIFY column/classification names against the real schema before committing (e.g. `replies.classification` values, `scheduled_sends.sent_at` — adjust to actual names; the guardrail test suite and a local replay via `scripts/replay-migrations.sh` are the checks). Guardrail: `schema.test.ts` gains an assertion that the view exists in the migration and carries the revoke (mirror how column-grant assertions are written).
- [ ] **Step 2:** Replay locally: `DATABASE_URL=postgresql://postgres@localhost:54329/postgres ./scripts/replay-migrations.sh` (the Phase-1 script; container from the drift-check task instructions) → all 59 green.
- [ ] **Step 3:** `pnpm --filter @vantera/db test` green; commit `feat(db): 0058 — recipe_stage_outcomes view + alpha-investing wealth columns`.
- [ ] **Step 4 (post-merge note for PR body):** apply 0058 to prod via the established path; drift check must be green after.

---

### Task 4: E-process math module (pure)

**Files:**
- Create: `packages/agent-brains/src/optimize/eprocess.ts`
- Create: `packages/agent-brains/src/optimize/eprocess.test.ts`

**Interfaces (produces):**

```ts
export function logGamma(x: number): number;               // Lanczos g=7, n=9
export function logBeta(a: number, b: number): number;     // logGamma(a)+logGamma(b)-logGamma(a+b)
/** Bayes-factor e-value: independent Beta(1,1) proportions vs shared Beta(1,1) proportion.
 *  Valid under optional stopping/continuation for this sequential 2x2 design; the sim suite is
 *  the empirical calibration authority (Task 6 gates). */
export function eValueTwoProportions(
  champ: { successes: number; denominator: number },
  chal: { successes: number; denominator: number }
): number;
export type PosteriorSummary = { medianLiftPp: number; probChallengerBetter: number; expectedAdoptionLossPp: number };
/** Monte-Carlo posterior summary from independent Beta(1+k,1+n-k) arms; rng injectable, n=4000 draws. */
export function posteriorSummary(
  champ: { successes: number; denominator: number },
  chal: { successes: number; denominator: number },
  rng?: () => number,
  draws?: number
): PosteriorSummary;
```

- [ ] **Step 1: Failing tests** (write ALL, watch RED):

```ts
it("logGamma matches known values", () => {
  expect(logGamma(1)).toBeCloseTo(0, 10);
  expect(logGamma(0.5)).toBeCloseTo(Math.log(Math.PI) / 2, 10);
  expect(logGamma(10)).toBeCloseTo(Math.log(362880), 8);
});
it("eValue is ~1 on empty data and grows with a real difference", () => {
  expect(eValueTwoProportions({successes:0,denominator:0},{successes:0,denominator:0})).toBeCloseTo(1, 6);
  const strong = eValueTwoProportions({successes:10,denominator:100},{successes:40,denominator:100});
  const weak = eValueTwoProportions({successes:15,denominator:100},{successes:17,denominator:100});
  expect(strong).toBeGreaterThan(20);
  expect(weak).toBeLessThan(3);
});
it("eValue is symmetric in arm order", () => { /* swap arms → equal */ });
it("posteriorSummary directional sanity (seeded mulberry32)", () => {
  const s = posteriorSummary({successes:10,denominator:100},{successes:30,denominator:100}, mulberry32(7));
  expect(s.probChallengerBetter).toBeGreaterThan(0.99);
  expect(s.medianLiftPp).toBeGreaterThan(10);
  expect(s.expectedAdoptionLossPp).toBeLessThan(0.1);
});
it("expectedAdoptionLossPp is high when challenger is truly worse", () => { /* mirrored data */ });
```

- [ ] **Step 2: Implement.** `eValueTwoProportions` in log space:

```ts
// log BF = [logB(1+k0,1+n0-k0) + logB(1+k1,1+n1-k1) - 2*logB(1,1)] - [logB(1+k0+k1, 1+(n0+n1)-(k0+k1)) - logB(1,1)]
// with logB(1,1) = 0, so: logB(a0h,b0h) + logB(a1h,b1h) - logB(a0h+a1h-1, b0h+b1h-1)
```

Implement exactly; `expectedAdoptionLossPp` = mean of `max(p0 - p1, 0) * 100` over paired posterior draws (`sampleBeta` from `bandit.ts`, rng injected, default `Math.random`, draws default 4000); `medianLiftPp` = median of `(p1 - p0) * 100`; sort-based median. Reuse `mulberry32` from `sim/harness.ts` in tests only.
- [ ] **Step 3: GREEN**; purity test still green; commit `feat(brains): e-process math — anytime-valid two-proportion e-value + posterior summaries (WS-1.1)`.

---

### Task 5: decideExperimentV2 + config-with-bounds

**Files:**
- Create: `packages/agent-brains/src/optimize/decide-v2.ts` (+ test)
- Modify: `packages/agent-brains/src/index.ts` (export)

**Interfaces (produces):**

```ts
export type DecideV2Options = {
  /** alpha spent on this experiment (e-threshold = 1/alpha); bounds [0.002, 0.05] */
  alpha?: number;
  /** posterior median lift required to adopt (pp); bounds [1, 10] */
  minEffectPp?: number;
  /** expected-loss ceiling for adopting (pp); bounds [0.1, 2] */
  maxAdoptionLossPp?: number;
  breakerMinSample?: number; harmMarginPp?: number; hardNegCeilingPct?: number; // breaker: unchanged semantics
  rng?: () => number;
};
export const DECIDE_V2_DEFAULTS: Required<Omit<DecideV2Options,"rng">>; // alpha .05, minEffect 3, maxLoss .5 — sim-tuned in Task 6
export function clampDecideV2Options(raw: Partial<DecideV2Options>): Required<Omit<DecideV2Options,"rng">>; // hard bounds in code
export function decideExperimentV2(champion: VariantOutcome, challenger: VariantOutcome, options?: DecideV2Options): ExperimentVerdict;
```

Decision order (locked): 1) circuit breaker FIRST, verbatim semantics from `decide.ts` (extract/reuse, don't duplicate — import the breaker check or lift it into a shared helper used by both); 2) compute `e = eValueTwoProportions(...)`; if `e < 1/alpha` → `keep_running` (reason includes current e and threshold); 3) `posteriorSummary`: median lift ≥ minEffectPp AND expectedAdoptionLossPp ≤ maxAdoptionLossPp → `adopt_challenger`; median lift ≤ −minEffectPp → `discard_challenger`; otherwise `keep_running` ("evidence of a difference but not a practical winner yet"). NO minimum-n gate — the e-threshold IS the evidence gate (small n simply can't reach e≥20). Reasons must carry the numbers (e, lift, loss) for the panel + decision audit.

- [ ] TDD steps as usual (RED cases: breaker fires first even with huge e; e below threshold keeps running at any n; adopt path; discard path; loss-cap blocks adoption; clamp clamps out-of-bounds config). Commit `feat(brains): decideExperimentV2 — e-process gate + expected-loss cap, bounds-clamped config (WS-1.1)`.

---

### Task 6: Sim calibration gates (the GATE 1 stats evidence)

**Files:**
- Modify: `packages/agent-brains/src/optimize/sim/harness.ts` (accept an injectable decide fn)
- Create: `packages/agent-brains/src/optimize/sim/calibration.test.ts`

**Interfaces:** `SimConfig` gains `decideFn?: (c: VariantOutcome, t: VariantOutcome, o?: unknown) => ExperimentVerdict` (default: legacy `decideExperiment` so Phase-1 characterization tests stay byte-identical).

- [ ] **Step 1:** Harness change + RED for the new tests:

```ts
it("GATE 1 NULL CALIBRATION: V2 false-adoption ≤ 5% under daily peeking", () => {
  const r = runMonteCarlo(2000, 1234, { championRate: 0.15, challengerRate: 0.15,
    negativeRate: 0.05, perDayPerArm: 8, horizonDays: 90,
    decideFn: (c, t) => decideExperimentV2(c, t, { rng: mulberry32(99) }) });
  expect(r.adoptRate).toBeLessThanOrEqual(0.05);
});
it("GATE 1 POWER: V2 detects a 10pp lift on a 15% base ≥ 80% within 90 days", () => {
  const r = runMonteCarlo(1000, 42, { championRate: 0.15, challengerRate: 0.25, /* … same volume … */
    decideFn: (c, t) => decideExperimentV2(c, t, { rng: mulberry32(7) }) });
  expect(r.adoptRate).toBeGreaterThanOrEqual(0.8);
});
it("CHAINED FAMILY: 10 sequential A/A experiments with alpha-investing yield ≤ 1 false adoption in expectation", () => {
  // simulate the wealth ledger (Task 7 rules as pure functions) across a 10-experiment chain, 500 chains
});
```

- [ ] **Step 2:** Run; if a gate fails, TUNE (alpha within bounds, minEffect, draws) and record every tuned value + its measured rates in the test file comments. If 10pp/90d power is unreachable, document the smallest detectable-at-80% effect at this volume in the test (adjust the power test's challengerRate to it, with an honest comment naming the MDE) — the gate must bind to a TRUE claim, and the recorded MDE becomes the power-ledger constant later. The NULL gate is non-negotiable at ≤5%.
- [ ] **Step 3:** Commit `test(brains): GATE 1 calibration gates — V2 null ≤5%, measured power, chained-family control (WS-1.7)`.

---

### Task 7: Wire V2 + alpha-investing into runOptimize (GATE 0 posture preserved)

**Files:**
- Modify: `packages/jobs/src/pipeline/optimize.ts`, `types.ts`, `pg-store.ts`
- Create: `packages/agent-brains/src/optimize/alpha.ts` (+ test) — pure wealth rules
- Modify: `packages/jobs/src/pipeline/optimize.test.ts`

**Interfaces:**
- Produces (pure, in `alpha.ts`):

```ts
export const ALPHA_WEALTH_START = 0.05; export const ALPHA_WEALTH_CAP = 0.10;
export const ALPHA_EARN_ON_CONCLUSION = 0.02; export const ALPHA_MIN_SPEND = 0.005;
/** spend for the next experiment: min(0.05, max(ALPHA_MIN_SPEND, wealth/2)); null when wealth < ALPHA_MIN_SPEND (chain pauses) */
export function nextAlphaSpend(wealth: number): number | null;
export function wealthAfterLaunch(wealth: number, spend: number): number;
export function wealthAfterConclusion(wealth: number): number; // +EARN, capped
```

- Store: `RunningExperiment` gains `alphaSpent: number | null` (null → treat as DECIDE_V2_DEFAULTS.alpha, honest legacy); `startExperiment` gains `alphaSpent` input and debits `optimization_playbook.alpha_wealth` in the same transaction; `concludeExperiment`/`markReadyToAdopt`-then-owner-adopt paths credit wealth on decisive conclusions (credit in `concludeExperiment` + in the owner-adopt playbook write — one credit per experiment, guard with `alpha_spent is not null`... simplest correct rule: credit inside `concludeExperiment` and inside `adoptChallenger`, keyed on the row transitioning OUT of running/ready — implement idempotently by crediting only when the status actually changed).
- `runOptimize`: verdict = `decideExperimentV2(aggArm(champ), aggArm(chal), { alpha: exp.alphaSpent ?? undefined, rng: deps.rand })`; `chainNext` computes `nextAlphaSpend(wealth)` (new store read `getAlphaWealth(accountId)`), skips chaining (with a summary counter `chainPaused`) when null. Canary + suggest-only branches UNCHANGED.

- [ ] TDD: alpha.ts pure tests (spend curve, pause at exhaustion, cap); optimize.test.ts updates (V2 wired — rig flags so V2 adopts: e.g. 9/60 vs 24/60 gives e=22.30 (verified with the math module in Task 5 — 6/40 vs 16/40 only reaches e=5.41, below threshold); chain pauses at exhausted wealth; legacy null alphaSpent uses default). Jobs suite + type-check green.
- [ ] Commit `feat(optimize): decideExperimentV2 + alpha-investing ledger wired — chain pauses when wealth is spent (WS-1.1/WS-3.2 groundwork)`.

---

### Task 8: EB shrinkage — bandit prior + targeting tilt

**Files:**
- Modify: `packages/agent-brains/src/optimize/bandit.ts` (`aggregateBySignature` or a shrink step in `chooseChallenger`)
- Modify: `packages/agent-brains/src/targeting/tilt.ts`
- Tests: colocated existing test files

**Locked semantics:**
- Bandit: before Thompson sampling, shrink each signature's (successes, failures) toward the global stage baseline with `SHRINK_M = 25` pseudo-observations at the pooled global rate: `Beta(1 + k + M*p̄, 1 + (n-k) + M*(1-p̄))`. Unseen candidates keep `Beta(1,1)`. Test: a 1/2 lucky signature no longer dominates a 30/100 solid one in argmax frequency (seeded, 500 draws).
- Tilt: segment rates shrink toward the account baseline with the same M=25 before the delta math; a lead's total contribution = `max(seniorityContribution, industryContribution)` instead of sum (correlated evidence). `TILT_CAP=5`, `SEGMENT_FLOOR=8`, ordering-only all stay. Update `topTiltSegment` consistently. Tests: 1-lucky-accept-in-8 segment earns < 1 point of tilt post-shrinkage; max-not-sum verified with a two-segment lead.
- Every constant references the sim/test evidence in a comment.

- [ ] TDD steps; brains suite + jobs suite green (pg-store callers unchanged — pure-layer change); commit `feat(brains): EB shrinkage for bandit prior + tilt, max-not-sum segments (WS-1.3/1.4)`.

---

### Final verification (before merge)

- [ ] `pnpm lint && pnpm type-check && pnpm test && pnpm build` — full gate green.
- [ ] Local migration replay green (59 files) via `scripts/replay-migrations.sh`.
- [ ] Confirm GATE 0 invariants by test: adopt verdicts still land `ready_to_adopt`; canary tests untouched and green.
- [ ] PR body: apply-0058-to-prod step; note that GATE 1 flip (auto-adopt with 24h grace) is intentionally NOT in this plan — it happens after Phase 2B (evals CI) + an evidence review of these calibration gates.
