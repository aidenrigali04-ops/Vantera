-- 0060 (pull-back email, 2026-07-18): make lifecycle_touches channel-neutral and add the
-- cross-email collision stamp.
--
-- 0045 shaped lifecycle_touches around LinkedIn DMs and made the unique key
-- (user_id, segment, touch_number) with no channel — so an email touch for a user who already
-- has a LinkedIn touch in the same segment would silently no-op via onConflictDoNothing.
-- One channel-neutral ledger also stops the armed LinkedIn DM feature and this email from
-- contacting the same person twice in a week.

alter table lifecycle_touches
  add column if not exists channel text not null default 'linkedin';

alter table lifecycle_touches
  drop constraint if exists lifecycle_touches_channel_check;
alter table lifecycle_touches
  add constraint lifecycle_touches_channel_check check (channel in ('linkedin', 'email'));

comment on column lifecycle_touches.channel is
  'Which lane delivered this touch. Default linkedin keeps every 0045 row and the DM path unchanged.';

-- Widen the segment vocabulary for the two email segments.
alter table lifecycle_touches
  drop constraint if exists lifecycle_touches_segment_check;
alter table lifecycle_touches
  add constraint lifecycle_touches_segment_check
  check (segment in (
    'stalled_onboarding', 'idle_after_onboarding', 'trial_lapsed',
    'drafts_waiting', 'leads_waiting'
  ));

-- Idempotence key, split per channel.
--
-- The LinkedIn lane keeps the 0045 key EXACTLY — (user_id, segment, touch_number) — just scoped to
-- its own rows with a partial predicate. Every 0045 row defaults to channel='linkedin' and the DM
-- path never writes any other value, so this index covers precisely the same rows the dropped one
-- did and dedupes them identically. Its onConflictDoNothing() (enqueueTouch, no conflict target)
-- keeps matching it: a bare ON CONFLICT DO NOTHING catches partial unique indexes too.
--
-- The email lane needs account_id in the key. lifecycle_touches groups per user, but the pull-back
-- audience is built per ACCOUNT — one user who owns two accounts is two independent stalls, and a
-- user-only key made the second account's recordTouch collide with the first and vanish under
-- onConflictDoNothing(), leaving that account permanently un-ledgered and re-sendable forever
-- (breaking the spec's "two touches, ever").
--
-- Why not one 5-column index over both lanes: account_id is nullable (ON DELETE SET NULL) and NULLs
-- never conflict in a unique index, so adding it globally would silently disarm dedupe for every
-- 0045 LinkedIn row whose account was deleted. Splitting keeps the LinkedIn lane on the exact key
-- it already had while the email lane — which always writes a real account_id (recordTouch takes a
-- non-null accountId) — gets the account scope it needs.
--
-- NULLS NOT DISTINCT is deliberately NOT used here: on account deletion the FK sets account_id to
-- NULL, and two email touches for the same user from two deleted accounts would then collide and
-- make the cascade itself fail. NULLs staying distinct means deleted-account history just goes
-- inert, which is the correct failure direction.
drop index if exists lifecycle_touches_user_segment_touch_idx;
create unique index if not exists lifecycle_touches_linkedin_touch_idx
  on lifecycle_touches (user_id, segment, touch_number)
  where channel = 'linkedin';
create unique index if not exists lifecycle_touches_email_touch_idx
  on lifecycle_touches (user_id, account_id, segment, touch_number)
  where channel = 'email';

-- Collision guard: pull-back yields to any other lifecycle email within 48h.
alter table accounts add column if not exists lifecycle_last_email_at timestamptz;
comment on column accounts.lifecycle_last_email_at is
  'When ANY lifecycle email last went to this account. Service-written only (no authenticated grant) — read by the pull-back collision guard.';
