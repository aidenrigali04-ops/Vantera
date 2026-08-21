-- 0048: lengthen the no-card free trial from 5 days to 7 days.
-- Rationale (self-evolving-brain positioning, spec 2026-07-14): time-to-first-reply on
-- LinkedIn is structurally 7-14 days (connect → accept → reply), so even the 5-day trial
-- routinely ended before a trialing account saw its aha moment. 7 days closes more of that
-- gap; the rest is closed product-side by day-one value (proven plays shown before the
-- first reply ever lands). Owner decision 2026-07-14, conditioned on the verification
-- mandate: every build must deliver inside the trial window it advertises.
--
-- Only the column DEFAULT changes, so this affects NEW workspaces only (create_account in
-- 0000 inserts just `name`, inheriting this default). Existing trialing accounts keep the
-- trial_ends_at they were granted under 0020/0037/0046 — no in-place lengthening of live
-- trials. trial_ends_at stays server/service-role writable only (not in the authenticated
-- UPDATE grant from 0013), so a client still can't extend its own trial.
--
-- Keep TRIAL_DAYS in @vantera/billing (packages/billing/src/trial.ts) in sync with the
-- 7-day interval below, and keep marketing copy (hero, how-it-works, /ai-info) saying the
-- same number — the copy and this default must always change together. The trial-expiry
-- cron is unchanged — it lapses any trialing account whose trial_ends_at has passed.
alter table public.accounts
  alter column trial_ends_at set default (now() + interval '7 days');
