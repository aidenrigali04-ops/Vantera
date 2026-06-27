-- 0037: shorten the no-card free trial from 14 days to 3 days.
-- Only the column DEFAULT changes, so this affects NEW workspaces only (create_account
-- in 0000 inserts just `name`, inheriting this default). Existing trialing accounts keep
-- the trial_ends_at they were granted under 0020 — no in-place shortening of live trials.
-- trial_ends_at stays server/service-role writable only (not in the authenticated UPDATE
-- grant from 0013), so a client still can't extend its own trial.
--
-- Keep TRIAL_DAYS in @vantera/billing (packages/billing/src/trial.ts) in sync with the
-- 3-day interval below. The trial-expiry cron is unchanged — it lapses any trialing
-- account whose trial_ends_at has passed.
alter table public.accounts
  alter column trial_ends_at set default (now() + interval '3 days');
