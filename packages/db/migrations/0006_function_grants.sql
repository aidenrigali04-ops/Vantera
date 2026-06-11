-- Migration #7: harden function EXECUTE grants (Supabase advisors 0028/0029).
-- Postgres grants EXECUTE to PUBLIC by default, exposing every public function
-- as an anon-callable RPC endpoint. Keep the RPC surface to signed-in users only.

-- membership helpers: needed by RLS policy evaluation for signed-in users
revoke execute on function public.is_account_member(uuid) from public, anon;
grant execute on function public.is_account_member(uuid) to authenticated, service_role;

revoke execute on function public.is_account_admin(uuid) from public, anon;
grant execute on function public.is_account_admin(uuid) to authenticated, service_role;

-- sanctioned RPCs (both validate auth.uid() internally as defense in depth)
revoke execute on function public.create_account(text) from public, anon;
grant execute on function public.create_account(text) to authenticated, service_role;

revoke execute on function public.accept_invite(uuid) from public, anon;
grant execute on function public.accept_invite(uuid) to authenticated, service_role;

-- trigger functions are never called via RPC
revoke execute on function public.set_updated_at() from public, anon, authenticated;

-- project-level RLS safety-net event trigger (exists on the dev project, not created
-- by these migrations) — guard so this migration also applies to fresh databases
do $$
begin
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'rls_auto_enable'
  ) then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end $$;
