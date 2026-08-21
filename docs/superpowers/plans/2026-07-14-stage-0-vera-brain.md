# Stage 0 — Vera Brain (Minimum Credible Self-Evolving Loop) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the "already knows what works + gets sharper every week, visibly, safely" promise literally true in the product: the existing champion/challenger engine adopts winners and chains the next test autonomously, every new account starts on an honestly-labeled proven starter play with a live experiment from day one, and the loop is visible in onboarding + dashboard ("What's working").

**Architecture:** Widen the existing Phase-3 optimize loop (migration 0040) — do NOT build a new system. Three pure additions to `agent-brains` (starter plays module, next-challenger proposal, stage rotation), one pipeline change (`runOptimize` adopts + chains instead of parking at `ready_to_adopt`), two store methods, onboarding seeding, and UI reframes. All autonomy stays inside the existing deterministic envelope: `decideExperiment`'s Wilson gates + do-no-harm circuit breaker are UNCHANGED; strategies remain the bounded 3-knob `CopyStrategy` (never free-form prompts); every draft still passes the humanizer.

**Tech Stack:** Existing repo stack only — TypeScript strict, Vitest (colocated `*.test.ts`), Drizzle/Supabase (no new tables in this plan), Trigger.dev cron (`packages/jobs/src/trigger/optimize.ts` unchanged wrapper), Next.js app router.

## Global Constraints

- **Honesty rule (spec 2026-07-14):** day-1 plays labeled by real source — `first_party` → "Proven on our own outbound", `research` → "Grounded in buyer research". NEVER "proven across accounts like yours". No invented numbers anywhere.
- **Safety envelope is not tunable by the loop:** `decideExperiment` thresholds and the humanizer are never modified by any autonomous path.
- **Rule 13:** brains stay pure (no DB/Trigger imports in `packages/agent-brains`); pipeline logic in `packages/jobs/src/pipeline/*` with deps injected; drizzle only in `pg-store.ts`.
- **Rule 09 knowledge-sync:** user-facing changes ship help-content articles in the same branch (Task 7).
- **Verification mandate (owner, 2026-07-14):** every task ends verified (tests + gate); plan ends with full-gate + visual re-verification. Nothing reported done on "should work".
- **White-label:** no vendor names on any user-facing surface.
- Copy register: plain language ("plays", "what's working", "keeps winners"), never ML jargon.

## File Structure (what changes where)

- `packages/agent-brains/src/optimize/experiment.ts` — ADD `proposeNextChallenger`, `nextExperimentStage` (pure; existing exports untouched)
- `packages/agent-brains/src/plays/starter.ts` (+ `starter.test.ts`) — NEW pure module: `STARTER_PLAYS`, `matchStarterPlays`, types
- `packages/agent-brains/src/index.ts` — export the new module + helpers
- `packages/jobs/src/pipeline/types.ts` — extend `RunningExperiment` + `OptimizeStore` (`adoptChallenger`, `startExperiment`), extend `OptimizeSummary`
- `packages/jobs/src/pipeline/optimize.ts` (+ `optimize.test.ts`) — auto-adopt + chain-next-experiment
- `packages/jobs/src/pipeline/pg-store.ts` — implement the two new store methods
- `apps/web/src/app/onboarding/actions.ts` — seed playbook (matched starter play) + first experiment in `findFirstLeads`
- `apps/web/src/app/onboarding/wizard.tsx` — proven-play surface: scan payoff + Step-1 connect block + deploy CTA copy
- `apps/web/src/app/(app)/analytics/outreach-diagnosis.tsx` — rename → "What's working", autonomy copy, recent-adoption display
- `apps/web/src/app/(app)/analytics/optimize-actions.ts` — keep manual start + legacy adopt; ADD `revertAdoption`
- `apps/web/src/lib/optimize.ts` — extend VM with last-adoption info
- `apps/web/src/app/(app)/dashboard/dashboard-view.tsx` — proven-play cards in `FirstRunInProgress`/`ActivationRamp`; "What's working" strip in `WorkingDashboard`; celebration tie-back line
- `apps/web/src/components/dock-nav.tsx` — "System" → "Brain"
- `apps/web/src/app/(app)/agents/agent-showcase-data.ts` — learning beats in agent summaries
- `apps/web/src/app/(app)/settings/proof/page.tsx` — one framing line
- `packages/help-content/content/optimize-whats-working.md` — NEW article (+ any stale-copy fixes in existing articles)

