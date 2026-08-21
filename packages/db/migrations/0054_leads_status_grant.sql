-- 0054 (UI/UX R4, 2026-07-15): bulk archive on the Leads surface — `leads.status` becomes
-- client-updatable. Column-lockdown pattern (0050/0039): columns are NOT client-writable
-- until explicitly granted; RLS (leads_manage, admin-only) still gates WHO can update.
grant update (status) on public.leads to authenticated;
