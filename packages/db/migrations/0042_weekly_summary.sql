-- Migration #42: weekly summary email opt-out.
-- The Monday `weekly-summary` job (packages/jobs) mails each account's owners/admins a
-- one-screen recap of what the agents did (sent / replies / meetings / in-market /
-- qualified / pipeline value). Retention research: auto-sent summaries beat dashboards.
-- Default ON; the account can turn it off in Settings.
--
-- Client-settable, so the column gets the column-scoped UPDATE grant (accounts uses the
-- column-lockdown pattern — 0025; same grant idiom as 0012/0019/0039). RLS
-- (accounts_update = is_account_admin) stays the real gate.

alter table public.accounts add column weekly_summary_enabled boolean not null default true;

grant update (weekly_summary_enabled) on public.accounts to authenticated;
