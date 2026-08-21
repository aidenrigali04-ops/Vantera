# Stage 1b — Generated Recipes + Thompson-Sampling Challenger Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete Stage 1's generate→gate→bandit→measure→decide→remember loop: Vera generates new recipe candidates with an LLM (beyond the 3 enum knobs), gates them, and picks the next challenger by Thompson sampling over real cross-account aggregate outcomes (the collective prior) — while the existing champion/challenger engine, Wilson-CI decision gate, and do-no-harm circuit breaker remain the UNCHANGED adjudicator of what actually wins.

**Architecture:** The bandit chooses **what to test next**, never what ships — `chainNext` in the optimize pipeline grows from a deterministic knob-flip into: generate candidates (LLM, gated, knob-flip always included as the baseline candidate) → aggregate stamped Stage-1 recipe outcomes across accounts by strategy signature (aggregate patterns only, never text — the collective-brain decision) → Thompson-sample a Beta posterior per candidate → start the experiment with the winner. `CopyStrategy` gains one bounded open-ended knob: `openerAngle` (a short style-only directive, linted so it can never smuggle a claim). No DB migration: strategies already live in jsonb everywhere and the Stage-1 recipe stamp carries the new knob automatically.

**Tech Stack:** Pure brains modules (rule 13) with `generateObject` + injected `LanguageModel` (derive-criteria convention), zod-loose + strict normalization, seeded-RNG Thompson sampling (Marsaglia-Tsang gamma + Box-Muller), drizzle store methods in pg-store only.

## Global Constraints

- **The envelope is untouchable:** `decideExperiment`, `DECIDE_DEFAULTS`, the circuit breaker, `assignVariant`, the one-live-experiment index, humanizer/grounding lints — none of these change. The bandit only replaces `proposeNextChallenger` inside `chainNext`.
- **Honesty rule:** `openerAngle` is style-only — the lint rejects digits, %, $, and guarantee/promise words so a generated directive can never instruct a claim; drafts still pass the same `validateHumanity` + grounding checks unchanged.
- **Collective brain boundary:** cross-account learning is aggregate patterns only — strategy knobs + outcome booleans. Never message text, never lead identity.
- **Rule 13:** brains stay pure (no DB/Trigger imports); model injected with `getModel()` default.
- **Inert without the model:** `proposeCandidatesFn` absent ⇒ `chainNext` behaves exactly like today (deterministic knob-flip) — guarded by test.
- **Voice rules:** "gets smarter", no she/her for Vera, in any copy touched.
- **Knowledge-sync (rule 09):** update `packages/help-content/content/optimization.md`.
- **Gate:** `pnpm lint && pnpm type-check && pnpm test && pnpm build` green before merge; prod ship ends with promote + verification.

---

### Task 1: `openerAngle` knob + directive + lint (agent-brains, pure)

**Files:**
- Modify: `packages/agent-brains/src/copy/shared.ts` (`CopyStrategy`, `strategyDirectives`)
- Modify: `packages/agent-brains/src/optimize/experiment.ts` (`describeStrategy` label)
- Create: `packages/agent-brains/src/optimize/angle.ts` (+ test)
- Test: `packages/agent-brains/src/optimize/angle.test.ts`, extend `packages/agent-brains/src/copy/shared.test.ts` (or the file where `strategyDirectives` is tested — find it) and `experiment.test.ts`

**Interfaces:**
- Produces: `CopyStrategy.openerAngle?: string`; `validateRecipeAngle(angle: string): string | null` (null = valid, else the reason); directive line in `strategyDirectives`; `describeStrategy` handles the knob.

- [ ] **Step 1: Write the failing tests**

