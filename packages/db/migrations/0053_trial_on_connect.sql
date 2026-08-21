-- 0053 (owner decision 2026-07-15): the 7-day trial starts when the user connects LinkedIn,
-- not at signup — the clock never burns before value is possible. New accounts start with
-- trial_ends_at NULL; the first active LinkedIn connect stamps now()+7d (web reconcile +
-- webhook paths, idempotent). Pre-connect COGS stays bounded by TRIAL_LEAD_CAP. Existing
-- accounts keep their current dates.
alter table accounts alter column trial_ends_at drop default;
