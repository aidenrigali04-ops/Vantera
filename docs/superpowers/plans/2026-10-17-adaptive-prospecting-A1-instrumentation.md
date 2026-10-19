# Phase A1 — Instrumentation (genome stamping + outcome rollup)

- **Plan for:** the closed-loop spec (`docs/superpowers/specs/2026-10-17-adaptive-prospecting-closed-loop.md`), phase A1.
- **This file:** `docs/superpowers/plans/2026-10-17-adaptive-prospecting-A1-instrumentation.md`
- **Branch:** `phase-adaptive-A1-instrumentation`
- **Goal:** record the ground truth the whole loop depends on — *which strategy produced each lead* and *what outcome followed* — with **zero behavior change** to the live pipeline. No calibration, no hive, no experiments yet. Just truth, under RLS, with a guardrail test.
- **Depends on:** the existing self-optimizing-outreach tables (spec `2026-06-29-self-optimizing-outreach-design.md`). **Extend them; do not build a parallel system.**

---

## Step 0 — Pre-flight inspection (do this first; do NOT write code yet)

Read and report what already exists, so A1 extends instead of duplicating:

1. `packages/db/migrations/*` + `packages/db/src/schema.ts` — find the `leads` table and its event columns (`outcomes.ts` references `linkedin_invited_at`, `linkedin_connected_at`, plus interested/negative replies). Note exact column names.
2. The self-optimizing-outreach migrations — find any existing **experiment**, **arm/variant**, and **recipe-stamp** tables (`bandit.ts` consumes "Stage-1 recipe stamps"; `experiment.ts`/`allocate.ts` imply experiment + allocation rows). List them with columns.
3. `packages/agent-brains/src/optimize/{outcomes,funnel,bandit,experiment,allocate}.ts` — note the exact shapes of `LeadOutcomeFlags`, `VariantOutcome`, `FunnelStageKey`, and how outcome flags are currently derived.
4. `packages/agent-brains/src/research/calibrate.ts` — note the exact `FunnelCohort` shape A1 must produce (`sourced, qualified, invited, accepted, interested, negative, booked, closed`).
5. `packages/jobs/src/pipeline/*` + `pg-store.ts` — where Scout qualification and Copy drafting write lead rows (the natural stamp write-points).

**Output of Step 0:** a short note in the PR description: "reusing X, extending Y, adding Z." If a recipe-stamp table already covers copy knobs, A1 extends it to the full genome rather than adding `lead_strategy_stamp`.

---

## Step 1 — Write the tests first (this is the contract)

Colocated `*.test.ts`, written before any implementation. These are what keep the build honest.

- `packages/db/src/schema.test.ts` (extend): every new table has RLS enabled and a tenant-scoping policy; `account_id` is `not null`; a cross-tenant select returns zero rows (mirror the existing RLS guardrail pattern).
- `packages/agent-brains/src/optimize/outcomes.test.ts` (extend) or new `rollup.test.ts`: given fake lead rows + stamps, the pure rollup produces the correct `FunnelCohort` (counts per stage) and per-arm `VariantOutcome`. Cover: a lead with no reply, an interested reply, a negative reply, a booked lead, a closed lead, and the empty cohort (no NaN/Infinity).
- New `packages/jobs/src/pipeline/stamp.test.ts` (pure core): every lead that enters the Scout→Copy pipeline gets **exactly one** strategy stamp; the stamp's `strategy_signature` matches the account's active strategy; `strategies` rows dedupe by signature per account.
- **Regression guard:** a test asserting A1 changes **nothing** on the send path — suppression is still checked, `scheduled_sends` still stops at `pending_review`, no new send occurs. (Reuse the existing suppression test harness.)

Run them; they fail. Good.

---

## Step 2 — Migration (tables + RLS in the SAME migration, rule 02/11)

New migration in `packages/db/migrations/`. Proposed shapes — reconcile with Step 0 (extend an existing recipe-stamp table if one exists):

- `strategies` — `id`, `account_id` (FK, not null), `signature` (text; sorted genome signature; **unique per account**), `genome` (jsonb; one genome per arena), `source` (enum: `hive` | `experiment` | `manual` | `default`), `created_at`. Index `(account_id, signature)`.
- `lead_strategy_stamp` — `id`, `account_id` (FK, not null), `lead_id` (FK, not null, **unique** — one stamp per lead in v1), `strategy_id` (FK), `experiment_id` (FK, nullable — null until A4), `arm` (enum: `champion` | `challenger`, nullable), `stamped_at`. Index `(account_id, lead_id)`.
- **RLS:** enable + tenant policy on both, in this migration. **Retention note (rule 11):** document in the migration comment that stamps follow lead retention and are cascaded by the existing lead/account deletion path.
- `agents.config` jsonb: reserve a documented key for the account's active strategy pointer (`active_strategy_id`) — no new column (rule 13).

