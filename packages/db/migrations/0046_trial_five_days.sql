-- 0046: lengthen the no-card free trial from 3 days to 5 days.
-- Rationale: the product's aha moment (a first LinkedIn reply / booked meeting) is a
-- multi-day loop — connect → accept → reply — so a 3-day trial routinely expired before
-- a trialing account could see any value. 5 days gives the loop room to produce a signal.
--
-- Only the column DEFAULT changes, so this affects NEW workspaces only (create_account in
-- 0000 inserts just `name`, inheriting this default). Existing trialing accounts keep the
-- trial_ends_at they were granted under 0020/0037 — no in-place lengthening of live trials.
-- trial_ends_at stays server/service-role writable only (not in the authenticated UPDATE
-- grant from 0013), so a client still can't extend its own trial.
--
-- Keep TRIAL_DAYS in @vantera/billing (packages/billing/src/trial.ts) in sync with the
-- 5-day interval below. The trial-expiry cron is unchanged — it lapses any trialing
-- account whose trial_ends_at has passed.
alter table public.accounts
  alter column trial_ends_at set default (now() + interval '5 days');
