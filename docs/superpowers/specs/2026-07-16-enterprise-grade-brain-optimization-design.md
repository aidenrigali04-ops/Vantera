# Enterprise-Grade Brain — the 10/10 optimization spec

**Status: GREEN-LIT v1.0 (2026-07-16, owner approval — "proceed and start spec
implementation"). Revisit by name: "enterprise-grade-brain".**

Method: YC-head-executive comparison/optimization (standing directive). Grounded in the
2026-07-16 dual code audit (brain/statistics audit + engineering-quality audit); every
mechanism below names the real file/symbol it changes. Analysis source of truth: the audit
scorecard.

**The unifying insight:** every sub-10 grade is the same defect at a different layer — *the
system cannot yet prove its own claims*. Wins aren't statistically proven (peeking + biased
test), copy quality isn't eval-proven (no harness, unversioned prompts), ships aren't
proven live (manual promote/curl), adaptivity isn't proven calibrated (never fired, no A/A),
and value isn't proven to the meeting (0 booked, booking links unset). The spec's spine is
**provability**: after this program, every claim Vantera makes about itself — internally in
the decide loop and externally in What's-working — is backed by a measurement that would
survive a hostile reviewer.

**The scorecard this spec retires:**

| Dimension | Now | What "10" means (exit criterion, measured not asserted) |
|---|---|---|
| Engineering discipline | 8.5 | No manual step between merge and verified-live; both historical outage classes (Vercel pin, Trigger schedule quota) structurally impossible; schema drift check in CI |
| Brain architecture | 7.5 | All three brains stamped; one adoption code path; thresholds configurable with hard safe bounds; every adoption carries a holdout receipt |
| Statistical soundness | 4.5 | Anytime-valid decisions (immune to daily peeking); CI simulation proves false-adoption ≤ 5% under null; stage-scoped attribution; no unshrunken small-n estimate anywhere |
| AI eval/governance | 2 | No prompt/model/copy-logic change merges without eval evidence; every generation attributable to promptHash + modelId; judge calibrated vs human labels (κ ≥ 0.7) |
| Adaptivity in practice | 3 | ≥ 1 autonomous adoption that survives holdout validation; live A/A canary never false-adopts; experiment panel shows projected conclusion dates |
| Realized output value | 2 | Meetings-booked is a lit north-star metric; interested→booked path wired for every account; activation stalls trigger automated recovery |

---

## Sequencing — four phases, three gates (the spine)

| Phase | Ships | Gate to proceed |
|---|---|---|
| **GATE 0 — safety flip** (day 1, tiny diff) | Autonomous adoption → suggest-only; live A/A canary starts | None. Ships before everything: the current gate is biased toward adopting and re-tests daily without correction — it must not write playbooks while we rebuild it. |
| **Phase 1 — foundations** (parallel) | WS-4 CI kills (drift check, post-deploy verify, schedule preflight); WS-2 prompt registry; WS-1 simulation suite | None between items — all independent. |
| **Phase 2 — core rebuild** | WS-1 anytime-valid decision core + stage attribution + shrinkage; WS-3 stamp all brains; WS-2 eval harness + golden sets | **GATE 1:** sim suite green in CI (false-adoption ≤ 5% under null, power ≥ 80% at design MDE) AND eval CI live → autonomous adoption re-enabled through the unified gate. |
| **Phase 3 — proof** | WS-1 holdout + auto-revert; WS-5 experiment health panel; WS-6 meetings loop | **GATE 2 ("the 10 claim"):** re-run the audit scorecard with evidence per exit criterion. Grades are re-measured, never self-asserted. |

Principle carried throughout: **safety checks may be biased toward stopping; adoption checks
must be unbiased.** (The circuit breaker keeps its conservative asymmetry; the adoption test
loses its optimistic one.)

---

## WS-1 — Statistical core (soundness 4.5 → 10)

