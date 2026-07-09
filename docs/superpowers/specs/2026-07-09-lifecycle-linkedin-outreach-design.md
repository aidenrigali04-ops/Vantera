# Lifecycle LinkedIn Outreach — Design Spec

**Date:** 2026-07-09
**Status:** Approved (owner decisions locked 2026-07-09: auto-send, personal founder profile, `last_sign_in_at` proxy for v1, LinkedIn-only — no email fallback)

## Purpose

Re-engage Vantera's own users at the three lifecycle cliffs where they silently drop off, via short founder-voice LinkedIn DMs sent from the founder's personal LinkedIn account (connected through the existing Unipile infra). Replies are handled personally by the founder in his real LinkedIn inbox — the system's job ends at stop-on-reply and notification.

This is Vantera's first **operator-side** (platform-level) outreach motion. It deliberately bypasses the tenant campaign/lead machinery, which is shaped for cold prospects, not our own users.

## Segments

"Showed intent" has no server-side signal (Meta Pixel / GA4 / Clarity never write to Postgres). Signing up **is** the queryable intent signal; segments are defined purely by lifecycle state.

| Segment | Definition (SQL-detectable) | Notes |
|---|---|---|
| **A — stalled onboarding** | `accounts.onboarding_completed_at IS NULL` | Account row is created at onboarding step 1 (`savePersonalize`), which also captures `onboarding_linkedin_url`. Filled onboarding columns tell us which step they stalled on. Users who signed up in `auth.users` but never started step 1 have no account row and no LinkedIn URL — **skipped** (LinkedIn-only decision). |
| **B — onboarded, never used dashboard** | `onboarding_completed_at IS NOT NULL` AND `auth.users.last_sign_in_at` within ~24h of `auth.users.created_at` AND account older than 3 days | v1 proxy — there is no last-seen tracking in the schema. Fast-follow (out of scope here): `accounts.last_dashboard_seen_at` touched (throttled ~1/hour) from the dashboard layout, which also unlocks future at-risk detection. |
| **C — trial expired, didn't convert** | The `trial-expiry` cron's own query: `subscription_status='trialing' AND stripe_subscription_id IS NULL AND trial_ends_at < now()` (`pg-store.ts` `getExpiredTrialAccounts`) | Captured at expiry time (see Orchestration) so the touch lands within a day of lapse, even though expiry flips the row to `plan='none'/subscription_status='none'`. |

Segment entry ordering: a user qualifies for at most one segment at a time; A and B naturally cannot overlap; C supersedes B (a lapsed account is messaged as C even if it was also idle).

## Retention Briefs (message design contract)

| | A: stalled onboarding | B: onboarded, idle | C: trial lapsed |
|---|---|---|---|
| **User state** | new, pre-activation | activated on paper, at-risk | lapsed |
| **Lever** | Fogg B=MAP + endowed progress | value proof | loss aversion |
| **Desired action** | return, finish the stalled step | open dashboard, see their leads | reply to the DM |
| **Value proof** | "your account's already set up — you're ~2 min from your scout finding leads" (reference their actual stalled step) | real numbers: "your scout found *N* leads" (per-account `leads` counts) | what the trial actually produced: leads found / qualified, going cold |
| **Churn risk defused** | silent signup abandonment | value delivered but never displayed | silent lapse; no win-back motion exists |

Copy rules: founder voice, honest, no fake personalization, no prospect-style pitch. Merge fields use **real per-account data** — never placeholder numbers. Respects the repositioning copy guard (no "AI SDR" / volume language). B and C messages must not send if the account's real lead count is zero — fall back to a count-free variant.

## Architecture

### Sender identity

- Founder connects his **personal** LinkedIn profile through the existing Unipile connection flow, under an internal ops workspace (his comped `aiden@vanterasystem.com` account works).
- The resulting `linkedin_accounts.provider_ref` is recorded in `app_settings` under key **`lifecycle_sender_ref`**. The job resolves the sender from this key at runtime; unset key = feature inert.
- Sends go through the account-scoped infra primitive `UnipileLinkedInInfra.sendMessage({connectedAccountId, profileUrl, body})` (`packages/linkedin-infra/src/unipile.ts`) — no campaign, lead, or `scheduled_sends` row involved.

### New table: `lifecycle_touches`

Operator-scoped, **service-role only** — no tenant RLS policies, no client grants (documented exception to the tenancy guardrails; the guardrail test gets an explicit allowlist entry with a comment).

```sql
lifecycle_touches (
  id uuid pk,
  user_id uuid not null references auth.users(id) on delete cascade,  -- GDPR deletion rides the cascade
  account_id uuid references accounts(id) on delete set null,
  segment text not null check (segment in ('stalled_onboarding','idle_after_onboarding','trial_lapsed')),
  touch_number int not null check (touch_number in (1,2)),
  status text not null default 'pending'
    check (status in ('pending','invited','sent','failed','skipped_no_linkedin','canceled')),
  attempts int not null default 0,        -- failed sends retry once, then park as failed
  linkedin_url text,
  target_provider_ref text,               -- member id captured at send; the strong reply-match key
  display_name text,
  stalled_step text,                      -- segment A merge field
  message_body text,
  message_ref text,                       -- provider chat/message id
  error text,
  invite_sent_at timestamptz,             -- invite gate: connection request sent
  connected_at timestamptz,               -- invite accepted (or already 1st-degree)
  sent_at timestamptz,
  replied_at timestamptz,
  created_at timestamptz not null default now()
)
-- unique (user_id, segment, touch_number)
```

Guarantees enforced in the pipeline core against this table:
- once per (user, segment, touch)
- global cross-segment cooldown: no touch to a user within 30 days of any prior touch
- touch 2 only fires ≥4 days after touch 1 and only if `replied_at IS NULL` on touch 1

