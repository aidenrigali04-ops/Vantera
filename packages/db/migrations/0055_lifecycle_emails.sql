-- 0055 (UI/UX R5, 2026-07-15): lifecycle emails — welcome, trial-ending (T-2), payment-failed.
-- One per-account toggle (default ON, column-lockdown grant like 0051) + two service-written
-- idempotence stamps so the cron/webhook never double-send.
alter table accounts add column if not exists lifecycle_emails_enabled boolean not null default true;
grant update (lifecycle_emails_enabled) on accounts to authenticated;
comment on column accounts.lifecycle_emails_enabled is
  'R5: email owners/admins at lifecycle moments (trial ending, payment failed). Welcome rides signup.';

alter table accounts add column if not exists trial_ending_notified_at timestamptz;
comment on column accounts.trial_ending_notified_at is
  'R5: when the T-2 trial-ending email went out (idempotence; service-written only).';

alter table accounts add column if not exists payment_failed_notified_at timestamptz;
comment on column accounts.payment_failed_notified_at is
  'R5: when the dunning email went out for the CURRENT past_due spell (cleared on recovery).';
