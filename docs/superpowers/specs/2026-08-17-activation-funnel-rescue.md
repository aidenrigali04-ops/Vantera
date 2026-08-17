# Activation funnel rescue — implementation spec (2026-08-17)

## Evidence (production, Aug 3–17)

7 signups → 4 accounts → **0 onboarding completions** → 2 LinkedIn connects → 0 paid. Verified against prod DB + Trigger.dev:

- All 4 new accounts stopped before the targeting step (`onboarding_industry`/`onboarding_icp`/`revenue_goal_cents` all NULL; only `onboarding_role` set).
- 3 of 7 signups have **no `accounts` row** (row is created only at onboarding step 0 submit, `apps/web/src/app/onboarding/actions.ts:73-83`). One of them (bahaae256) held a session ~75 min.
- 2 accounts stuck in **trial limbo**: `subscription_status='trialing'`, `trial_ends_at=NULL` forever (default dropped in migration `0053_trial_on_connect.sql`; clock only starts at LinkedIn connect via `apps/web/src/lib/linkedin/sync.ts:125-133` / `pg-store.ts:1829-1842`). Bounded only by `TRIAL_LEAD_CAP=100`.
- **Prod incident:** the `lifecycle-outreach` task fails every 15-min tick inside the send window since ≥Aug 13 (Trigger.dev, v20260730.1): 3 attempts × ~3.0s, crash in `scanStalledOnboarding` (`packages/jobs/src/pipeline/pg-store.ts:3304`), which aborts the whole run **before the send phase** → zero lifecycle touches ever sent (Ghachi's `trial_lapsed` touch: `pending`, `attempts=0`). Outside-window ticks return fast, masking the failure. The same SQL succeeds via admin; grants for anon/authenticated/service_role are intact → suspect the runner connection's role config (e.g. statement_timeout) — confirm via error cause, do not assume.
- No abandoned-onboarding or trial-lapsed **email** exists; stalled/idle/lapsed segments are LinkedIn-only (`docs/production-readiness.md:121-123`), so a user without a usable LinkedIn URL gets nothing.

Non-goals: pricing changes, acquisition channels, UI restyle (owner directive: provisional UI).

---

## P0-A — Fix the lifecycle-outreach prod failure (incident)

1. **Expose the cause.** Log `error.cause` (postgres code/message) from the DrizzleQueryError in the task wrapper (`packages/jobs/src/trigger/lifecycle-outreach.ts`) or reproduce with a one-off task run; check role config (`select rolname, rolconfig from pg_roles`) for the runner's `DATABASE_URL` role. Fix accordingly (role `statement_timeout`, or query change).
2. **Isolate stages.** In `runLifecycleOutreach` (`packages/jobs/src/pipeline/lifecycle-outreach.ts:90-100`): wrap each scan (stalled / idle / trial_lapsed) in its own try/catch; a failing scan logs + continues. **The send phase must run even if every scan fails.** Test: in-memory store where one scan throws → due touches still send.
3. **Alert on silent failure.** This failed for ≥5 days unnoticed. Add a Trigger.dev alert (or extend the existing once-daily notify email path at `lifecycle-outreach.ts:66-79`) on N consecutive failed runs.

**Accept:** manually triggered run inside the send window completes; Ghachi's touch leaves `pending`; next window sends normally.

## P0-B — Ship the funnel instrumentation (this branch)

Branch `diagnostics-signup-onboarding-funnel` already wraps signup/onboarding failure paths with `recordFunnelEvent` → `security_events` (`apps/web/src/lib/observability/funnel.ts`). Before merging:

1. Cover the remaining silent paths: `findFirstLeads` `!account` return (`onboarding/actions.ts:234`), booking-URL validation returns (`:213-216`), `syncOnboardingConnection` catch (`:425`), playbook/intent catch blocks (`:366`, `:410`).
2. Add one **success** breadcrumb per step (`funnel.onboarding.step_completed`, metadata `{step}`) — currently only failures + `connect_link_issued` are recorded, so abandonment location is still invisible when nothing errors.
3. Full gate, merge, deploy. Read query is documented at `funnel.ts:13`.

**Accept:** a test signup in preview produces a `funnel.*` trail through every step; the next dropped user is attributable to a step + error or abandonment.

## P1-A — Create the account at signup (close the black hole)

`signup()` already collects `companyName` (`apps/web/src/app/(auth)/actions.ts:97-152`) but defers `create_account` to onboarding step 0. Move it: call the `create_account` RPC right after sign-in inside `signup()` (invite path unchanged — it joins an existing workspace). Keep `savePersonalize`'s select-then-create as an idempotent fallback. Failure here records `funnel.signup.create_workspace_failed` and still lands the user in onboarding (retry via fallback), never a dead end.

**Accept:** every confirmed signup has an `accounts` row before first onboarding render; step 0 becomes a pure profile save.

## P1-B — Kill the trial-limbo state

Rule: **connect starts the 7-day clock; signup starts a 14-day backstop.** Never `trialing` with NULL end.

1. Migration: restore `trial_ends_at` default `now() + interval '14 days'` (comment: backstop; connect re-stamps). One-time backfill for the two limbo accounts: `trial_ends_at = greatest(created_at + interval '14 days', now() + interval '3 days')` where trialing + NULL.
2. Connect stamp (both paths — `sync.ts:125-133` and `pg-store.ts:1829-1842`): stamp `trial_ends_at = now() + 7 days` when the account's **first** `linkedin_accounts` row appears and `stripe_subscription_id IS NULL` and status `trialing` (replaces the `trial_ends_at IS NULL` guard, which the backstop breaks). Align the two paths' guards (today `sync.ts` fires on any `synced > 0`, webhook only on `active`).
3. `trial-expiry` cron (`pg-store.ts:2614-2635`) needs no change — backstop rows now lapse naturally into the trial-lapsed lane.
4. Update the limbo banner copy in `(app)/layout.tsx:158-165` ("trial starts when you connect" → reflect backstop), and rebase the trial-card worktree's `computeTrialEndUnix` (its NULL-floor branch becomes dead).

**Accept:** guardrail test — no code path can leave an account `trialing` with NULL `trial_ends_at`; both limbo accounts have end dates.

## P1-C — Email lane for stalled / lapsed users

The LinkedIn-only lane has founder-invite latency and skips users without a LinkedIn URL entirely. Add the missing emails (all respect `accounts.lifecycle_emails_enabled`; these go to *users*, not prospects — prospect suppression does not apply, rule 11 unaffected):

1. `sendOnboardingNudgeEmail` in `packages/transactional-email/src/lifecycle.ts` (subject/body: "you're two steps from your first lead list", deep link `/onboarding`). New fast scan: accounts >4h old, onboarding incomplete, no nudge sent (stamp via a `lifecycle_touches` row, `channel='email'`, segment `stalled_onboarding`, written `sent` like the pull-back lane at `pg-store.ts:3958-3972`). Runs off the existing 15-min scheduler task.
2. Trial-lapsed win-back email: same pattern, segment `trial_lapsed`, sent when the LinkedIn touch can't proceed (no `linkedin_url`, or `invited` >48h without acceptance) — check via the existing touch row state; 30-day cross-segment cooldown (`pg-store.ts:3420-3449`) applies.
3. Knowledge-sync (rule 09): update the notifications/help article to mention both emails and the existing opt-out.

**Accept:** preview test — fresh stalled account gets the nudge inside the window; opted-out account gets nothing; touch rows carry `channel='email'`.

## P2-A — Reorder onboarding: value before the LinkedIn wall

Scan-prefill already exists (scan runs at step 0, `onboarding/actions.ts:101-107`; prefills industry/ICP/value-prop, `wizard.tsx:177-182`) — but users quit at step 1 (Connect LinkedIn) and never see it. The pipeline already supports lead delivery with **no** LinkedIn connected (`NO_CHANNEL_PREVIEW_CAP=25`, `packages/jobs/src/pipeline/capacity.ts:24,74-77`).

1. Reorder `wizard.tsx` steps: Personalize → **Confirm targeting** (prefilled, one-click confirm) → Connect LinkedIn (skippable, "connect to start outreach — your first leads are already being sourced"). Update `initialStep` (`onboarding/page.tsx:69`) to key targeting off `onboarding_icp`.
2. Split `findFirstLeads`: targeting save (writes ICP/industry/goal/value_prop) is its own action after step 2; `onboarding_completed_at` stamps at wizard finish **with or without** connect. Deploy path already tolerates no-channel (preview cap sources leads on the next scheduler tick).
3. Trial safety: non-connectors are covered by the P1-B backstop; connect nudge continues via the P1-C email lane + existing limbo banner.
4. Knowledge-sync: update the onboarding help article.

**Accept:** funnel events show step-reach rates for the new order; a user can finish onboarding without connecting and sees preview leads on the dashboard within ~15 min.

## P2-B — Finish the trial-card worktree

`onboarding-trial-card` worktree Tasks 4–6 (server actions, dashboard card UI, T-24h reminder) per its existing plan (`docs/superpowers/plans/2026-07-29-onboarding-trial-card-capture.md`), rebased on P1-B. Only valuable once P2-A gets users through onboarding.

---

## Sequencing

| When | Work |
|---|---|
| Day 1 | P0-A (incident) + P0-B (merge this branch) + P1-B backfill SQL |
| Day 2–3 | P1-A, P1-B, P1-C |
| Week 2 | P2-A, then P2-B |

Every phase: TDD (pure cores, colocated tests), full gate green, rls-auditor on the P1-B migration, whitelabel pass on new emails/copy.

## Operational (no build, do now)

- hassan harir's trial ends **Aug 19** — personal outreach today.
- All 7 signups are personal Gmail addresses — check the acquisition source before investing further in funnel polish.