### Orchestration

- New pipeline core `packages/jobs/src/pipeline/lifecycle-outreach.ts` + thin task wrapper `packages/jobs/src/trigger/lifecycle-outreach.ts` (task id `"lifecycle-outreach"`), following the existing core/wrapper skeleton.
- **No new Trigger.dev schedule** (quota is 10/10). Fired from the `agent-scheduler` tick, same pattern as `account-health`, self-throttled to run its scan at most once per day.
- **Segment C capture:** `runTrialExpiry` additionally enqueues a `lifecycle_touches` `pending` row (segment `trial_lapsed`, touch 1) for each account it expires, before flipping the row — so C targets are captured at the moment of lapse rather than re-derived later.
- **Segment C backfill (first run only):** accounts that lapsed before this ships (`subscription_status='none' AND plan='none' AND stripe_subscription_id IS NULL AND trial_ends_at < now()`) get touch-1 `pending` rows on the first scan, limited to trials that expired within the last 60 days — older lapses are stale and skipped.
- Each run: (1) scan segments A/B and insert missing touch-1 `pending` rows; (2) derive due touch-2 rows; (3) select due `pending` rows up to the daily cap; (4) resolve LinkedIn URL and send; (5) record outcome.

### Targeting

LinkedIn URL resolution order: verified `linkedin_accounts.profile_url` (the user's own connected identity) → self-reported `accounts.onboarding_linkedin_url`. Neither present → mark `skipped_no_linkedin` and never retry (LinkedIn-only; no email fallback per owner decision). Message the **account owner only** (`account_members.role='owner'`), never other members.

### Sequences

Two touches per segment: initial + one follow-up ≥4 days later, stop on reply. Founder-voice templates per segment with merge fields (first name, stalled step, real lead counts), with 2 phrasing variants rotated to avoid identical-message patterns. Templates live in the pipeline package (not agent-brains — that copy path is tuned for cold prospects and conflicts with the copy guard).

**Invite gate (LinkedIn reality):** a DM generally requires a 1st-degree connection. Before sending, the pipeline checks `getConnectionState`; a non-connection gets a note-less connection invite instead (counted against the same daily cap), the touch row parks as `invited`, and the acceptance webhook flips it back to `pending` so the message goes out on the next run. A never-accepted invite is simply the end of that user's sequence — no chasing.

### Reply handling (stop-on-reply)

The existing Unipile webhook receives inbound messages. Handler addition: if the receiving connected account is the `lifecycle_sender_ref` identity, match the sender's profile/provider id against open `lifecycle_touches`, set `replied_at`, cancel any `pending` touch for that user, and send the founder a notification email via the existing Resend transactional package. The founder replies personally from his own LinkedIn inbox — no automated replies, ever.

### Safety rails

- **Auto-send** (owner decision) with a hard daily cap: **10 sends/day** default, configurable via `app_settings` key `lifecycle_daily_cap`. This is the founder's personal account — the same restriction risk Vantera manages for customers applies; volume stays trivially low.
- Business-hours window: reuse `isWithinSendWindow` (Mon–Fri 08:00–16:59) evaluated in the founder's timezone (constant, configurable).
- Jittered pacing between sends within a run (reuse `paceWithJitter`).
- Kill switches: respects the platform `outreach_kill_switch` **and** its own `app_settings` key `lifecycle_outreach_enabled` (default off until the sender is connected and verified).
- Exclusions: internal/comped accounts (the ops workspace itself), accounts with any prior touch inside the 30-day cooldown, users who ever replied to a lifecycle touch (never auto-message again — founder owns the relationship from there).
- Segment A grace period: no touch until the account is ≥48h old (don't DM someone who signed up this morning).

## Error handling

- Send failure (Unipile error): mark `failed` with the error, retry once next run, then leave `failed` (no infinite retries against a personal account).
- Sender disconnected (Unipile status not OK at run start): abort the run, leave rows `pending`, and email the founder — mirrors the account-health disconnect alert pattern.
- Missing `lifecycle_sender_ref` or `lifecycle_outreach_enabled` false: no-op, log skip reason.

## Testing

- Pipeline core unit tests against the in-memory infra fake (`packages/linkedin-infra/src/in-memory.ts`) and a test store: segment derivation queries, cooldown/uniqueness guarantees, cap enforcement, touch-2 gating, stop-on-reply cancellation, zero-lead copy fallback, disabled/unset-sender no-op.
- Webhook handler test: inbound message on the lifecycle sender marks `replied_at` and cancels pending touches.
- Migration guardrail test updated with the documented service-role-only exception for `lifecycle_touches`.

## Out of scope (explicit)

- Email fallback for LinkedIn-unreachable users (owner decision: LinkedIn-only).
- `accounts.last_dashboard_seen_at` instrumentation (fast-follow; v1 uses the `last_sign_in_at` proxy).
- Any operator/super-admin UI. v1 is configured via `app_settings` rows and observed via the founder's inbox + notification emails + Trigger.dev run logs.
- Automated replies or AI-generated conversation — the founder handles all replies personally.
- Pre-signup intent capture (UTM/analytics-to-Postgres) — separate future project.

## Rejected alternatives

- **Users-as-leads in an internal workspace** riding the `scheduled_sends` campaign machinery: gets pacing/suppression for free but the whole path is campaign+lead-scoped with invite-stage assumptions and prospect-style brain copy — heavy misuse of the tenant model at this volume.
- **Email-only lifecycle sequence (Resend):** cheapest and zero LinkedIn risk, but these users already ignore the product; a founder DM will massively outperform. Owner explicitly chose LinkedIn-only.