```ts
// packages/agent-brains/src/optimize/angle.test.ts
import { describe, expect, it } from "vitest";
import { validateRecipeAngle } from "./angle";

describe("validateRecipeAngle", () => {
  it("accepts a short, claim-free style angle", () => {
    expect(validateRecipeAngle("a peer in their niche just solved this same pain")).toBeNull();
  });
  it("rejects digits, %, $ (no smuggled stats)", () => {
    expect(validateRecipeAngle("teams see 40% more replies")).toMatch(/number|claim/i);
    expect(validateRecipeAngle("save $500 a month")).toMatch(/number|claim/i);
  });
  it("rejects guarantee/promise language", () => {
    expect(validateRecipeAngle("guaranteed meetings from the first note")).toMatch(/claim/i);
  });
  it("rejects too-short and too-long angles", () => {
    expect(validateRecipeAngle("hi")).toMatch(/length/i);
    expect(validateRecipeAngle("x".repeat(90))).toMatch(/length/i);
  });
});
```

Add to the strategyDirectives tests (wherever `strategyDirectives` is currently tested — `grep -rn "strategyDirectives" packages/agent-brains/src/**/*.test.ts`):

```ts
it("renders openerAngle as a style directive", () => {
  expect(strategyDirectives({ openerAngle: "their recent post as the doorway" })).toContain(
    'Angle the opener around: "their recent post as the doorway"'
  );
});
```

Add to `experiment.test.ts`:

```ts
it("describes an openerAngle strategy in plain words", () => {
  expect(describeStrategy({ openerAngle: "a peer just solved this pain" })).toBe(
    'open with the angle "a peer just solved this pain"'
  );
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd packages/agent-brains && npx vitest run src/optimize/angle.test.ts src/optimize/experiment.test.ts`
Expected: FAIL (module missing / label missing).

- [ ] **Step 3: Implement**

`packages/agent-brains/src/optimize/angle.ts`:

```ts
/**
 * Gate for the open-ended openerAngle knob (Stage 1b). The angle is a STYLE directive — it may
 * steer what the opener is angled around, never what is claimed. Anything that could smuggle a
 * number, price, or promise into a draft prompt is rejected here, before it can ever become a
 * challenger. Pure.
 */
const MIN_LEN = 8;
const MAX_LEN = 80;
const CLAIM_WORDS = /\b(guarantee[ds]?|promise[ds]?|proven to|results? in|roi)\b/i;

export function validateRecipeAngle(angle: string): string | null {
  const a = angle.trim();
  if (a.length < MIN_LEN || a.length > MAX_LEN) return `angle length must be ${MIN_LEN}-${MAX_LEN} chars`;
  if (/[0-9%$]/.test(a)) return "angle may not contain numbers or money/percent symbols (claim risk)";
  if (CLAIM_WORDS.test(a)) return "angle may not contain claim/guarantee language";
  return null;
}
```

`copy/shared.ts` — extend the type and directives:

```ts
export type CopyStrategy = {
  /** what the first touch leads with */
  openWith?: "trigger" | "pain";
  /** follow-up length target */
  followupLength?: "tight" | "standard";
  /** the register of the ask */
  askStyle?: "soft" | "specific";
  /** Stage 1b open-ended knob: a short, linted, style-only angle for the opener (validateRecipeAngle
   *  gates every generated value before it can enter an experiment) */
  openerAngle?: string;
};
```

In `strategyDirectives`, before the `STRATEGY_LINES` loop handling, special-case the free-text knob:

```ts
export function strategyDirectives(strategy?: CopyStrategy): string {
  if (!strategy) return "";
  const lines: string[] = [];
  for (const [key, value] of Object.entries(strategy)) {
    if (!value) continue;
    if (key === "openerAngle") {
      lines.push(`- Angle the opener around: "${String(value).trim()}". This shapes the angle only, never add facts or numbers because of it.`);
      continue;
    }
    const line = STRATEGY_LINES[`${key}:${value}`];
    if (line) lines.push(`- ${line}`);
  }
  if (lines.length === 0) return "";
  return `Strategy for this message (apply in addition to the rules above, never overriding them):\n${lines.join("\n")}`;
}
```

`experiment.ts` — in `describeStrategy`, before the KNOB_LABEL lookup:

```ts
const parts = Object.entries(strategy)
  .filter(([, v]) => v)
  .map(([k, v]) =>
    k === "openerAngle"
      ? `open with the angle "${String(v)}"`
      : (KNOB_LABEL[`${k}:${String(v)}`] ?? `${k}: ${String(v)}`)
  );
```

- [ ] **Step 4: Export + run tests**

Export `validateRecipeAngle` from `src/index.ts` (named-export style). Run: `npx vitest run src/optimize/ src/copy/` — PASS, including purity test.

- [ ] **Step 5: Commit**

```bash
git add -A packages/agent-brains && git commit -m "feat(brains): openerAngle knob — linted style-only open-ended recipe dimension (Stage 1b)"
```

---

### Task 2: Strategy signature + Thompson sampling (agent-brains, pure)

**Files:**
- Create: `packages/agent-brains/src/optimize/bandit.ts`
- Test: `packages/agent-brains/src/optimize/bandit.test.ts`
- Modify: `packages/agent-brains/src/index.ts` (exports)

**Interfaces:**
- Produces:
  - `strategySignature(s: CopyStrategy): string` — canonical sorted-key JSON
  - `aggregateBySignature(stageKey, rows: {strategy: CopyStrategy; flags: LeadOutcomeFlags}[]): Map<string, VariantOutcome>` (reuses `aggregateArm`)
  - `chooseChallenger(candidates: CopyStrategy[], stats: Map<string, VariantOutcome>, rand: () => number): CopyStrategy | null`

- [ ] **Step 1: Write the failing tests**

```ts
// packages/agent-brains/src/optimize/bandit.test.ts
import { describe, expect, it } from "vitest";
import { strategySignature, aggregateBySignature, chooseChallenger } from "./bandit";
import type { LeadOutcomeFlags } from "./outcomes";

const F = (o: Partial<LeadOutcomeFlags>): LeadOutcomeFlags => ({
  invited: true, accepted: false, interested: false, negative: false, booked: false, converted: false, ...o,
});

// deterministic LCG so the sampler is reproducible in tests
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0), s / 2 ** 32);
}

describe("strategySignature", () => {
  it("is stable under key order and drops empty values", () => {
    expect(strategySignature({ openWith: "pain", askStyle: "soft" })).toBe(
      strategySignature({ askStyle: "soft", openWith: "pain" })
    );
    expect(strategySignature({})).toBe(strategySignature({ openWith: undefined }));
  });
});

describe("aggregateBySignature", () => {
  it("groups outcome flags per strategy signature", () => {
    const rows = [
      { strategy: { openWith: "pain" as const }, flags: F({ accepted: true }) },
      { strategy: { openWith: "pain" as const }, flags: F({}) },
      { strategy: { openWith: "trigger" as const }, flags: F({ accepted: true }) },
    ];
    const m = aggregateBySignature("acceptance", rows);
    expect(m.get(strategySignature({ openWith: "pain" }))).toEqual({ denominator: 2, successes: 1, negatives: 0 });
    expect(m.get(strategySignature({ openWith: "trigger" }))).toEqual({ denominator: 1, successes: 1, negatives: 0 });
  });
});

describe("chooseChallenger", () => {
  it("returns null for no candidates", () => {
    expect(chooseChallenger([], new Map(), lcg(1))).toBeNull();
  });
  it("overwhelmingly prefers the arm with far better real outcomes", () => {
    const good = { openWith: "pain" as const };
    const bad = { openWith: "trigger" as const };
    const stats = new Map([
      [strategySignature(good), { denominator: 200, successes: 120, negatives: 0 }],
      [strategySignature(bad), { denominator: 200, successes: 10, negatives: 0 }],
    ]);
    const rand = lcg(42);
    let goodWins = 0;
    for (let i = 0; i < 100; i++) {
      if (chooseChallenger([good, bad], stats, rand) === good) goodWins++;
    }
    expect(goodWins).toBeGreaterThan(90);
  });
  it("explores unseen candidates (uniform prior) rather than never picking them", () => {
    const seen = { openWith: "pain" as const };
    const unseen = { openerAngle: "a peer just solved this pain" };
    const stats = new Map([[strategySignature(seen), { denominator: 10, successes: 3, negatives: 0 }]]);
    const rand = lcg(7);
    let unseenPicks = 0;
    for (let i = 0; i < 200; i++) {
      if (chooseChallenger([seen, unseen], stats, rand) === unseen) unseenPicks++;
    }
    expect(unseenPicks).toBeGreaterThan(20); // Beta(1,1) prior keeps real exploration pressure
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run src/optimize/bandit.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement**

```ts
// packages/agent-brains/src/optimize/bandit.ts
import type { CopyStrategy } from "../copy/shared";
import type { FunnelStageKey } from "./funnel";
import type { VariantOutcome } from "./decide";
import { aggregateArm, type LeadOutcomeFlags } from "./outcomes";