---

### Task 1: Pure brain helpers — next challenger + stage rotation

**Files:**
- Modify: `packages/agent-brains/src/optimize/experiment.ts`
- Test: `packages/agent-brains/src/optimize/experiment.test.ts` (extend existing colocated test file; create if absent)
- Modify: `packages/agent-brains/src/index.ts` (export the new fns)

**Interfaces:**
- Consumes: `CopyStrategy` (`../copy/shared`), `FunnelStageKey` (`./funnel`)
- Produces:
  - `proposeNextChallenger(stageKey: FunnelStageKey, champion: CopyStrategy): CopyStrategy | null` — single-knob challenger that always DIFFERS from the champion's current setting on that stage's knob; `null` for `close`.
  - `nextExperimentStage(prev: FunnelStageKey): "acceptance" | "reply" | "booking"` — rotation acceptance → reply → booking → acceptance (close → acceptance).

- [ ] **Step 1: Write the failing tests**

```ts
// in experiment.test.ts
import { proposeNextChallenger, nextExperimentStage } from "./experiment";

describe("proposeNextChallenger", () => {
  it("flips the stage knob away from the champion's current value", () => {
    expect(proposeNextChallenger("acceptance", { openWith: "trigger" })).toEqual({ openWith: "pain" });
    expect(proposeNextChallenger("acceptance", { openWith: "pain" })).toEqual({ openWith: "trigger" });
    expect(proposeNextChallenger("reply", { followupLength: "tight" })).toEqual({ followupLength: "standard" });
    expect(proposeNextChallenger("booking", { askStyle: "specific" })).toEqual({ askStyle: "soft" });
  });
  it("defaults to the classic proposal when the champion has no setting on the knob", () => {
    expect(proposeNextChallenger("acceptance", {})).toEqual({ openWith: "trigger" });
    expect(proposeNextChallenger("reply", {})).toEqual({ followupLength: "tight" });
    expect(proposeNextChallenger("booking", {})).toEqual({ askStyle: "specific" });
  });
  it("returns null for close (not a copy lever)", () => {
    expect(proposeNextChallenger("close", {})).toBeNull();
  });
  it("never proposes a challenger equal to the champion on the tested knob", () => {
    for (const stage of ["acceptance", "reply", "booking"] as const) {
      for (const champ of [{}, { openWith: "trigger" }, { openWith: "pain" },
        { followupLength: "tight" }, { followupLength: "standard" },
        { askStyle: "soft" }, { askStyle: "specific" }] as const) {
        const c = proposeNextChallenger(stage, champ);
        const knob = Object.keys(c!)[0] as keyof typeof c;
        expect(c![knob]).not.toEqual((champ as Record<string, unknown>)[knob]);
      }
    }
  });
});

describe("nextExperimentStage", () => {
  it("rotates acceptance → reply → booking → acceptance", () => {
    expect(nextExperimentStage("acceptance")).toBe("reply");
    expect(nextExperimentStage("reply")).toBe("booking");
    expect(nextExperimentStage("booking")).toBe("acceptance");
    expect(nextExperimentStage("close")).toBe("acceptance");
  });
});
```

- [ ] **Step 2: Run to verify failure** — `pnpm --filter @vantera/agent-brains test -- experiment` → FAIL (fns not exported)

- [ ] **Step 3: Implement in `experiment.ts`**