The audit findings this retires: daily peeking with fixed z=1.96 and no sequential
correction; asymmetric adoption test (challenger Wilson-low vs champion *point*,
`decide.ts:95`); n=30/arm with 3pp floor deep inside binomial noise; no multiplicity
control across chained experiments × 6 bandit candidates; first-touch recipes credited with
downstream booked/converted outcomes (`pg-store.ts:985`); flat signature pooling collapsing
account/industry/stage (`bandit.ts:22`); raw n=8 tilt rates with correlated
seniority+industry double-counting (`tilt.ts`); no holdout anywhere.

### 1.1 Anytime-valid decision core (replaces the Wilson gate in `decide.ts`)

- Each experiment runs a **two-arm e-process** (beta-binomial mixture test martingale over
  the per-stage success/denominator stream from `outcomes.ts`). E-processes are valid under
  continuous monitoring by construction — the daily cron can look every day forever without
  inflating error. **Adopt** when e ≥ 1/α (α = 0.05 → e ≥ 20) AND posterior median uplift
  ≥ `minEffectPp` AND posterior expected loss of adopting < 0.5pp (utility cap so tiny-n
  adoptions can't cost real acceptance rate). **Discard** on the mirrored e-process.
- **Circuit breaker stays first and stays conservative** — its Wilson-low harm check at
  n ≥ 15 is a safety brake and is allowed to be biased toward halting. Unchanged semantics,
  documented rationale inline.
- **Multiplicity:** an **alpha-investing ledger** per account experiment chain
  (`optimization_experiments` gains `alpha_wealth numeric`): start at 0.05, spend on each
  launched experiment, earn back on discards per generalized-alpha-investing rules. The
  chained generate→gate→bandit loop (`optimize.ts:31` `chainNext`) can then run indefinitely
  with family-wise error controlled — the current unbounded chain is the single biggest
  false-discovery amplifier in the system.
- `decideExperiment` keeps its suggest-only contract (`decide.ts:12-13`); all thresholds
  move to config (WS-3.3) with hard bounds in code.

### 1.2 Stage-scoped attribution (kills the leakage)

Prerequisite: WS-3.1 stamps all three brains. Then replace the first-touch-gets-everything
join in `getStampedOutcomes` (`pg-store.ts:985`) with a `recipe_stage_outcomes` view:
- acceptance outcomes → the invite's recipe (as today);
- reply-stage outcomes (interested / not_interested) → the recipe of the **conversation
  message immediately preceding** the classified reply;
- booking outcomes → the recipe of the last message before the booking event.
A first-touch knob can then never be credited with a close another brain earned, and
`aggregateArm` (`outcomes.ts:47`) reads stage-native denominators unchanged.

### 1.3 Hierarchical shrinkage pooling (replaces flat signature pooling)

`aggregateBySignature` (`bandit.ts:22`) currently pools by strategy signature alone across
all accounts. Replace with empirical-Bayes shrinkage: each signature's rate is shrunk toward
its (account, stage) baseline, then toward the global stage baseline, with `m` pseudo-
observations (default m = 25, tuned by the sim suite). The Thompson draw
(`chooseChallenger`, `bandit.ts:74`) samples from the shrunk Beta. Cross-account sharing
formalizes the privacy floor (WS-3.5): a signature enters the shared prior only at
k ≥ 3 contributing accounts and ≥ 100 pooled sends.

### 1.4 Tilt shrinkage + de-correlation (`targeting/tilt.ts`)

- Segment rates get the same m = 25 pseudo-observation shrinkage toward the account baseline
  before the point-delta math at `tilt.ts:78` — an 1/8 lucky segment can no longer earn
  near-max tilt.
- Correlated-signal fix: a lead's tilt takes the **max** of its seniority and industry
  contributions, not the sum (they are correlated measurements of the same lead, not
  independent evidence). `TILT_CAP = 5`, `SEGMENT_FLOOR = 8`, and ordering-only semantics
  (`rankByTilt`) all stay — the containment design was right.

### 1.5 Permanent holdout + auto-revert (the realized-lift receipt)

- A sticky 10% of each account's leads (FNV-1a hash, same pattern as `allocate.ts:38`)
  form the **holdout**: on adoption they stay on the *prior* champion for 21 days.
- Realized lift = adopted-arm vs holdout, judged by its own e-process. Holdout contradicts
  the adoption → automatic `revertAdoption` (`optimize-actions.ts:84` logic promoted into
  the jobs layer) + reason persisted + admin email. Holdout confirms → the lift figure (with
  interval) becomes the What's-working receipt (WS-6.5).
- This is the train/test separation the audit found missing, expressed operationally.

### 1.6 Power ledger (honesty about what can conclude)

On `startExperiment`, compute required n for the configured MDE at the champion's base rate;
persist `projected_conclusion_at`. Projection > 45 days → the experiment is either launched
**pooled cross-account** for that stage (WS-5.1) or not launched, with the reason surfaced
in the experiment panel. No more experiments that can structurally never finish.

### 1.7 Simulation suite (CI-gated proof of calibration)

`packages/agent-brains/src/optimize/sim/` — seeded, pure-TS monte-carlo (fast, no LLM):
- **A/A null:** 2,000 simulated experiments with identical arms through the full decision
  core (breaker + e-process + alpha ledger) → assert adoption rate ≤ 5%.
- **Power:** assert ≥ 80% detection of a true 5pp lift at the ledger's projected n.
- **Breaker latency:** assert harm scenarios halt within the documented window.
Wired into `ci.yml` `verify` alongside the existing vitest run. This suite is also where
m (shrinkage) and α parameters get tuned — constants earn their values.

### 1.8 Live A/A canary

One always-running A/A experiment (identical arms) on the founder account. Any adopt signal
from it → admin alert + global flip of autonomous adoption back to suggest-only. The live
counterpart of 1.7: continuous proof the machinery doesn't hallucinate winners.

**WS-1 exit evidence:** sim suite green in CI; `recipe_stage_outcomes` view live; A/A canary
running ≥ 14 days with zero adopts; no raw-rate small-n estimate reachable from decide, bandit,
or tilt paths.

---

## WS-2 — Eval harness & AI governance (2 → 10)

The audit findings this retires: zero eval assets (no golden set, no judge, no prompt
regression — confirmed exhaustively); prompts as unversioned inline constants
(`LINKEDIN_SYSTEM` `copy/linkedin.ts:37`, `GENERATE_SYSTEM` `optimize/generate.ts:40`,
`FIX_SYSTEM`, `RANK_SYSTEM`, …) with no way to attribute an outcome shift to a prompt
revision; model swaps gated by nothing.

### 2.1 Prompt registry (identity without breaking prompt caching)

`packages/ai/src/prompts/registry.ts`: every system prompt is registered and exported with a
build-time content hash. **Prompt text stays a stable string constant** — the hash is
metadata, so Anthropic prompt caching (the reason the constants are stable,
`generate.ts:40` comment) is untouched. `SendRecipe` v2 (WS-3.4) stamps `promptHash` +
`modelId` into every send; eval runs key on the same hash. A test asserts every
`generateObject`/`generateText` call site sources its system prompt from the registry
(same enforcement pattern as `single-entry.test.ts`).

### 2.2 Golden sets

New workspace package `packages/evals`. Per-brain fixture corpora (50–150 anonymized
prod-derived cases each): `copy/linkedin`, `reply/classify`, `reply/respond`, `rank`,
`derive-criteria`, `intent/classify`. Anonymization is a fixture-build step (names/companies
swapped to fictional per the standing integrity rule), reviewed once by the owner.

### 2.3 Three-layer graders

1. **Deterministic** — reuse the existing humanizer/grounding lints verbatim (they are
   already excellent format gates; `humanizer.ts:111`, `findUngroundedClaims:233`).
2. **LLM-judge rubric** — specificity, them-focus, posture, naturalness; judge model pinned
   + judge prompt itself versioned in the registry. **Judge calibration:** 100 human-labeled
   pairs (owner labeling session, ~1–2h); a judge version is trusted only at Cohen's
   κ ≥ 0.7 vs those labels, re-calibrated on any judge prompt/model change. An uncalibrated
   judge gates nothing — this is what separates a real eval harness from vibes-as-a-service.
3. **Pairwise win-rate** — candidate drafts vs frozen baseline drafts (position-swapped to
   kill order bias); merge bar is non-inferiority (win-rate ≥ 48%).

### 2.4 CI + nightly wiring

`evals.yml`: path-triggered on `packages/agent-brains/src/{copy,reply,optimize}/**`,
`packages/ai/**`. Merge gate: deterministic 100% pass, pairwise non-inferiority, classifier
floors (2.5). Nightly full run appends to an `eval_runs` table → trend surface in the admin
panel. Cost-bounded (~$2–5/run, prompt-cached); budget is an owner dependency.

### 2.5 Classifier floors

Labeled sets for `reply/classify` and `intent/classify` with hard floors in CI:
interested-recall ≥ 0.90 (a missed interested reply is the most expensive error in the
product), needs_human-precision ≥ 0.85.

### 2.6 Model-upgrade protocol

`ANTHROPIC_MODEL` change = full eval suite + 48h **shadow generation** (live traffic drafts
generated-but-not-sent under the candidate model, pairwise-judged vs current) before flip.
The env-var override (`client.ts:3`) stops being an ungated production lever.

### 2.7 Drift monitors

Weekly cron samples 50 live drafts → judge scores, lint-violation rate, regeneration rate as
time series; 2σ drift → admin alert. Catches silent quality decay between code changes
(upstream model updates, data distribution shifts).

**WS-2 exit evidence:** a deliberately-degraded prompt PR is blocked by CI (test the gate by
firing it); every send row carries promptHash + modelId; judge κ documented.

---

## WS-3 — Brain architecture (7.5 → 10)

The audit findings this retires: only `first_touch` ever stamped despite the enum supporting
three brains (`recipe.ts:11` vs `copy-draft.ts:130`); two divergent adoption paths
(autonomous `adoptChallenger` from `running` vs manual button requiring `ready_to_adopt` the
autonomous path never sets — `pg-store.ts:1063` vs `optimize-actions.ts:47`); compile-time
constants for thresholds; hardcoded `allocationPct 25`/`minSample 30` (`pg-store.ts:1114`).

1. **Stamp all three brains.** Emit `SendRecipe` with `brain: "conversation_reply"` at the
   reply-respond send site and `brain: "sequence_followup"` in the sequence path, mirroring
   the `copy-draft.ts:130-151` pattern. This is the prerequisite for WS-1.2 attribution and
   for the reply-stage experiments the power ledger will route to.
2. **One adoption gate.** The autonomous path sets `ready_to_adopt` + reason; adoption then
   auto-fires after a 24h grace window (per-account config: `auto | manual`), through the
   single `adoptChallenger` call site. The owner button and the cron converge on identical
   gating; the divergence the audit flagged is gone.
3. **Config over constants.** `DECIDE_DEFAULTS`, allocation pct, exploration share, tilt
   caps → an `optimization_config` app-settings row with **hard safe bounds enforced in
   code** (e.g., allocation 10–50%, exploration floor ≥ 25%). Misconfiguration cannot
   produce an unsafe loop; tuning no longer requires a deploy.
4. **SendRecipe v2.** Adds `promptHash`, `modelId`, `stage`, and a `sendDaypart` timing knob
   (the Stage-3 timing dimension enters the recipe space cheaply). `v: 2`; v1 rows stay
   readable; the honesty rule (never backfill) carries over.
5. **Collective-brain contract.** Cross-account priors: knobs + outcome booleans only
   (already true — `pg-store.ts:985` comment), now plus the k ≥ 3 accounts / ≥ 100 sends
   floor from WS-1.3, encoded as a test the same way tenancy is (`schema.test.ts` pattern).

**WS-3 exit evidence:** recipe coverage report shows all three brains stamping in prod; one
grep-able adoption call site; constants file contains only bounds, not values.

---

## WS-4 — Engineering discipline (8.5 → 10)

The audit findings this retires: no CI migration apply / drift check (documented open,
`docs/production-readiness.md:15,27`); manual promote + curl proofs (Vercel-pin outage
class); Trigger schedule-quota outage class (11th schedule broke every deploy for ~16h); web
tsconfig not extending base (loses `noUncheckedIndexedAccess`); no coverage floor;
single-operator hardcoding (`LIFECYCLE_ADMIN_EMAIL`, founder copy in `lifecycle-copy.ts`);
manual weekly failure review.

1. **Migration CI + drift check.** On merge to main: apply `packages/db/migrations/` to prod
   (creds as GH secrets — owner dependency), then a drizzle-kit diff that fails if live
   schema ≠ migrations. Also permanently closes the "applied via MCP only" drift class (the
   auth-metadata triggers incident).
2. **Post-deploy verification.** `/api/version` returns the git SHA; `postdeploy-verify.yml`
   asserts the production domain serves the new SHA (kills the pin class — no more manual
   promote-and-curl) and asserts the latest "Deploy to Trigger.dev (prod)" run succeeded
   whenever `packages/jobs` changed (kills the silent-skip class the CI-audit incident
   exposed).
3. **Schedule-quota preflight.** CI statically counts `schedules.task(` registrations; > 10
   fails the build with the piggyback-on-agent-scheduler instruction in the error message.
   The outage class becomes a compile error.
4. **Coverage ratchet.** Vitest v8 coverage with per-package floors frozen at current levels,
   ratchet-only-up. No coverage theater — just no silent regression.
5. **Web tsconfig extends base.** `apps/web/tsconfig.json` gains `noUncheckedIndexedAccess`
   parity; fix the fallout (bounded, mechanical).
6. **Operator config.** `LIFECYCLE_ADMIN_EMAIL` (`lifecycle-outreach.ts:26`) and the founder
   lifecycle copy move to an `operator_settings` row — removes the last single-tenant
   coupling in an otherwise test-enforced white-label codebase.
7. **Nightly synthetic.** One Playwright happy path on a sentinel account against prod
   (login → dashboard renders → review queue → agents page shows agent_runs); failure emails
   admin. First true e2e in the repo, deliberately minimal.
8. **Failure-rate alert.** Daily task reads Trigger run stats; failure rate > 10% → admin
   email. Replaces the manual weekly runbook review.

**WS-4 exit evidence:** a merge with a jobs change reaches verified-live with zero human
actions; an intentionally drifted schema and an 11th schedule each fail CI (fire both once).

---

## WS-5 — Adaptivity in practice (3 → 10)

The audit findings this retires: the loop has never concluded a live experiment; per-account
volume (~100 invites/wk) can't power per-account reply/booking experiments; the loop is a
black box between daily crons.

1. **Pooled experiments where n demands it.** The power ledger (WS-1.6) routes underpowered
   stages to cross-account pooled experiments (shrinkage-aware, WS-1.3) instead of launching
   doomed per-account ones. The founder-account reveal pilot (F0, reveal-freemium spec) is
   deliberately the first live experiment through the rebuilt core — one spine, not two
   programs.
2. **Experiment health panel** (analytics surface): per experiment — n/arm, e-value
   trajectory, posterior lift, projected conclusion date, alpha-wealth remaining. The owner
   sees *why* the loop hasn't concluded, or when it will.
3. **Calibration proof** = the live A/A canary (WS-1.8) at ≥ 14 days clean.
4. **Adoption receipts.** What's-working shows holdout-measured lift with an interval, only
   after the 21-day validation window — the brain's public claims obey the same evidence
   bar as its internal decisions.

**WS-5 exit evidence:** ≥ 1 autonomous adoption survives holdout validation; A/A clean;
panel live with real trajectories.

---

## WS-6 — Realized output value (2 → 10)

The audit findings this retires: 10 interested → 0 meetings; 0/3 booking URLs set; the one
external activation (16-minute flawless pipeline) died at the review queue with no recovery
touch; no meetings north-star.

1. **Booking-link enforcement.** Campaign launch blocks until the account's `bookingUrl` is
   set (keeping L1's honest escape hatch); backfill task card already exists — this adds the
   gate. Owner sets his own link (dependency, blocks F0 too).
2. **Drafts-ready pull-back email.** `createLeadEventNotifier` gains a `drafts_ready` event:
   review queue goes 0 → N and the user has been absent ≥ 2h → one email deep-linking to the
   review queue. This is the exact missing touch where the first external activation died.
3. **Mobile approval flow.** The stall was on Android: single-thumb approve in the mobile
   review queue; surface the existing clean-only bulk approve there.
4. **North-star dashboard.** Meetings booked weekly + the full cohort funnel
   (connect → launch → accept → reply → interested → booked) with stage benchmarks; the
   interested→booked conversion gets an owner alert when it sits at zero with n ≥ 5 — the
   "10 interested → 0 meetings" failure becomes a monitored metric that pages someone.
5. **Value receipts.** User-facing lift claims are holdout-backed only (WS-1.5) — "never low
   quality" applied to the product's own marketing of itself.

**WS-6 exit evidence:** first meeting booked through the wired path; pull-back email
measurably recovers a stalled activation; funnel dashboard live with real cohorts.

---

## The never-low-quality contract (cross-cutting, non-negotiable)

Every workstream lands under the same definition of done:
1. **TDD** per the repo's standing skill; sim/eval evidence for anything statistical or
   generative — constants earn their values in the sim suite, prompts earn their merges in
   the eval harness.
2. **Live proof** per the prod-ops rule: until WS-4.2 ships, every prod ship ends with the
   curl proof + Trigger deploy check; after WS-4.2, CI does it and a human spot-checks GATE
   re-audits.
3. **No silent caps** — anything bounded (top-N, sampling, floors) logs what it dropped.
4. **Gates are measurements.** GATE 1 and GATE 2 are evidence reviews against the exit
   criteria tables above, not vibes. The scorecard is re-graded only from that evidence.
5. **Suggest-only until proven.** No autonomous adoption between GATE 0 and GATE 1. The
   loop's authority is restored exactly when its calibration is demonstrated, not before.

## Owner dependencies (blocking, in order of urgency)

1. **GH secrets for prod DB** (WS-4.1 migration CI) — without them the drift check stays the
   documented dead letter it is today.
2. **His booking link** — blocks WS-6.1 hard-gate rollout and the F0 pilot alike.
3. **RESEND creds verified in Trigger prod** — WS-6.2 pull-back email rides the same rail as
   L3; still unverified.
4. **Eval budget sign-off** (~$50–100/mo at nightly cadence) and one ~1–2h judge-calibration
   labeling session (WS-2.3).

## Costs & honest risks

- **Validity is slower than optimism.** The e-process + expected-loss core will conclude
  more slowly than the current (invalid) gate, especially per-account. That is the real
  price of true claims; the power ledger and pooled experiments are the mitigation, and the
  panel makes the wait legible instead of dark.
- **Judge risk.** An uncalibrated LLM judge is a new source of confident noise — hence the
  κ ≥ 0.7 human-calibration gate before any judge verdict gates a merge.
- **Golden-set staleness.** Fixtures decay as the product's voice evolves; nightly drift
  monitoring plus a quarterly fixture refresh (owner-reviewed) is the maintenance contract.
- **`noUncheckedIndexedAccess` fallout in web** is mechanical but nonzero; budgeted inside
  WS-4.5, not allowed to leak scope.

## Grade math (which workstream retires which gap)

| Dimension | 10 delivered by |
|---|---|
| Engineering 8.5 → 10 | WS-4 (all eight items; the two outage classes die in CI) |
| Brain architecture 7.5 → 10 | WS-3 (stamping, one gate, config-with-bounds, recipe v2) |
| Statistical soundness 4.5 → 10 | WS-1 (anytime-valid core, attribution, shrinkage, holdout, sim proof) |
| Eval/governance 2 → 10 | WS-2 (registry, golden sets, calibrated judge, CI gate, drift) |
| Adaptivity in practice 3 → 10 | WS-5 standing on WS-1/WS-3 (pooling, panel, A/A, first proven adoption) |
| Realized output value 2 → 10 | WS-6 (booking gate, pull-back, mobile approve, north-star, receipts) |
