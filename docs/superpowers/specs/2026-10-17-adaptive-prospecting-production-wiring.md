# Adaptive Prospecting — Production wiring + account bootstrap (ADDENDUM)

- **Extends:** `docs/superpowers/specs/2026-10-17-adaptive-prospecting-closed-loop.md` (the engine, phases A1–A5) and `…-A1-instrumentation.md` (the plan).
- **Save to:** `docs/superpowers/specs/2026-10-17-adaptive-prospecting-production-wiring.md`
- **Adds:** how the loop becomes a live product (agent kind, UI surfaces, scheduler) and how an account **bootstraps from its own existing data** the moment it turns the system on.

---

## 0. Product shape — one decision

Adaptive prospecting ships as a **new agent kind `optimizer`** (rule 13 skeleton), surfaced under **Playbook** (Today-era vocab, rule 07). Rationale: it optimizes the whole 7-arena funnel — Scout's genes (prospecting, intent, qualification) *and* Outreach's genes (first-touch, follow-up, conversation, closing) — so it's an account-level layer over both shipped agents, not a feature of one. One per account (v1 unique constraint). Settings live in `agents.config` jsonb (rule 13 — no one-off columns): `enabled`, `active_strategy_id`, `guardrails`, `auto_adopt`, `max_concurrent_experiments`, `bootstrap_completed_at`.

**Review posture (compliance, rules 08/09/11).** The *statistical adoption* decision is math (`decide-v2`) and runs automatically. But *launching an experiment* changes what real prospects receive, so by default it's a **`mutate` action the user approves** in Approvals (the "nothing fires in your name" principle). Power users can flip `auto_adopt`/auto-launch on within the hard guardrails. Experiments **share the account's existing LinkedIn send budget** — they never add volume; the ramp and ~100-invites/week ceiling (rule 04) still bound everything, enforced in the scheduler, not the UI.

---

## Phase B0 — Account bootstrap: foundation from existing data

**The explicit requirement: when an account starts the ML system, its existing data is the foundation.** A one-time `optimizer-bootstrap` job, triggered on enable.

**Depends on:** A1 (stamp + `rollupCohort`) and A2 (`calibrate.fitRanges`). Build those first.

### What it does, in order
1. **Pull the account's full history** via the A1 rollup primitives — all `leads` + `outreach_sends` + reply classifications + booked/closed → one `FunnelCohort` (reuse `rollupCohort`; respect retention — never resurrect deleted or suppressed leads, rule 11).
2. **Retro-stamp historical leads (best-effort).** Reconstruct the strategy live at each lead's creation from the account's agent/campaign config history where recoverable; else stamp `source = historical`, genome = best-known or default. **These stamps are flagged observational** (`experiment_id = null`, `arm = null`) so they can never feed causal gene-effect estimates.
3. **Calibrate from history.** Split the history train/holdout by date, run `calibrate.fitRanges` on the train window, store the fitted `WORLD_RANGES` on the optimizer's config + the `checkHoldout` status. The account's worlds are warm from minute one — no weeks of cold start.
4. **Warm-start the champion.** Initial champion = the account's historically best-performing *recoverable* configuration (by observed meetings/100 of that config's cohort) if it clears `MIN_STAGE_SAMPLE`; else the default genome. Gene-effect priors = the global/segment pool (A5) when the account's own history is thin.
5. **Hand off.** Set `bootstrap_completed_at`; the steady-state loop (A2 cadence → A3 propose → A4 experiment) takes over.

### The honesty boundary (non-negotiable)
History **warm-starts base rates and the starting champion only.** It is observational — the account (or a past operator) chose those strategies, so it cannot attribute a gene's causal lift. No `gene_effect_estimate` row is ever written from historical/observational stamps; those come only from randomized experiment arms going forward. `checkHoldout` is the tripwire: if the calibrated-from-history sim doesn't predict the holdout window, down-weight it and lean on live experiments sooner.

### Tests first (contract)
- Given a rich fake history → fitted ranges stored, champion = the best historical config, `bootstrap_completed_at` set.
- Given a thin history → ranges fall back to global/segment prior, champion = default, no crash/NaN.
- **No `gene_effect_estimate` row is ever created during bootstrap** (observational data never becomes a measured effect).
- Suppressed/deleted leads are excluded from the cohort (retention/compliance).
- Bootstrap performs **no sends.**

### DoD
Migration (if new columns/flags) + RLS; pure bootstrap core unit-tested with fake histories; thin trigger wrapper; help article ("How adaptive prospecting learns from your account"); `rls-auditor` + `whitelabel-auditor` pass; full gate green.

---

## Phase B1 — Agent kind + scheduler/pipeline wiring

The rule-13 skeleton that A3 (proposer) and A4 (loop) plug into.