/**
 * Thompson-sampling challenger selection (Stage 1b). The bandit decides WHAT TO TEST NEXT —
 * the champion/challenger experiment, Wilson gate, and circuit breaker remain the unchanged
 * adjudicator of what wins. Stats come from Stage-1 recipe stamps aggregated across accounts:
 * aggregate patterns only (knobs + outcome booleans), never text. Pure; RNG injected.
 */

/** Canonical signature for a strategy — sorted keys, empty values dropped. */
export function strategySignature(s: CopyStrategy): string {
  const entries = Object.entries(s)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .sort(([a], [b]) => (a < b ? -1 : 1));
  return JSON.stringify(entries);
}

/** Group per-message outcome flags by strategy signature into per-recipe VariantOutcomes. */
export function aggregateBySignature(
  stageKey: FunnelStageKey,
  rows: { strategy: CopyStrategy; flags: LeadOutcomeFlags }[]
): Map<string, VariantOutcome> {
  const groups = new Map<string, LeadOutcomeFlags[]>();
  for (const r of rows) {
    const sig = strategySignature(r.strategy);
    const list = groups.get(sig) ?? [];
    list.push(r.flags);
    groups.set(sig, list);
  }
  const out = new Map<string, VariantOutcome>();
  for (const [sig, flags] of groups) out.set(sig, aggregateArm(stageKey, flags));
  return out;
}

/** Standard normal via Box-Muller (rand-injected). */
function sampleNormal(rand: () => number): number {
  let u = 0;
  while (u === 0) u = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
}

/** Gamma(shape≥0) via Marsaglia-Tsang (with the shape<1 boost). */
function sampleGamma(shape: number, rand: () => number): number {
  if (shape < 1) {
    const u = rand();
    return sampleGamma(shape + 1, rand) * Math.pow(u === 0 ? 1e-12 : u, 1 / shape);
  }
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (;;) {
    const x = sampleNormal(rand);
    const v = Math.pow(1 + c * x, 3);
    if (v <= 0) continue;
    const u = rand();
    if (Math.log(u === 0 ? 1e-12 : u) < 0.5 * x * x + d - d * v + d * Math.log(v)) return d * v;
  }
}

function sampleBeta(alpha: number, beta: number, rand: () => number): number {
  const a = sampleGamma(alpha, rand);
  const b = sampleGamma(beta, rand);
  return a / (a + b);
}

/**
 * Pick the next challenger: sample each candidate's Beta(1+successes, 1+failures) posterior from
 * the collective aggregates and take the max. Unseen candidates get Beta(1,1) — uniform prior,
 * built-in exploration.
 */
