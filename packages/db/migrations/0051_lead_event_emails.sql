-- 0051: moment-of-value emails (last-mile spec 2026-07-15, L3).
-- One per-account toggle for the three lead-event emails (interested reply, meeting booked,
-- needs-you). Default ON — these are the trial's pull-back moments; the weekly summary keeps
-- its own toggle. Column-lockdown pattern: the settings form updates via the RLS client.
alter table accounts add column if not exists lead_event_emails_enabled boolean not null default true;
grant update (lead_event_emails_enabled) on accounts to authenticated;
comment on column accounts.lead_event_emails_enabled is
  'L3: email the account owners on interested replies / booked meetings / needs-you handoffs.';
