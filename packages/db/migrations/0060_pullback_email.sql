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

-- Idempotence key now includes channel.
drop index if exists lifecycle_touches_user_segment_touch_idx;
create unique index if not exists lifecycle_touches_user_segment_touch_channel_idx
  on lifecycle_touches (user_id, segment, touch_number, channel);

-- Collision guard: pull-back yields to any other lifecycle email within 48h.
alter table accounts add column if not exists lifecycle_last_email_at timestamptz;
comment on column accounts.lifecycle_last_email_at is
  'When ANY lifecycle email last went to this account. Service-written only (no authenticated grant) — read by the pull-back collision guard.';
