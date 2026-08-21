# Self-optimizing outreach — design

**Status:** design (approved decisions below); build not started.
**Goal:** raise the **interested-reply rate** and **meeting-booked rate** by letting the platform
internalize what is and isn't working per account and adjust its outreach — *without* the failure
modes that destroy an outbound account.

## The one principle

The optimizer **never rewrites its own code or prompts freely, and never touches send volume.**
It learns a per-account **playbook** of structured strategy knobs, proves every change with a
controlled experiment against a downstream metric, and (by decision) only *suggests* the change —
a human adopts it. It steers the existing, fully-guardrailed copy brain via config; it does not
mutate the brain.

This is the whole defense against "overcompensating to hit the number." The concrete guardrails are
in their own section below and are enforced in code, not convention.

## Decisions (locked 2026-06-29)

- **Autonomy: suggest-only.** It diagnoses, experiments, and proves a winner, but the owner approves
  before a challenger becomes the default. Matches the product's "nothing sends without you" ethos.
  Bounded auto-adopt is explicitly deferred (can be added later once trust is earned).
- **Cold start: per-account only.** Learn strictly from each account's own data. No cross-tenant
  priors, no cross-tenant content coupling. Slower to significance; simplest to reason about and
  safest on privacy. Thin-data handling is a first-class concern (see Cold-start).

## What we measure (already in the schema — no new tracking)

Per-touch funnel, all sliceable:

| Stage | Source |
|---|---|
| Invite → **accepted** | `leads.linkedin_invited_at` → `linkedin_connected_at` |
| Accepted → **interested reply** | `replies.classification = 'interested'` |
| Reply → **booked** | `replies.booked` → `leads.meeting_booked_at` |
| Booked → **closed** | `leads.closed_at`, `deal_value_cents` |

**Slice dimensions** (all exist): ICP/target segment, `leads.industry`, `title`/persona,
`lead_signals.kind` (the why-now), `scheduled_sends.linkedin_stage` (invite vs message),
`style_flags` (humanizer flags), send time-of-day/day, sender account, and the strategy-variant a
touch was drafted under.

The unit of analysis is a **touch under a strategy variant**, so outcomes attribute to a lever.

## Levers it may tune (grounded in `agent-brains/src/copy/`)

The copy brain drafts a connection note (≤200 chars) + a post-accept follow-up (≤300 chars) from a
structured `leadBlock` (pain_points, triggers, motivations, value_angle, aha_moment, CTA, brand
voice). The optimizer tunes **structured strategy knobs** consumed by the existing `LINKEDIN_SYSTEM`
prompt — never free-text prompt edits:

- **Copy strategy** — open with *trigger* vs *pain*; follow-up length; ask style (soft-interest vs
  specific); name the signal explicitly or not.
- **CTA phrasing** — *suggested to the owner only* (CTA is owner-owned).
- **Sequence timing** — invite→follow-up delay, cadence, **within safe bounds only** (rule 04).
- **Targeting emphasis** — down-weight qualified segments with structurally low reply rates. Never
  lowers the `ai_score` bar (rule 06).
- **Signal prioritization** — favor the `lead_signals.kind` values that correlate with bookings.

Implementation hook: extend `copy/shared.ts` `CopyContext` with a `strategy` object; the champion or
the experiment's challenger sets it at draft time in `copy-draft.ts` / `sequence-touch.ts`.

## Mechanism — closed champion/challenger loop

```
MEASURE → DIAGNOSE → HYPOTHESIZE → EXPERIMENT → DECIDE → (suggest→adopt | discard) → repeat
```

1. **Measure** — segmented funnel with Wilson-score confidence intervals; every rate gated by a
   minimum sample before it is even reported as signal.
2. **Diagnose the binding constraint** — compare each stage to `benchmarkForStage` (already in
   `lib/revenue`) and to the account's own average. Fix the single biggest leak; never touch a stage
   that is already healthy.
3. **Hypothesize** — for that one constraint, generate a *small* set of bounded, single-variable
   challenger variants. Every variant runs through the **same humanizer + honesty + char-limit
   validation** as production copy; anything that flags is discarded before it can send.
4. **Experiment** — allocate a **minority slice** (~20–30%, deterministic by hash(lead_id)) to the
   challenger; the majority stays on the champion. Never flip the whole account.
5. **Decide** — graduate a challenger to champion **only** on minimum sample **and** a real effect
   size on the **downstream** metric (booking rate; interested-reply as a leading indicator). No
   graduating on noise. Otherwise keep the champion and change nothing.