export function chooseChallenger(
  candidates: CopyStrategy[],
  stats: Map<string, VariantOutcome>,
  rand: () => number
): CopyStrategy | null {
  if (candidates.length === 0) return null;
  let best: CopyStrategy | null = null;
  let bestDraw = -1;
  for (const c of candidates) {
    const o = stats.get(strategySignature(c));
    const successes = o?.successes ?? 0;
    const failures = Math.max(0, (o?.denominator ?? 0) - successes);
    const draw = sampleBeta(1 + successes, 1 + failures, rand);
    if (draw > bestDraw) {
      bestDraw = draw;
      best = c;
    }
  }
  return best;
}
```

- [ ] **Step 4: Export from index + run** — add `export { strategySignature, aggregateBySignature, chooseChallenger } from "./optimize/bandit";` then `npx vitest run src/optimize/` → PASS.

- [ ] **Step 5: Commit**

```bash
git add -A packages/agent-brains && git commit -m "feat(brains): Thompson-sampling challenger selection over collective recipe aggregates (Stage 1b)"
```

---

### Task 3: LLM recipe candidate generation (agent-brains, pure)

**Files:**
- Create: `packages/agent-brains/src/optimize/generate.ts`
- Test: `packages/agent-brains/src/optimize/generate.test.ts` (mock model — MockLanguageModelV2 or the convention used by existing brain tests; check `derive-criteria.test.ts`)
- Modify: `packages/agent-brains/src/index.ts`

**Interfaces:**
- Consumes: `proposeNextChallenger` (baseline candidate), `validateRecipeAngle` (Task 1), `strategySignature` (Task 2)
- Produces: `proposeRecipeCandidates(input: GenerateRecipesInput, model?: LanguageModel): Promise<CopyStrategy[]>` where `GenerateRecipesInput = { stageKey: FunnelStageKey; champion: CopyStrategy; recentConclusions: { label: string; status: string }[]; accountIndustry?: string | null }`

- [ ] **Step 1: Write the failing tests** (mirror `derive-criteria.test.ts`'s mock-model convention exactly; the contract below)

```ts
// the contract to assert:
// 1. the deterministic knob-flip is ALWAYS candidates[0] (loop never depends on the LLM)
// 2. generated candidates with an invalid openerAngle (digits/claims/too long) are dropped
// 3. candidates equal to the champion's signature are dropped
// 4. duplicates (by signature) are dropped; output capped at 6 total
// 5. a throwing model still returns [knobFlip] (never propagates)
// 6. stageKey "close" with no knob-flip → returns [] when model also fails
```

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement**

```ts
// packages/agent-brains/src/optimize/generate.ts
import { generateObject, type LanguageModel } from "ai";
import { z } from "zod";
import { getModel } from "@vantera/ai";
import type { CopyStrategy } from "../copy/shared";
import type { FunnelStageKey } from "./funnel";
import { proposeNextChallenger } from "./experiment";
import { validateRecipeAngle } from "./angle";
import { strategySignature } from "./bandit";

/**
 * Generate → gate: LLM-proposed recipe candidates for the next experiment (Stage 1b). The model
 * proposes; deterministic gates dispose. The knob-flip baseline is always candidate 0, so the
 * autonomous loop keeps working when the model fails or returns garbage. Pure (model injected).
 */

const candidateSchema = z.object({
  reasoning: z.string(),
  candidates: z.array(
    z.object({
      openWith: z.enum(["trigger", "pain"]).optional(),
      followupLength: z.enum(["tight", "standard"]).optional(),
      askStyle: z.enum(["soft", "specific"]).optional(),
      openerAngle: z.string().optional(),
    })
  ),
});

export interface GenerateRecipesInput {
  stageKey: FunnelStageKey;
  champion: CopyStrategy;
  /** recent concluded tests (label + adopted/discarded/halted) so ideas aren't re-proposed */
  recentConclusions: { label: string; status: string }[];
  accountIndustry?: string | null;
}

const MAX_CANDIDATES = 6;
const MAX_OUTPUT_TOKENS = 900;