`drizzle` schema updated to match; migration committed before applied (rule 10); `rls-auditor` subagent on the diff.

---

## Step 3 — Store methods (`packages/jobs/src/pg-store.ts` + interface in `types.ts`)

Pure interface in `types.ts`, drizzle impl in `pg-store.ts` (rule 13 — core stays pure, deps injected):

- `upsertStrategy(accountId, genome, source): strategyId` — dedupe by signature.
- `stampLead(accountId, leadId, strategyId, { experimentId?, arm? })` — idempotent (one per lead).
- `getFunnelCohort(accountId, window): FunnelCohort` — rolls lead rows + stamps into the exact `calibrate.ts` shape.
- `getVariantOutcomes(accountId, experimentId): Record<arm, VariantOutcome>` — for A4; stub-safe now (returns empties when no experiment).

---

## Step 4 — Pure rollup (`packages/agent-brains/src/optimize/`)

The counting logic is pure and lives with the other optimize math (keeps `purity.test.ts` green — no DB in agent-brains):

- Extend `outcomes.ts` (or a new `cohort.ts`) with `rollupCohort(leadRows, stamps): FunnelCohort` and `rollupArms(leadRows, stamps): Record<arm, VariantOutcome>`. The store (Step 3) fetches rows; this decides what counts as each stage's numerator/denominator, a success, and a harm signal — reuse the existing `outcomes.ts` definitions so deep-funnel semantics stay identical.

---

## Step 5 — Wire the stamp into the pipeline (no behavior change)

- At the point a lead is created/qualified in the Scout→Copy pipeline core, resolve the account's active strategy (default genome if none set yet) via `upsertStrategy`, then `stampLead`. This is the only runtime change, and it only **writes a record** — it does not alter targeting, drafting, suppression, or sends.
- Confirm the regression guard (Step 1) stays green: the drafted queue still stops at `pending_review`; suppression still fires.

---

## Step 6 — Knowledge-sync (rule 09) + close

- Add/extend the help-content article for the account's strategy/analytics surface in `packages/help-content` (markdown + frontmatter) — even though A1 is backend, the knowledge-sync rule applies to any user-facing behavior; if A1 surfaces nothing to the user yet, note that in the PR and defer the article to A2 (when calibration status becomes visible). Register no new copilot tools yet.
- `whitelabel-auditor` pass (no vendor names leak into any surface).

---

## Definition of done (A1)

1. New tables + RLS in one migration; `schema.test.ts` RLS guard green; `rls-auditor` pass.
2. Every lead through the pipeline has exactly one stamp (test green).
3. Pure rollup produces the correct `FunnelCohort` + per-arm `VariantOutcome`, empty-cohort safe (tests green).
4. **Zero send-path behavior change** — suppression + `pending_review` regression guard green.
5. Full gate green: `pnpm lint && pnpm type-check && pnpm test && pnpm build`.
6. Roadmap checkbox added for the adaptive-prospecting block; PR = this one phase only.

---

## Out of scope for A1 (explicitly — do not let Cursor build ahead)

- No calibration run (A2). No hive/proposer (A3). No experiments created or arms allocated (A4). No cold-start pooling (A5). No `optimizer` agent kind / UI / bootstrap (those are the production-wiring spec, phases B0–B3). The entry stamp is a record, not the start of learning. Learning stays off until a subject exists on the Machine Learning page.
- No gene flipped to `wired`. No change to the hive, the governor, or `decide-v2`. No new sends.

---

## Invariants (paste at the top of the Cursor session)

```
DO NOT BREAK (A1):
- A1 only RECORDS truth. Zero behavior change on the send path. Suppression still checked;
  scheduled_sends still stops at pending_review.
- RLS in the same migration as any new table; account_id not null; tenant policy; retention note.
- Extend the existing self-optimizing-outreach tables; do not duplicate experiment/stamp infra.
- Brain purity: no DB/Trigger/drizzle in packages/agent-brains (rollup is pure). DB only in pg-store.
- Tests first — they are the contract. Don't implement until the failing tests exist.
- No vendor names on any surface. Migration committed before applied. Full gate green before done.
```