```ts
/** The knob each copy-tunable stage tests, and its two values. */
const STAGE_KNOB = {
  acceptance: "openWith",
  reply: "followupLength",
  booking: "askStyle",
} as const;

const KNOB_VALUES = {
  openWith: ["trigger", "pain"],
  followupLength: ["tight", "standard"],
  askStyle: ["soft", "specific"],
} as const;

/**
 * The next single-knob challenger for a stage — always different from the champion's current
 * setting on that stage's knob, so the autonomous loop keeps finding a real test after every
 * adoption instead of re-running the same variant. Null for `close` (not a copy lever).
 */
export function proposeNextChallenger(
  stageKey: FunnelStageKey,
  champion: CopyStrategy
): CopyStrategy | null {
  if (stageKey === "close") return null;
  const knob = STAGE_KNOB[stageKey];
  const [a, b] = KNOB_VALUES[knob];
  const next = champion[knob] === a ? b : a;
  return { [knob]: next } as CopyStrategy;
}

/** Stage rotation for the autonomous loop: after a conclusion, test the next copy stage. */
export function nextExperimentStage(prev: FunnelStageKey): "acceptance" | "reply" | "booking" {
  switch (prev) {
    case "acceptance":
      return "reply";
    case "reply":
      return "booking";
    default:
      return "acceptance";
  }
}
```

Check `KNOB_VALUES` ordering against the classic proposals in `proposeChallengerStrategy` (trigger/tight/specific must be the empty-champion default → they must be value `a`... note: for `askStyle`, `a = "soft"` would make the empty-champion default "soft", which contradicts the classic `specific`. ORDER `askStyle: ["specific", "soft"]` — wait, `champion[knob] === a ? b : a` with champion undefined gives `a`; classic defaults are trigger/tight/specific, so order arrays as `["trigger","pain"]`, `["tight","standard"]`, `["specific","soft"]`.)

- [ ] **Step 4: Run to verify pass** — `pnpm --filter @vantera/agent-brains test -- experiment` → PASS (all cases incl. the exhaustive never-equal sweep)
- [ ] **Step 5: Export from `packages/agent-brains/src/index.ts`** (alongside existing `proposeChallengerStrategy` export), run `pnpm --filter @vantera/agent-brains test` (full) + `pnpm --filter @vantera/agent-brains type-check` if script exists (else workspace type-check)
- [ ] **Step 6: Commit** — `feat(brains): next-challenger proposal + stage rotation for the autonomous optimize loop`

---

### Task 2: Starter plays module (the day-one brain)

**Files:**
- Create: `packages/agent-brains/src/plays/starter.ts`
- Create: `packages/agent-brains/src/plays/starter.test.ts`
- Modify: `packages/agent-brains/src/index.ts`

**Interfaces:**
- Consumes: `CopyStrategy` from `../copy/shared`; `validateLinkedInCopy`-equivalent humanizer checks from `../copy/humanizer` (use the exported lint used by `draftLinkedIn` — read `humanizer.ts` at execution time and use its real exported validator for the example-opener test).
- Produces:
  - `type StarterPlay = { slug: string; name: string; description: string; why: string; strategy: Required<CopyStrategy>; exampleOpener: string; source: "first_party" | "research"; audienceHints: string[] }`
  - `STARTER_PLAYS: StarterPlay[]` (exactly 3 in v1)
  - `matchStarterPlays(input: { industry?: string | null; icp?: string | null }): StarterPlay[]` — deterministic, always returns all plays ordered best-match-first, never empty.
  - `SOURCE_LABEL: Record<StarterPlay["source"], string>` = `{ first_party: "Proven on our own outbound", research: "Grounded in buyer research" }`

**Content (the actual plays — honest sourcing):**
1. `trigger-opener` — "The trigger opener": open from the prospect's own recent activity; `{ openWith: "trigger", followupLength: "standard", askStyle: "soft" }`; `source: "first_party"` (this IS the configuration Vantera's own outbound ran — the homepage's real first-party numbers); default best match.
2. `pain-first` — "The problem-first note": name the pain they're living, no pitch; `{ openWith: "pain", followupLength: "standard", askStyle: "soft" }`; `source: "research"`; audienceHints: ["saas", "software", "founder", "marketing"].
3. `direct-ask` — "The direct ask": tight follow-up, one concrete next step; `{ openWith: "trigger", followupLength: "tight", askStyle: "specific" }`; `source: "research"`; audienceHints: ["ceo", "cfo", "coo", "vp", "chief", "executive", "director"].