const GENERATE_SYSTEM = `You propose the next outreach copy experiments for a LinkedIn lead-gen system. Each candidate is a small strategy: optional knobs openWith (trigger|pain), followupLength (tight|standard), askStyle (soft|specific), and openerAngle — a SHORT style-only phrase (8-80 chars) describing what to angle the opener around (e.g. "a peer in their niche facing the same pain", "their recent post topic as the doorway").

Hard rules:
- openerAngle is STYLE ONLY: no numbers, no percentages, no prices, no promises or guarantees, no invented facts. It steers the angle of the first sentence, never what is claimed.
- Propose 3-5 candidates meaningfully different from the current champion and from each other.
- Do not re-propose ideas that were already tested (listed below with their outcomes).
- Emit reasoning first (one dense sentence), then the candidates.`;

export async function proposeRecipeCandidates(
  input: GenerateRecipesInput,
  model: LanguageModel = getModel()
): Promise<CopyStrategy[]> {
  const baseline = proposeNextChallenger(input.stageKey, input.champion);
  const out: CopyStrategy[] = baseline ? [baseline] : [];
  const seen = new Set(out.map(strategySignature));
  seen.add(strategySignature(input.champion));

  let generated: z.infer<typeof candidateSchema> | null = null;
  try {
    generated = (
      await generateObject({
        model,
        schema: candidateSchema,
        system: GENERATE_SYSTEM,
        prompt: [
          `Funnel stage being tested: ${input.stageKey}`,
          `Current champion strategy: ${JSON.stringify(input.champion)}`,
          `Seller industry: ${input.accountIndustry ?? "unknown"}`,
          `Already tested (do not re-propose): ${
            input.recentConclusions.map((c) => `${c.label} (${c.status})`).join("; ") || "none"
          }`,
        ].join("\n"),
        maxOutputTokens: MAX_OUTPUT_TOKENS,
      })
    ).object;
  } catch {
    return out; // the loop must never stall on a generation failure
  }

  for (const raw of generated.candidates) {
    if (out.length >= MAX_CANDIDATES) break;
    const c: CopyStrategy = {};
    if (raw.openWith) c.openWith = raw.openWith;
    if (raw.followupLength) c.followupLength = raw.followupLength;
    if (raw.askStyle) c.askStyle = raw.askStyle;
    if (raw.openerAngle !== undefined) {
      const angle = raw.openerAngle.trim();
      if (validateRecipeAngle(angle) !== null) continue; // gated: claim-risk angles never enter
      c.openerAngle = angle;
    }
    if (Object.keys(c).length === 0) continue;
    const sig = strategySignature(c);
    if (seen.has(sig)) continue;
    seen.add(sig);
    out.push(c);
  }
  return out;
}
```

- [ ] **Step 4: Export + run all brains tests** — `npx vitest run` in packages/agent-brains → PASS incl. purity.

- [ ] **Step 5: Commit**

```bash
git add -A packages/agent-brains && git commit -m "feat(brains): LLM recipe candidate generation with deterministic gates (Stage 1b)"
```

---

### Task 4: Wire the bandit into the optimize pipeline

**Files:**
- Modify: `packages/jobs/src/pipeline/types.ts` (`OptimizeStore`, `OptimizeDeps`)
- Modify: `packages/jobs/src/pipeline/optimize.ts` (`chainNext`)
- Modify: `packages/jobs/src/pipeline/pg-store.ts` (two new store methods)
- Modify: `packages/jobs/src/trigger/optimize.ts` (wire `proposeCandidatesFn`)
- Test: `packages/jobs/src/pipeline/optimize.test.ts`

**Interfaces:**
- Produces:
  - `OptimizeStore.getStampedOutcomes(): Promise<{ strategy: CopyStrategy; flags: LeadOutcomeFlags }[]>` — cross-account (service role), first_touch invite rows with status 'sent' and a recipe, one per lead, joined to that lead's outcome flags
  - `OptimizeStore.getRecentConclusions(accountId: string, limit: number): Promise<{ label: string; status: string }[]>`
  - `OptimizeDeps.proposeCandidatesFn?: (input: GenerateRecipesInput) => Promise<CopyStrategy[]>`
  - `OptimizeDeps.rand?: () => number` (default `Math.random`)

- [ ] **Step 1: Write the failing tests** (extend the existing optimize.test.ts fake store; contract):

```ts
// 1. proposeCandidatesFn ABSENT → chainNext starts exactly the deterministic knob-flip (today's behavior)
// 2. proposeCandidatesFn present → startExperiment receives the bandit's choice from the returned
//    candidates; with stats heavily favoring one candidate and a seeded rand, that candidate wins
// 3. generation returning [] → falls back to the knob-flip
// 4. getStampedOutcomes/getRecentConclusions are called once per chain (stats fetched per conclusion)
```

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement pipeline changes**

`optimize.ts`:

```ts
import {
  aggregateArm,
  aggregateBySignature,
  chooseChallenger,
  decideExperiment,
  describeStrategy,
  nextExperimentStage,
  proposeNextChallenger,
} from "@vantera/agent-brains";