6. **Suggest → adopt** — surface the proven winner with its evidence; the owner approves adoption.
   Versioned and reversible.

## Guardrails — the "never destroy everything" layer (enforced in code)

- **Volume is never a lever.** Rule-04 caps (~100 invites/week, ramp, pacing) are hard. The
  optimizer has no capability to raise send count; it optimizes *rate per touch* only. Kills the #1
  self-destruct path.
- **Quality floor is inviolable.** Every variant passes the identical humanizer/honesty/
  `FOLLOWUP_MAX_CHARS` validation. The `ai_score ≥ min` bar is never lowered by the optimizer.
- **Do-no-harm circuit breaker.** Any experiment that raises `not_interested` / `unsubscribe` /
  humanizer-flag rate above the champion baseline is auto-killed immediately — regardless of reply
  lift. More replies but angrier replies loses.
- **Optimize the goal, not the proxy.** North star is booking rate (→ revenue); reply rate is only a
  leading indicator. Prevents vague-ask "sure, what is it?" reply-farming that never books.
- **Minimum-evidence gate + honest cold-start.** No change on a handful of sends. Under the
  per-account-only decision, learning is slow (~100 touches/week/account); when data is thin the
  optimizer offers only conservative, well-established best-practice nudges *or stays silent*, and
  labels every recommendation with its confidence. It never manufactures aggressive changes from
  noise.
- **Bounded change rate.** One active experiment per lever, one variable at a time. No wholesale
  rewrites, no thrash/drift.
- **Reversible + audited.** Every champion change is versioned; auto-rollback if the metric regresses
  post-graduation. Full decision log.

## Architecture (rule-13 six-piece skeleton)

- **Brain** `packages/agent-brains/src/optimize/` (pure, model-injectable, tested):
  `funnel.ts` (segmented rates + CIs), `diagnose.ts` (binding-constraint finder),
  `hypothesize.ts` (bounded variant generation; humanizer-validated), `decide.ts` (stats gate +
  circuit breaker). No Trigger/drizzle/DB (purity test).
- **Pipeline** `packages/jobs/src/pipeline/optimize.ts` (core, deps injected) + thin weekly-cron
  trigger. `copy-draft.ts` / `sequence-touch.ts` read the champion/active-challenger strategy at
  draft time.
- **DB** new RLS-scoped tables (migration + guardrail test):
  `optimization_playbook` (per-account champion strategy + version),
  `optimization_experiments` (challenger, allocation, live metrics, status),
  `optimization_decisions` (audit/why). Retention note per rule 11.
- **Surface** dashboard "What we're learning / testing" panel (read-only funnel + the current
  suggestion) + owner approve/reject action. Suggest-only, so no auto-adopt toggle in v1.
- **Help article** `packages/help-content/content/optimization.md` (knowledge-sync, rule 09).

## Cold-start plan (per-account-only reality)

- Ship **conservative best-practice defaults** as the initial champion (already encoded in
  `LINKEDIN_SYSTEM`).
- The optimizer stays **silent** until an account clears minimum per-stage samples; it never
  fabricates a "learning" from a dozen touches.
- Diagnosis targets the **highest-leverage leak only** — one change at a time — so slow data still
  compounds into real improvement rather than scattered micro-tuning.
- Every surfaced recommendation carries an explicit confidence ("early signal" vs "clear").

## Phased build

1. **Instrumentation & funnel brain** — segmented funnel + confidence; read-only "here's where you
   leak" panel. Zero risk, useful on its own.
2. **Diagnosis + suggestions (suggest-only)** — recommends the single highest-leverage change; owner
   approves. No autonomy.
3. **Experiment engine + strategy-param plumbing** — champion/challenger allocation wired into the
   copy brain; do-no-harm breaker + stats gate.
4. **(Deferred)** bounded auto-adopt — out of scope per the suggest-only decision.

## Risks / open questions

- **Statistical power.** ~100 touches/week/account makes copy-level significance slow. Mitigation:
  optimize the biggest leak only; honest confidence labeling; accept that some accounts never reach
  significance and simply run the safe default (that is a *correct* outcome, not a failure).
- **Metric attribution.** Bookings are sparse; early phases may lean on interested-reply rate as the
  decision metric with booking rate as a guardrail-direction check until booking volume supports it.
- **Segment sparsity.** Slicing thins samples fast; `diagnose.ts` must require minimum n per slice
  before claiming a segment is the problem.