Example openers: 1–2 sentence openers written in the VOICE_RULES register, generic-but-real (no invented client names/metrics), each ≤200 chars. Matcher: lowercase `industry + " " + icp`, score = count of audienceHints hits; sort desc, stable by array order; `trigger-opener` wins ties (listed first).

- [ ] **Step 1: Failing tests** — assert: 3 plays; unique slugs; every `strategy` fully populated with legal knob values; every `exampleOpener` ≤ 200 chars AND passes the real humanizer lint (import it, assert zero violations); `matchStarterPlays({})` returns all 3 with `trigger-opener` first; `matchStarterPlays({ icp: "CFOs at mid-market fintech" })` puts `direct-ask` first; matcher is deterministic (two calls deep-equal).
- [ ] **Step 2: Run → FAIL** (`module not found`)
- [ ] **Step 3: Implement `starter.ts`** per the interface above (write the three openers carefully; run the humanizer test to force compliance — if an opener fails lint, FIX THE OPENER, never the lint).
- [ ] **Step 4: Run → PASS**; export from index.ts; full package test + type-check.
- [ ] **Step 5: Commit** — `feat(brains): starter plays module — honest day-one playbook tied to real CopyStrategy`

---

### Task 3: Auto-adopt + chain in the optimize pipeline

**Files:**
- Modify: `packages/jobs/src/pipeline/types.ts`
- Modify: `packages/jobs/src/pipeline/optimize.ts`
- Test: `packages/jobs/src/pipeline/optimize.test.ts` (extend existing)
- Modify: `packages/jobs/src/pipeline/pg-store.ts`

**Interfaces:**
- `RunningExperiment` must expose `{ id, accountId, stageKey, minSample, championStrategy: CopyStrategy }` — read the current type at execution; ADD `accountId`/`championStrategy` if absent (pg-store already selects the row; include the columns).
- `OptimizeStore` ADD:
  - `adoptChallenger(experimentId: string, reason: string): Promise<CopyStrategy>` — atomically: read experiment, upsert `optimization_playbook` (champion ← challenger_strategy, version+1, updated_at), set experiment status 'adopted' + decision_reason + concluded_at; returns the NEW champion strategy. (SQL mirrors the existing web `adoptExperiment` action.)
  - `startExperiment(input: { accountId: string; stageKey: FunnelStageKey; champion: CopyStrategy; challenger: CopyStrategy }): Promise<boolean>` — insert with allocation_pct 25, min_sample 30, status 'running'; returns false (no throw) on the one-live-experiment unique-index conflict.
- `OptimizeSummary` ADD `{ adopted: number; chained: number }`.
- Pipeline behavior (replaces the park-at-ready_to_adopt mapping):
  - `adopt_challenger` → `store.adoptChallenger(...)`; count `adopted`; then chain.
  - `discard_challenger` / `halt` → `store.concludeExperiment(...)` (unchanged); then chain.
  - Chain = `nextExperimentStage(exp.stageKey)` → `proposeNextChallenger(stage, currentChampion)` → `store.startExperiment(...)`; `currentChampion` = adoptChallenger's return value on adoption, else `exp.championStrategy`. Count `chained` on true.
  - `keep_running` → nothing (unchanged).
  - `ready_to_adopt` is NO LONGER PRODUCED (enum value stays for legacy rows; web UI keeps rendering its adopt/keep buttons for any legacy row).