- **DB identity:** migration extends the `agents.kind` check to add `optimizer`; document the `config` shape in the migration comment; RLS unchanged (rides the existing `agents` RLS). `rls-auditor` pass.
- **Setup/enable (wizard, rule 13 piece 2 + rule 08 wizard-scope rule):** a minimal Playbook flow — *Name → Guardrails (max concurrent experiments, harm tolerance within the hard floor, auto-adopt on/off) → Enable*. Enable flips status to live, sets `next_run_at` (null = due), and fires Phase B0 bootstrap. Steps collect only identity + guardrails; strategy/mechanics are the brain's, never wizard inputs.
- **Server actions + validation** (`agents/actions.ts` + `validation.ts`): pure validation with colocated tests; account always from the validated session (never accepted as a param).
- **Pipeline** (rule 13 piece 5): core in `packages/jobs/src/pipeline/optimizer.ts` (pure, deps injected), thin trigger wrapper in `trigger/optimizer.ts`. The existing 15-min scheduler scans live agents by `next_run_at` — reuse it. On a due run the core: (1) refresh calibration (A2), (2) run the proposer (A3; `releaseWorldCache` between accounts), (3) ensure any *approved* experiment is allocating, (4) roll up running experiments (A1), (5) `decide-v2` + `alpha` + circuit breaker (A4), (6) on adopt → update champion + write measured effect + update global prior. Suppression + ramp enforced on every send in both arms.
- **Tests:** scheduler picks up a live optimizer; pipeline core runs end-to-end on fake deps without the Trigger runtime; `structure.test.ts` stays green (thin trigger imports its core); `purity.test.ts` stays green (no DB in the brain/proposer).

---

## Phase B2 — UI surfaces (Today-era shell, rule 07 — do not redesign; follow the locked doctrine)

Wire into the existing surfaces and vocabulary. Light-first `.app-surface`, Geist Sans/Mono, ink primary button, blue = interactive only, data-surface doctrine for tables, one-screen shells for data surfaces.

- **Playbook (home of the optimizer):** status (live/paused/bootstrapping), the current champion per arena, calibration + `checkHoldout` status, the ranked candidate shortlist, running experiments with live arm stats, and the **measured-effect history** (what the account has learned — the proof it's working). One-screen data surface; one `rounded-xl` hairline container per region; numbers tabular mono.
- **Approvals:** a proposed experiment waits here for the user to approve launch (reuse the review-queue surface) — shows the one change, the predicted direction, and the arms it will create. Approve = `mutate` with the existing confirm pattern.
- **Today (launchpad, scrolls):** a tile — "Experiment X running · +Y% acc measured · next proposal ready" — linking into Playbook.
- **Prospects / lead brief:** show each lead's stamp (which strategy/arm produced it) for transparency — read-only, from A1's `lead_strategy_stamp`.
- **Senders:** unchanged; the shared send budget/ramp is already shown here (caps come from `safety-limits.ts`, never hardcoded in UI).
- **Settings:** enable/disable, guardrails, auto-adopt, and a "re-bootstrap from history" action.

**DoD:** each surface reads via typed DTOs over the user's own data (rule 09 whitelist); no vendor names (`whitelabel-auditor`); matching help-content articles + registered copilot tools (rule 09 knowledge-sync); one-screen/data-surface doctrine honored.

---

## Phase B3 — Controls, copilot, guardrails surface

- **Copilot tools (rule 09):** read-tier tools so the help copilot can answer "what is my optimizer testing right now / what has it learned / why was this experiment discarded" from typed DTOs. A `mutate`-tier tool to pause the optimizer (confirmed in-chat). Billing/enable stays deep-link only.
- **Guardrails UI:** expose only what's safe to tune — max concurrent experiments, auto-adopt toggle, harm tolerance *within* the hard floor. The hard floors (suppression, ramp, circuit-breaker do-no-harm, alpha wealth ≥ 0) are non-configurable (rule 11 posture).
- **Observability:** surface `checkHoldout` drift and alpha-wealth state so the owner can see when the sim is trusted vs when the account is spending its significance budget.

---

## Sequencing (A engine × B product)

| Order | Phase | Why here |
|---|---|---|
| 1 | A1 instrumentation | stamps + rollup — everything needs it |
| 2 | A2 per-account calibration | fitRanges cadence; bootstrap reuses it |
| 3 | B1 agent kind + scheduler/pipeline shell | the skeleton A3/A4 plug into |
| 4 | A3 proposer bridge | hive → wired-only candidate |
| 5 | A4 loop closure | candidate → randomized experiment → measured effect |
| 6 | B0 bootstrap on enable | needs A1 rollup + A2 calibrate + a champion to seed |
| 7 | B2 UI surfaces | once there's real state to show |
| 8 | A5 cold-start pooling + B3 controls/copilot | long-tail + the control room polish |

Each row is one PR = one roadmap checkbox, tests-first, full gate green.

---

## Production safety invariants (paste at the top of every B-phase session)

```
DO NOT BREAK (adaptive prospecting, production):
- Experiments SHARE the account's LinkedIn send budget — never add volume. Ramp + ~100 invites/week
  ceiling enforced in the scheduler (rule 04), not the UI. Suppression checked before every send,
  both arms (rule 11).
- Launching an experiment is a user-approved mutate action by default (nothing fires in the user's
  name). The statistical ADOPT decision (decide-v2) is automatic; the LAUNCH is gated.
- Historical/observational data warm-starts base rates + the starting champion ONLY. It NEVER writes
  a gene_effect_estimate. Causal effects come only from randomized experiment arms. checkHoldout is the
  drift tripwire.
- Bootstrap excludes deleted/suppressed leads and performs no sends. Retention note on any new table.
- optimizer is one agent kind per account via agents.kind + agents.config (rule 13) — no one-off columns.
  Brain/proposer stays pure (purity.test.ts); pipeline core pure, trigger thin (structure.test.ts).
- UI follows the locked Today-era shell + data-surface doctrine (rule 07); typed DTOs only, no raw rows,
  no vendor names; help article + copilot tools ship in the same PR (rule 09).
```
