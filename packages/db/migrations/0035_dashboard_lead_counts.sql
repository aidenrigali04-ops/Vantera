-- Migration 0035: dashboard lead-count aggregation RPC.
-- The dashboard issued six separate count:'exact' scans of `leads` on every load
-- (total + five status buckets). status is single-valued per lead, so one grouped
-- aggregate yields all of them in a single pass.
--
-- SECURITY INVOKER (not DEFINER) is required: it keeps the existing `leads`
-- row-level security (leads_select) in force, so counts stay scoped to the
-- caller's account (rule 02). A DEFINER function here would bypass RLS and leak
-- cross-tenant counts. search_path is pinned and identifiers fully qualified.

create or replace function public.account_lead_counts()
returns table (status text, n bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select l.status, count(*)::bigint
  from public.leads l
  group by l.status
$$;

-- Default Postgres grants EXECUTE to PUBLIC, exposing every function as an
-- anon-callable RPC. Keep the surface to signed-in users only (matches the
-- 0006_function_grants hardening).
revoke execute on function public.account_lead_counts() from public, anon;
grant execute on function public.account_lead_counts() to authenticated, service_role;
