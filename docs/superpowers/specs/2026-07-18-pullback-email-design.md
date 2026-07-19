# Pull-back email — design

Date: 2026-07-18
Status: approved (owner), not yet implemented
Amended 2026-07-18 after verifying the provider send log: the original premise ("nobody was ever
contacted") was wrong. Emails do send. See Problem, and the new Collision guard it forced.

## Problem

Six signups between 2026-07-13 and 2026-07-19. **Not one returned for a second session** — every
`auth.users.last_sign_in_at` is ~0.2s after `created_at`, which is the auto-signin at signup.

Email delivery itself is healthy. Verified against the provider's send log: every signup since
2026-07-15 received a welcome email, all delivered, no bounces. The defect is not that sending is
broken — it is that **every lifecycle email is gated behind a state these users never reached**:

- `trial-ending` requires `trial_ends_at`, which is NULL until LinkedIn connects (migration 0053).
  The three users who never connected can never receive it — not "haven't yet", structurally cannot.
- `weekly-summary` returns `null` on a dead week (`activity === 0 && liveAgents === 0`). Those same
  three have zero agents, so it is a dead week permanently.
- lead-event emails require a reply, which requires a send, which requires connect.

So every stalled signup received **exactly one email — the welcome, fired within 0.2s of signup,
before they had typed a single onboarding field — and then nothing, ever.** The users who most need
contact are precisely the ones the current system cannot reach.

The one exception proves the second half of the problem: **AK solution Ai** had a trial clock, so he
did get an email on 2026-07-16 — "Your Vantera trial ends in 2 days" — while 22 sourced buyers sat
unmentioned. Right lane, wrong content.

Two users had real value sitting in the product and never saw it:

- **Taoufyq Jaouad** (`27d2f692`) connected LinkedIn, was sourced 101 leads, and had 20 messages
  drafted. All 20 are still `scheduled_sends.status = 'pending_review'` since 2026-07-15 16:20.
  Zero sent. He was never told they existed.
- **AK solution Ai** (`13dd4afc`) completed onboarding, was sourced 22 leads (Scout still running
  as of 07-18), never returned to look at them, trial expired 07-18.

The product produced the thing the user signed up for and then said nothing. This spec closes that
one gap. It does not address the LinkedIn-connect stall (3 other users) — that is a flow-ordering
problem handled separately, because those accounts have no leads and no drafts, so there is nothing
honest to put in an email.

## Scope

**In:** two segments where real, nameable value already exists.

| Segment | Condition | Example |
|---|---|---|
| `drafts_waiting` | ≥1 `scheduled_sends.status='pending_review'`, oldest ≥24h old, owner has not signed in since it was created | Taoufyq |
| `leads_waiting` | ≥1 lead ≥24h old, owner has not signed in since it landed, **and** no pending drafts | AK |

`drafts_waiting` outranks `leads_waiting`. A user is only ever in one segment per touch and only
ever receives one email per touch.

**Out:** the never-connected segment, trial-lapsed win-back, and any email that cannot name a real
person. If we cannot say "Vera wrote this to *Antonino Ingoglia*", we do not send.

## Cadence

- **Touch 1** — oldest artifact ≥24h old, no touch-1 ledger row for this (user, segment, channel).
- **Touch 2** — ≥72h after touch 1 was sent, owner still has not returned, **the artifact is still
  waiting** (drafts still `pending_review`; leads still present), and no touch-2 row. If the drafts
  were approved, sent, or discarded in the meantime, the user acted and touch 2 does not fire.
- **Stop.** Two touches, ever. `touch_number` is already `CHECK (touch_number IN (1,2))`.

24h is chosen because LinkedIn drafts reference recent prospect activity and go stale; waiting 48h
sends a weaker message.

### Collision guard

An earlier draft of this spec claimed the touches "never stack" with `trial-ending`. That is wrong.
Taoufyq's trial ends 2026-07-22, so `trial-ending` fires ~07-20; `weekly-summary` fires Monday
07-20 and he has 3 live agents, so it is a *quiet* week, not a dead one, and it sends. Pull-back
touch 1 and touch 2 on top of that is four emails in roughly three days to someone ignoring all of
them.

Rule: **skip a pull-back touch if any other lifecycle email was sent to that account within 48h.**
Pull-back always yields — `trial-ending` is time-critical and `weekly-summary` is scheduled; a
pull-back touch can slip a day at no cost. A skipped touch is not written to the ledger, so it is
retried on the next tick once the window clears.

This requires a `lifecycle_last_email_at timestamptz` stamp on `accounts`, added in the same
migration (0060) and written by every lifecycle sender — `sendWelcomeEmail`, `trial-ending`,
`weekly-summary`, dunning, and pull-back itself. Backfilling it is unnecessary: NULL reads as
"no recent email", which is correct for every existing row.

## The "never returned" predicate

`auth.users.last_sign_in_at < <oldest artifact>.created_at`.

For Taoufyq this is exact: signed in 16:10:36, drafts created 16:20:32. It is a proxy —
`last_sign_in_at` also bumps on session refresh — so it can be *late*, never early. The failure mode
is sending one email too few, which is the correct direction to be wrong in.

There is no view-tracking anywhere in the schema (`viewed`, `last_seen`, `last_active`, `opened_at`
all return zero grep hits). Adding one is out of scope here.

## Architecture

### Ledger — reuse `lifecycle_touches`, add `channel`

`lifecycle_touches` (migration 0045) is currently LinkedIn-shaped: its status enum carries
`skipped_no_linkedin` and its columns are `linkedin_url` / `target_provider_ref` / `message_ref`.
Its unique index is `(user_id, segment, touch_number)` with **no channel**, so writing an email touch
for a user who already has a LinkedIn touch in the same segment would silently no-op via
`onConflictDoNothing()`.

We extend it rather than adding a second table. The armed-but-off lifecycle LinkedIn DM feature
targets overlapping segments; if it is ever enabled, one channel-neutral ledger prevents contacting
the same person on both channels in the same week *by construction*. A separate table cannot.

### Migration `0060_lifecycle_touches_channel.sql`

- `ADD COLUMN channel text NOT NULL DEFAULT 'linkedin'` with
  `CHECK (channel IN ('linkedin','email'))`.
- Drop and recreate `lifecycle_touches_segment_check` to add `drafts_waiting`, `leads_waiting`.
- Drop `lifecycle_touches_user_segment_touch_idx`; recreate as
  `(user_id, segment, touch_number, channel)`.
- `ALTER TABLE public.accounts ADD COLUMN lifecycle_last_email_at timestamptz` — the collision-guard
  stamp. Service-role written only; no `authenticated` column grant, since users never set it.

The `status` CHECK is left alone. Opted-out users are excluded by the store query and **no ledger row
is written** — so if a user re-enables the toggle later, they remain reachable. This matches how
`weekly_summary_enabled` is handled and avoids a "skipped" row permanently consuming the unique key.

The `'linkedin'` default means every existing row and the existing DM code path stay byte-identical.
RLS stays enabled with no policies — service-role only, as today.

### Job wiring — no new schedule

The project is at **10/10 Trigger schedules**. An 11th breaks every production deploy (lived
incident, documented at `packages/jobs/src/trigger/trial-ending.ts:12-16`).

So: a plain `task({ id: "pullback-email", ... })` — *not* `schedules.task` — plus one
`await tasks.trigger("pullback-email", {})` in the `agentScheduler` tick
(`packages/jobs/src/trigger/agent-scheduler.ts`), alongside the four already piggybacked there. The
tick's doc comment (lines 11-13) enumerates them and must be updated.

The tick fires 96×/day. Safety comes from the ledger rows, not a run-gap: a touch row exists or it
does not.

### Compose core

```ts
export function composePullback(
  row: PullbackRow,
  appUrl: string
): Omit<PullbackMessage, "to"> | null
```

Mirrors `composeWeeklySummary`'s contract — `null` means *do not send*. All the interesting logic
(opted out, already touched, came back since, nothing real to name) is decided here and is unit
testable without a mailer. Per-account failures are swallowed so one provider hiccup does not block
the rest of the batch, matching `runWeeklySummary`.

Store function `createPullbackStore` lives beside the existing stores in
`packages/jobs/src/pipeline/pg-store.ts`. It reuses the *predicates* from `createLifecycleStore`, not
its row shape — that helper selects `linkedinUrl` and joins `role = 'owner'` only. Recipient
selection follows `createTrialEndingStore` / `createLeadEventEmailStore`: join
`account_members.role IN ('owner','admin')` and `auth.users.email`.

### Content

Rendered with the existing private `shell(title, lines, ctaLabel, ctaUrl)` in
`packages/transactional-email/src/lifecycle.ts`, which already emits the
"Settings → Notifications" footer. New functions go in that same file and export through
`src/index.ts`, matching `sendWelcomeEmail`.

- **drafts_waiting** — subject names the count: *"Vera wrote 20 messages for you"*. Body lists 2–3
  actual recipient names plus one message excerpt. CTA → review queue.
- **leads_waiting** — *"22 buyers matched your ICP"*. Body lists 3 real name / title / company rows.
  CTA → `/leads`.

Real data only. No "you have new activity", no invented metrics, no placeholder counts. This is a
hard requirement, not a style note: the entire premise is that the value already exists and was
never shown.

### Opt-out

Gated on `accounts.lifecycle_emails_enabled` (already exists, already surfaced in Settings, already
column-granted to `authenticated`) — no fourth boolean.

Additionally, and unlike the other three lifecycle emails, this one ships a real one-click opt-out.
Those are sent to *active* users; a pull-back email goes to a *lapsed* user, for whom the only
current opt-out is a Settings link that requires logging in — which a lapsed user by definition will
not do.

- Add `headers?: Record<string, string>` to `TransactionalMessage`
  (`packages/transactional-email/src/types.ts`) and pass it through in
  `ResendTransactionalEmail.send` (`src/resend.ts`).
- Send `List-Unsubscribe: <https://…/api/lifecycle-unsubscribe/{token}>` and
  `List-Unsubscribe-Post: List-Unsubscribe=One-Click`.
- `token` is an HMAC of the user id — no table, no expiry sweep. Route
  `apps/web/src/app/api/lifecycle-unsubscribe/[token]/route.ts` verifies the signature and sets
  `lifecycle_emails_enabled = false` on that user's account. Subsequent runs simply stop selecting
  the account.
- Must accept POST (RFC 8058 one-click) as well as GET, and must not require a session.
- Signing key: reuse the existing webhook-secret convention rather than introducing a new env var;
  the implementation plan picks the exact one.

This is a deliberate departure from the "transactional, so no unsubscribe" exemption documented in
`types.ts:20-23`. That exemption holds for the other three; it is thin here and the owner chose to
close it.

## Testing

Unit, against `composePullback` — no mailer, no network:

- opted out (`lifecycle_emails_enabled = false`) → `null`
- no pending drafts and no leads → `null`
- artifact younger than 24h → `null`
- owner signed in after the artifact was created → `null`
- existing touch-1 row for (user, segment, `email`) → `null`
- touch 1 sent <72h ago → `null` for touch 2
- happy path `drafts_waiting` → subject contains the real count, body contains real recipient names
- happy path `leads_waiting` → three real leads named
- a user with an existing *LinkedIn* touch in the same segment still gets the email (proves the
  `channel` column fixed the collision)
- `lifecycle_last_email_at` within 48h → `null`, **and no ledger row written** (so the touch is
  retried once the window clears, rather than being silently consumed)
- `lifecycle_last_email_at` 49h ago → sends

Integration: one test that the `agentScheduler` tick triggers `pullback-email`, and a guardrail
asserting the Trigger schedule count is still 10.

## Churn Check (retention-experience)

- Value delivered but never displayed to the user → **this spec is the fix**
- At-risk signal with no designed response → **this spec is the response**
- Motivational copy with placeholder numbers → forbidden above; real names required
- Notification that demands attention but delivers no reward → CTA lands on the actual drafts/leads,
  not a generic dashboard

## Retention Brief

1. **User state** — at-risk, pre-activation (received value, never saw it, never returned)
2. **Motivation lever** — Loss aversion, honestly grounded: 20 written messages and 22 matched
   buyers are real and are going stale
3. **One desired action** — return and approve one message
4. **Value proof** — the user's own leads and drafts, named
5. **Churn risk addressed** — the silent gap between "product produced value" and "user learned it
   existed"

## Out of scope / follow-ups

- LinkedIn-connect stall (3 users) — flow reordering, separate spec
- `leads_last_viewed_at` column to replace the `last_sign_in_at` proxy
- Trial-lapsed win-back (`scanTrialLapsedBackfill` predicate already exists)
- Capping pre-connect Scout runs (AK's Scout still burns credits on a dead account)
- **`trial-ending` content fix** — it names the deadline but not the value waiting. AK's 07-16 email
  said "your trial ends in 2 days" while 22 sourced buyers went unmentioned. Small change, same
  lesson as this spec, but a different sender; queued separately so it does not widen this build.
- Welcome email timing — it fires 0.2s after signup, before onboarding is touched, so it functions
  as a receipt rather than a nurture. Worth revisiting once activation is unblocked.