async function chainNext(
  deps: OptimizeDeps,
  exp: RunningExperiment,
  champion: CopyStrategy
): Promise<boolean> {
  const stageKey = nextExperimentStage(exp.stageKey);
  // Stage 1b: generate → gate → bandit. Without a generator the loop is byte-identical to the
  // deterministic knob-flip it shipped with; with one, the bandit picks what to test next from
  // real cross-account aggregates. The decide gate + circuit breaker stay the adjudicator.
  let challenger: CopyStrategy | null = null;
  if (deps.proposeCandidatesFn) {
    const [candidates, stamped] = await Promise.all([
      deps.proposeCandidatesFn({
        stageKey,
        champion,
        recentConclusions: await deps.store.getRecentConclusions(exp.accountId, 8),
        accountIndustry: null,
      }),
      deps.store.getStampedOutcomes(),
    ]);
    const stats = aggregateBySignature(stageKey, stamped);
    challenger = chooseChallenger(candidates, stats, deps.rand ?? Math.random);
  }
  challenger ??= proposeNextChallenger(stageKey, champion);
  if (!challenger) return false;
  return deps.store.startExperiment({ accountId: exp.accountId, stageKey, champion, challenger });
}
```

(If `describeStrategy` isn't needed in this file, drop it from the import. `getRecentConclusions` label = `describeStrategy(challenger_strategy)` computed in the store — see Step 4.)

`types.ts` — extend `OptimizeStore` + `OptimizeDeps` exactly as the Interfaces block above (import `GenerateRecipesInput`, `LeadOutcomeFlags` types from `@vantera/agent-brains`).

- [ ] **Step 4: Implement the store methods in pg-store.ts**

```ts
    async getStampedOutcomes() {
      // Stage 1b collective prior: every SENT first-touch invite with a recipe stamp, across all
      // accounts (service role) — aggregate patterns only (strategy knobs + outcome booleans).
      const rows = await db
        .select({
          strategy: sql<CopyStrategy>`${scheduledSends.recipe} -> 'strategy'`,
          leadId: scheduledSends.leadId,
          invitedAt: leads.linkedinInvitedAt,
          connectedAt: leads.linkedinConnectedAt,
          bookedAt: leads.meetingBookedAt,
          status: leads.status,
        })
        .from(scheduledSends)
        .innerJoin(leads, eq(leads.id, scheduledSends.leadId))
        .where(
          and(
            eq(scheduledSends.status, "sent"),
            eq(scheduledSends.linkedinStage, "invite"),
            sql`${scheduledSends.recipe} ->> 'brain' = 'first_touch'`
          )
        );
      if (rows.length === 0) return [];
      const ids = [...new Set(rows.map((r) => r.leadId).filter((v): v is string => Boolean(v)))];
      const replyRows = await db
        .select({ leadId: replies.leadId, classification: replies.classification })
        .from(replies)
        .where(inArray(replies.leadId, ids));
      const interested = new Set<string>();
      const negative = new Set<string>();
      for (const r of replyRows) {
        if (r.classification === "interested") interested.add(r.leadId);
        else if (r.classification === "not_interested" || r.classification === "unsubscribe")
          negative.add(r.leadId);
      }
      return rows.map((r) => ({
        strategy: (r.strategy ?? {}) as CopyStrategy,
        flags: {
          invited: r.invitedAt != null,
          accepted: r.connectedAt != null,
          interested: r.leadId ? interested.has(r.leadId) : false,
          negative: r.leadId ? negative.has(r.leadId) : false,
          booked: r.bookedAt != null,
          converted: r.status === "converted",
        },
      }));
    },

    async getRecentConclusions(accountId, limit) {
      const rows = await db
        .select({
          challengerStrategy: optimizationExperiments.challengerStrategy,
          status: optimizationExperiments.status,
        })
        .from(optimizationExperiments)
        .where(
          and(
            eq(optimizationExperiments.accountId, accountId),
            inArray(optimizationExperiments.status, ["adopted", "discarded", "halted"])
          )
        )
        .orderBy(desc(optimizationExperiments.concludedAt))
        .limit(limit);
      return rows.map((r) => ({
        label: describeStrategy((r.challengerStrategy ?? {}) as CopyStrategy),
        status: r.status,
      }));
    },
