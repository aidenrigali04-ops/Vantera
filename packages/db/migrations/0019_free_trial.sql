-- 0019: no-card free trial.
-- Every new workspace starts a 14-day trial on the Starter tier. The grant is
-- server-set via COLUMN DEFAULTS: create_account (0000) inserts only `name`, so a
-- new row inherits plan='starter', subscription_status='trialing', and a
-- trial_ends_at 14 days out. trial_ends_at is intentionally NOT added to the
-- authenticated UPDATE grant (re-issued in 0013), so it stays server/service-role
-- writable only — a client can never extend its own trial, exactly like the other
-- billing columns.
--
-- Existing rows are unaffected (defaults apply to new inserts only). The
-- trial-expiry cron (packages/jobs/src/trigger/trial-expiry.ts) flips a lapsed
-- trial to plan='none', subscription_status='none', and pauses outreach — the same
-- end-state as a canceled subscription. Keep TRIAL_DAYS in @vantera/billing in sync
-- with the 14-day interval below.
alter table public.accounts
  alter column plan set default 'starter',
  alter column subscription_status set default 'trialing',
  add column trial_ends_at timestamptz default (now() + interval '14 days');
