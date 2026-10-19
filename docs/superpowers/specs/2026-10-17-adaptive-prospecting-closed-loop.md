# Adaptive Prospecting — Closed-Loop Spec (v1)

- **Date:** 2026-10-17
- **Owner:** Aiden (solo owner driving the build)
- **Status:** spec for build — hand to Cursor, phase by phase
- **This file:** `docs/superpowers/specs/2026-10-17-adaptive-prospecting-closed-loop.md`
- **Its plan:** `docs/superpowers/plans/2026-10-17-adaptive-prospecting-A1-instrumentation.md` (phase A1)
- **Its production wiring:** `docs/superpowers/specs/2026-10-17-adaptive-prospecting-production-wiring.md` (agent kind, UI, bootstrap)
- **Supersedes nothing; extends:** `docs/superpowers/specs/2026-06-29-self-optimizing-outreach-design.md` (the online loop) and the research hive (`packages/agent-brains/src/research/*`).

---

## 0. The goal, stated as an acceptance test

For each account, **real booked meetings per 100 sourced on LinkedIn goes up over time**, safely, with:
- no hallucinated gains (every claimed improvement is a decided randomized experiment on that account's real traffic),
- no degradation of the live pipeline (suppression, LinkedIn safety limits, and a do-no-harm circuit breaker are never bypassed),
- graceful behavior for low-volume accounts (the long tail must still work).

**`ofOracle` is NOT a success criterion for this work.** It measures how well the hive climbs its own *synthetic* hill (`world.ts` plants the gene effects; its own header: *"Every range below is an assumption, not Vantera data"*). Success here is real per-account outcomes adjudicated by `decide-v2`.

---

## 1. The one architectural idea

Two systems already exist. Wire them into one loop with a strict division of labor:

| System | Role | What it's good at | What it must NOT do |
|---|---|---|---|
| `research/` (the hive) | **Imagination / proposer / prior** | Explores the full 21-gene strategy space fast, over synthetic worlds. Output is a *hypothesis*. | Decide anything real. Its governor judges fiction. |
| `optimize/` (`decide-v2`, `alpha`, `allocate`, `bandit`, `funnel`, `eprocess`) | **Reality / adjudicator** | Randomizes real leads across arms; decides winners on real outcomes with anytime-valid e-values, per-account alpha-investing, and a do-no-harm circuit breaker. | Discover multi-lever strategies on its own (it's one-knob, leak-driven). That's the hive's job. |

**Causal truth comes only from randomized online experiments.** A gene's *real* effect is estimated **only** from a randomized experiment arm (`allocate.ts` already assigns arms by a stable hash of `experimentId+leadId`), never from observational genome stamps — the hive *chose* those strategies, so they're confounded. `calibrate.ts`'s base-rate fit is the warm-start; measured gene effects accrue **one adopted experiment at a time**.

"Free exploration" (your "free will") belongs upstream, in sim, at zero real-world cost. The real "final judge" is `decide-v2` reading real outcomes — not the hive's governor.

---

## 2. The loop (per account, on a Trigger.dev cadence)

```
1. WARM-START   calibrate.ts fits this account's six funnel base rates from its real cohort
                → store fitted WORLD_RANGES for the account. checkHoldout watches sim-vs-real drift.
                Gene-effect priors = measured (if any) → else global/segment → else sim prior.
        │
2. PROPOSE      Hive runs on the account's CALIBRATED worlds (releaseWorldCache between accounts).
                Emits: (a) ranked shortlist of full-genome strategies, and
                       (b) the single highest-EV change to test next — ≤ MAX_CHANGES (3) genes,
                           FILTERED TO WIRED GENES ONLY (arenas.ts `wired`), because reality can
                           only apply wired genes to live sends.   ← deliberator LLM stays OFF
        │
3. ADJUDICATE   That change becomes a challenger experiment vs the current champion.
                allocate.ts randomizes real leads → both arms run live → outcomes.ts rolls up
                per-arm VariantOutcome → decide-v2 (e-value) + alpha.ts (per-account wealth) +
                circuit breaker (FIRST) decide: adopt / discard / keep_running.
                Suppression + LinkedIn safety limits enforced on every send in both arms.
        │
4. LEARN        ADOPT  → the arm's measured delta is written as a MEASURED gene effect
                        (account-level, and aggregated into a global/segment prior); the
                        challenger becomes the new champion; the hive's library records a win.
                DISCARD → updates the prior down; hive library records a loss.
                Either way, the hive next cycle proposes against better-grounded worlds.
        │
5. COLD-START   Accounts below MIN_STAGE_SAMPLE (20) can't reach per-account significance.
                They inherit global/segment priors (empirical-Bayes shrinkage, un-pooling as n
                grows) and run the fixed best-practice catalog (recommend.ts) until they have data.
```

This is a flywheel: reality teaches the sim (measured effects replace assumed ones), the sim proposes smarter, reality decides again.

---

## 3. Reuse — do NOT rebuild

Inspect and extend these before writing anything new:

- **Online decision engine:** `packages/agent-brains/src/optimize/{funnel,diagnose,recommend,experiment,allocate,decide,decide-v2,eprocess,alpha,bandit,outcomes}.ts`. The e-value gate, alpha-investing wealth, stable allocation, circuit breaker, and outcome rollup already exist and are unit-tested. `MIN_STAGE_SAMPLE=20` is the trust gate everywhere.
- **The hive:** `packages/agent-brains/src/research/{governor,brains,proposal,evaluator,calibrate}.ts` + `hive/{arenas,genome}.ts`, `hive/sim/world.ts`. `MAX_CHANGES=3`, paired evaluation, the sealed-oracle integrity flag, harm pricing, and the `wired` gene flag all stay exactly as they are.
- **Existing experiment/stamp tables from the 2026-06-29 self-optimizing-outreach phase.** `bandit.ts` already consumes per-account "recipe stamps" and `outcomes.ts` builds `LeadOutcomeFlags` from the lead row + replies. **Extend these to the full genome — do not create a parallel system.** Read the migrations from that phase first.
- **Product plumbing:** Scout→Copy pipeline (`packages/jobs/src/pipeline/*`), `scheduled_sends`, `outreach_sends` (audit), reply classification, the suppression gate (rule 11), `agents.config` jsonb, RLS (rule 02), Trigger.dev crons (rule 08).

---

## 4. Data model (new/extended — RLS in the same migration, rule 02; retention note, rule 11)

If any of these already exist from the self-optimizing-outreach phase, **extend; don't duplicate.**

- `strategies` — `account_id`, `signature` (unique per account; sorted genome signature), `genome` jsonb (one genome per arena), `source` (`hive` | `experiment` | `manual` | `default`), `created_at`. Dedup by signature.
- `lead_strategy_stamp` — `account_id`, `lead_id`, `strategy_id`, `experiment_id` (nullable), `arm` (`champion`|`challenger`|null), `stamped_at`. Written at lead entry; the causal-attribution substrate. (Retention: tie to lead retention.)
- `gene_effect_estimate` — scope (`account_id` or `global`/segment key), `arena`, `gene`, `value`, `effect_by_stage` jsonb (logit deltas), `n`, `ci_low`/`ci_high`, `source_experiment_id`, `updated_at`. **Only written from a decided randomized arm that cleared the sample gate.** This is what feeds `world.ts`/`calibrate.ts` the measured (not assumed) effects.
- Per-account calibration state (fitted `WORLD_RANGES` + last holdout status): store on `agents.config` jsonb for the relevant agent, or a small `account_calibration` row. Documented in the migration comment (rule 13 — no one-off columns).

---

## 5. Phases — each is one PR = one roadmap checkbox, TDD, full gate green

Slot as a new roadmap block in `docs/roadmap.md` (e.g. "Phase 14 — Adaptive prospecting (closed loop)"). Build in order. **Write the guardrail tests first** (section 7) — they are the contract.

### A1 — Instrumentation (no behavior change; just record truth)
- **Build:** `strategies` + `lead_strategy_stamp` tables (migration + RLS + guardrail test). Stamp every lead at entry with the strategy that produced it. Extend `outcomes.ts`/`funnel.ts` to roll up a per-account, per-cohort `FunnelCohort` (the shape `calibrate.ts` already expects) and a per-arm `VariantOutcome`. All rollup logic pure in `agent-brains`/`optimize`; DB only in the jobs store.
- **DoD:** migration committed; RLS test; a test proving every lead that enters outreach has exactly one stamp; help article stub; `rls-auditor` pass.
- **Full plan:** `docs/superpowers/plans/2026-10-17-adaptive-prospecting-A1-instrumentation.md`.

### A2 — Per-account calibration job
- **Build:** a Trigger.dev cron (thin wrapper → pure core, rule 13) that, per account with enough cohort data, runs `calibrate.fitRanges` and stores fitted `WORLD_RANGES` + the `checkHoldout` status (drift monitor). `releaseWorldCache()` between accounts.
- **DoD:** pure core unit-tested with fake cohorts (fitted vs thin → assumed); drift status persisted; no account below the sample gate gets a fitted range (prior stands); help article.

### A3 — Proposer bridge (hive → candidate)
- **Build:** a pure module `research/propose-for-account.ts` that takes an account's calibrated worlds + current champion, runs the hive (deliberator OFF), and returns `{ shortlist: Strategy[], nextTest: Proposal }` where `nextTest` changes ≤3 genes and is **filtered to wired genes only**. No DB, no Trigger — injected inputs (rule 13; keeps `purity.test.ts` green).
- **DoD:** tests prove `nextTest` is always ≤ MAX_CHANGES and wired-only; the hive's governor/paired-eval/oracle-flag are untouched; brain-purity test green.

### A4 — Loop closure (candidate → real experiment → measured effect)
- **Build:** wire `nextTest` → create/extend a challenger experiment (reuse `experiment.ts`/`allocate.ts`); both arms run live through the existing send path; `outcomes.ts` rolls up; `decide-v2` + `alpha.ts` + circuit breaker decide. On **adopt**: write the arm delta to `gene_effect_estimate` (account + global), promote the champion, record a hive-library win. On **discard**: prior-down + library loss. Feed `gene_effect_estimate` into `world.ts`/`calibrate.ts` as measured effects for the next cycle.
- **DoD (the tests that matter):** suppression checked before every send in both arms; a non-decisive/`keep_running` experiment is never adopted; alpha wealth can never go negative; the circuit breaker is evaluated first; a gene effect is written **only** from an arm that cleared the sample gate and the decision; adopted delta is recorded as `source=experiment`. Help article; `whitelabel-auditor` pass.

### A5 — Cold-start / long tail (the hard real-world problem)
- **Build:** empirical-Bayes shrinkage — cold accounts inherit global/segment `gene_effect_estimate` priors, un-pooling toward account-specific as `n` grows; `recommend.ts`'s fixed catalog drives accounts still below the sample gate. Graceful degrade end to end.
- **DoD:** tests on thin-data accounts prove no per-account effect is invented below sample, the global prior is used, and the catalog path runs; no NaN/`Infinity` from empty cohorts.

> Production wiring (the `optimizer` agent kind, the Playbook/Approvals UI, the scheduler, and the **bootstrap-from-existing-data** phase B0) lives in the production-wiring spec. Recommended interleaved order: A1 → A2 → B1 → A3 → A4 → B0 → B2 → A5 + B3.

---

## 6. Invariants — paste this block at the top of EVERY Cursor session

```
DO NOT BREAK (Vantera closed-loop build):
- ofOracle is a sim metric, NOT success. Never optimize or report it as the goal here.
- Causal gene effects come ONLY from randomized experiment arms that cleared MIN_STAGE_SAMPLE
  AND the decide-v2 gate. Below that, the prior stands. Never fit effects from observational stamps.
- Production experiment challengers test WIRED genes only (arenas.ts `wired`). Never flip a gene to
  wired without its live applier. The hive may explore unwired genes in SIM only.
- Circuit breaker FIRST; suppression checked before every send (rule 11); alpha wealth never < 0.
- Brain purity: packages/agent-brains imports no Trigger.dev/drizzle/DB (purity.test.ts). Loop wiring
  lives in packages/jobs with deps injected via interfaces (rule 13). Single AI entry (rule 02).
- Deliberator (LLM) stays OFF in the loop. releaseWorldCache() between accounts.
- Do not touch the hive's governor gates, paired eval, sealed-oracle flag, falsifier, or harm guardrail.
- RLS in the same migration as any new table; retention note per rule 11; no vendor names on any
  user-facing surface; a feature isn't done without its help-content article (rule 09).
- Migrations committed before applied, in order (rule 10). Each phase: pnpm lint && type-check && test && build green.
```

---

## 7. How to drive Cursor (the method)

1. **Commit this spec** to `docs/superpowers/specs/` so Cursor reads it as a file (it works from the repo, not from chat).
2. **One phase per session.** Use your existing loop: `/next-phase` (or point it at phase A1 of this spec) → it drafts the phase plan in `docs/superpowers/plans/` → TDD build → `/ship-phase`.
3. **Tests first, always.** For each phase, have Cursor write the section-5 DoD tests *before* the implementation. These are the anti-hallucination contract — Cursor can't fake a gain or skip a gate because the gate is a failing test it has to make pass honestly. This is the single most important instruction for this build.
4. **Paste the section-6 invariants block** at the top of every session. It's short on purpose.
5. **Verify loop after every phase:** `pnpm lint && pnpm type-check && pnpm test && pnpm build`, plus the `rls-auditor` subagent on any migration diff and `whitelabel-auditor` on any user-facing diff.
6. **Small PRs.** One phase = one PR = one roadmap checkbox. Don't let Cursor build A1→A5 in one shot; the loop is only trustworthy if each gate lands and stays green independently.
7. **Prove the loop on sim data first, then one real account.** A4 should be demonstrable end-to-end against synthetic/sample traffic (no real sends) before it touches a live account — same posture as the existing pipeline, which stops at the drafted/review queue until a gate is cleared.

---

## 8. What this does and doesn't claim

- It **does** give each account a real, safe, self-improving outreach strategy, with every gain measured on that account's own traffic and multiple-testing controlled across the chain.
- It **does not** claim the sim is reality. The sim is a prior and a proposer; `checkHoldout` is the tripwire — if the calibrated sim stops predicting an account's real meetings/100, down-weight it and lean harder on live experiments.
- It **does not** require turning the LLM strategist on, and it **does not** touch the hive's integrity gates. The "free will" you want is real — it lives in the sim proposer, where exploring freely costs nothing and the only judge that can be fooled isn't the one that decides real sends.