```

(Import `describeStrategy` from `@vantera/agent-brains` in pg-store.)

- [ ] **Step 5: Wire the trigger wrapper**

```ts
// packages/jobs/src/trigger/optimize.ts
import { proposeRecipeCandidates } from "@vantera/agent-brains";
// ...
    const summary = await runOptimize({
      store: createPgStore(createDb()),
      proposeCandidatesFn: (input) => proposeRecipeCandidates(input),
    });
```

(Also refresh the file's stale header comment — the loop has been autonomous since Stage 0; note the Stage 1b generate→bandit chain.)

- [ ] **Step 6: Run the jobs suite** — `npx vitest run` in packages/jobs → PASS (fake stores in optimize.test.ts gain the two methods; other suites unaffected).

- [ ] **Step 7: Commit**

```bash
git add packages/jobs && git commit -m "feat(jobs): generate→gate→bandit challenger chaining on collective recipe aggregates (Stage 1b)"
```

---

### Task 5: Knowledge sync + full gate + ship + verify

**Files:**
- Modify: `packages/help-content/content/optimization.md`

- [ ] **Step 1: Update the article** — in "How the testing works", after the existing intro sentence, add (match tone; voice rules):

```markdown
Vera also comes up with what to test next. New candidate approaches are generated — including
fresh opener angles beyond the built-in styles — then screened by hard rules (an angle can
never add numbers, prices, or promises), and the most promising candidate is picked using the
real results of every approach tried so far. Approaches that keep winning get tested more;
unproven ideas still get their fair shot. What actually becomes your default is decided the
same way as always: a controlled test on real outcomes, with the do-no-harm circuit breaker.
```

Run `npx vitest run` in packages/help-content → PASS. Commit: `docs(help): Vera generates and prioritizes its own tests (knowledge-sync)`.

- [ ] **Step 2: Full gate** — `pnpm lint && pnpm type-check && pnpm test && pnpm build` → all green.

- [ ] **Step 3: Ship** — push branch → origin main (fast-forward; local main is held by the vantera-fix worktree). No migration this stage. Trigger auto-deploys (expect v20260714.9+); Vercel builds (web unchanged except help content — promote + curl sanity anyway, domain pin gotcha).

- [ ] **Step 4: Real-readiness verification (no hallucinating)**
1. Trigger MCP: new prod worker DEPLOYED.
2. Prod: running experiments still 2, untouched.
3. The generate→bandit path only fires when an experiment CONCLUDES (min-sample not yet reached in prod) — verify the code path with the test suite's full-loop test, state honestly that the first live firing happens at the first real conclusion, and add it to the monitor list. Optionally dry-run `proposeRecipeCandidates` once against the real model (scratchpad script) to verify generation quality + gates on real output — no DB writes.

- [ ] **Step 5: Update memory** (project-vantera-self-evolving-brain.md + MEMORY.md hook) and report.