- [ ] **Step 1: Failing tests** — with an in-memory `OptimizeStore` fake: (a) decisive challenger win → `adoptChallenger` called once, summary `{adopted:1}`, and a NEW experiment started on the ROTATED stage with a challenger differing from the new champion on that stage's knob; (b) champion holds → concluded 'discarded' AND chained; (c) breaker trip → 'halted' AND chained; (d) not enough data → nothing called; (e) `startExperiment` returning false (already-running conflict) → summary `chained:0`, no throw. Reuse the existing test file's fake-store pattern (read it first at execution — extend, don't replace).
- [ ] **Step 2: Run → FAIL** — `pnpm --filter @vantera/jobs test -- optimize`
- [ ] **Step 3: Implement** pipeline change + types. Keep `statusForDecision` for discard/halt only; delete the ready_to_adopt mapping with a comment: autonomy per spec 2026-07-14, envelope unchanged.
- [ ] **Step 4: Run → PASS**, then implement the two pg-store methods (drizzle SQL mirroring `optimize-actions.ts` adopt logic; unique-violation code `23505` → return false).
- [ ] **Step 5: Full `pnpm --filter @vantera/jobs test` + type-check → green. Commit** — `feat(jobs): optimize loop adopts winners and chains the next test autonomously (spec 2026-07-14)`

---

### Task 4: Onboarding seeds the brain (playbook + first experiment) + proven-play surface

**Files:**
- Modify: `apps/web/src/app/onboarding/actions.ts` (`findFirstLeads`, after agent provisioning, non-fatal best-effort like the Intent block)
- Modify: `apps/web/src/app/onboarding/wizard.tsx`
- Test: extend the colocated validation/action tests only if a colocated test file already covers `findFirstLeads` (read first); otherwise verify via type-check + build + the visual pass (server action with Supabase deps — no new test harness in this plan).

**Behavior:**
- In `findFirstLeads`: `const plays = matchStarterPlays({ industry, icp })`; if the account has NO `optimization_playbook` row → upsert `{ champion_strategy: plays[0].strategy, version: 1 }`; then `startExperiment` equivalent insert: stage `"acceptance"`, champion = plays[0].strategy, challenger = `proposeNextChallenger("acceptance", plays[0].strategy)`, ignore unique-conflict. From day one: playbook seeded + a live test running. (Copy path already loads champion+experiment — `copy-draft.ts:82-100` — so this is live immediately.)
- Wizard, scan payoff ("What we learned", `wizard.tsx:637` region): under the existing headline + best-fit buyer line, add the matched play preview card: eyebrow **"Your first play"**, play name + one-line description + `SOURCE_LABEL[source]` chip. Client gets plays via a small serializable helper (matcher is pure — import directly in the client component; agent-brains is already a workspace dep of web? VERIFY at execution — if not, re-export the matcher through an existing web-safe path or add the workspace dep).
- Step 1 (Connect), replacing the abstract "We found your buyer" body: **"Vera is ready. Here are the plays she'll run for {icp} — connect LinkedIn to turn them on."** + the 3 matched play names as compact rows with source chips. Keep trust bullets + cost-stating opt-out untouched.
- Step 2 deploy CTA: "Find my first leads" → **"Put Vera to work"**; running label → **"Vera is going to work…"**; explainer sentence append: **"She starts on proven plays and gets sharper from your results."**
- Rail payoff card "Your first leads land" → **"Vera goes to work"** (body unchanged).

- [ ] Steps: read current files → implement → `pnpm --filter web type-check && pnpm --filter web lint` → build → commit — `feat(onboarding): seed Vera's playbook + first live test; proven-play surface before the connect ask`

---

### Task 5: "What's working" — rename, autonomy copy, Overview presence

**Files:**
- Modify: `apps/web/src/app/(app)/analytics/outreach-diagnosis.tsx`
- Modify: `apps/web/src/lib/optimize.ts` (extend `OutreachDiagnosisVM` with `lastAdoption?: { label: string; reason: string; concludedAt: string } | null` — query most recent status='adopted' experiment; label via existing `describeStrategy`)
- Modify: `apps/web/src/app/(app)/analytics/optimize-actions.ts` (ADD `revertAdoption(formData)` — set playbook champion ← that experiment's `champion_strategy`, version+1; keep legacy adopt/discard for legacy `ready_to_adopt` rows)
- Modify: `apps/web/src/app/(app)/dashboard/dashboard-view.tsx`

**Copy spec:**
- Panel eyebrow "Optimization" → **"What's working"**. Status chips unchanged.
- Running state body → "Vera is trying **{challengerLabel}** on a slice of new drafts, measured against your current approach. She keeps it only if it genuinely wins, stops it instantly if it ever hurts, and you approve every send either way."
- NEW adopted state (from `lastAdoption`): eyebrow **"Adopted"** — "**{label}** won its test and is now your default. {reason}. Rolled back automatically if results ever slip." + quiet "Revert" button → `revertAdoption`.
- Offer state ("Or let the agent test a fix") → "Vera tests improvements on a small slice of new drafts on her own and keeps only what genuinely helps, with a hard stop if it ever backfires." Button stays (manual accelerant).
- Legacy `ready_to_adopt` rows keep today's Adopt/Keep UI.
- **Overview:** in `WorkingDashboard`, insert a compact **WhatsWorkingStrip** (eyebrow "What's working" + one line: running-test label OR last-adoption line + "See the numbers" → `/dashboard?view=analytics`) above the two-up AgentsPanel/WarmReplies row. In `FirstRunInProgress` and `ActivationRamp`, add the **proven-plays block**: "While Vera sources your first buyers, here are the plays she's running for {icp}" + 3 play cards (name, description, source chip) via `matchStarterPlays`.

- [ ] Steps: read files → implement → type-check/lint/build → commit — `feat(dashboard): What's-working panel with autonomous-adoption display + proven plays fill the waiting states`

---

### Task 6: Brain identity sweep (nav, agents, celebrations, settings)

**Files & exact changes:**
- `apps/web/src/components/dock-nav.tsx`: tooltip label "System" → **"Brain"** (route unchanged).
- `apps/web/src/app/(app)/agents/agent-showcase-data.ts`: append learning beats — scout live summary + "…and it keeps learning which buyers actually convert."; copy live summary + "…keeping the messages that work and dropping the ones that don't."
- `apps/web/src/app/(app)/agents/page.tsx` header sub: append "It starts on proven plays and gets sharper every week."
- `dashboard-view.tsx` `ReplyCelebration` body append: "This thread started from a play Vera is running." (present-tense-honest; no per-message attribution exists yet — Stage 1).
- `apps/web/src/app/(app)/settings/proof/page.tsx` header sub append: "These are the only facts Vera is allowed to prove with."

- [ ] Steps: implement → type-check/lint/build → commit — `feat(app): Vera identity sweep — Brain nav, learning beats, celebration tie-back, proof framing`

---

### Task 7: Knowledge-sync + full gate + visual re-verification

- [ ] NEW `packages/help-content/content/optimize-whats-working.md` (frontmatter per existing articles — read one first): what "What's working" shows, how Vera tests/adopts/rolls back, the safety envelope in user words, how to revert, where plays come from (honest sourcing).
- [ ] Grep existing help articles for stale "suggest-only"/"adopt as default" copy → update.
- [ ] Full gate: `pnpm lint && pnpm type-check && pnpm test && pnpm build` at repo root → green.
- [ ] Visual re-verification (screenshot harness from the marketing QA): onboarding Step 1 + scan payoff (client-side rendering of plays), dashboard states — authenticated app screenshots require a dev login; if a dev account works against the dev Supabase, capture Overview + analytics; otherwise verify by rendering-level tests + build and flag the residual to the owner honestly.
- [ ] Commit — `docs(help): What's-working article + stale-copy sync (knowledge-sync rule 09)`

---

### Task 8 (LAST — flag before starting): Positive content memory

Spec lists it in Stage 0; it is the largest and riskiest piece (new embeddings table + RLS + pipeline write on positive outcomes + retrieval in the copy path). **Recommendation to owner: ship Tasks 1–7 as the Stage-0 production gate, build content memory immediately after as Stage 0.5** — the visible/truthful promise ("starts proven, improves automatically, visibly, safely") stands entirely on Tasks 1–7, and rushing an embeddings pipeline into the send path is the one place "production ready" could be compromised. If the owner insists it ships in Stage 0, design lands as its own plan (per-account memory ONLY — raw message text never crosses tenants; collective learning stays at strategy level).

## Ops notes (deploy-time, not build-time)

- Migration 0048 (7-day trial) applies to prod with this merge; **no new migrations** in Tasks 1–7.
- `packages/jobs` changes require a Trigger.dev prod deploy at ship time (rule 10).
- Existing accounts with no playbook: aiden's own account gets seeded by clicking "Start the test" once, or a one-off backfill after merge (owner call; new accounts are covered by onboarding).
