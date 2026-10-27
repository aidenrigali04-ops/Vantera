-- 0072: reconcile prod with the repo — objects that were created in the production database
-- outside any migration (the applied-via-dashboard class the migration drift check exists to
-- catch, first real run 2026-10-22). Everything here already exists in prod; this migration
-- makes the repo the source of truth for it and is idempotent (create or replace / guarded).
--
-- 1. rls_auto_enable + the ensure_rls event trigger: a safety net that force-enables RLS on any
--    new public table. Rule 02 still requires RLS in the creating migration — this only catches
--    a miss; never rely on it.
-- 2. Onboarding → auth metadata sync: mirrors account/onboarding fields into
--    auth.users.raw_user_meta_data so Supabase Auth dashboards and emails can read them. Fires on
--    accounts and account_members writes; failures never block the write.
-- 3. auth.users default display_name: when a user has a company_name but no display_name,
--    copy it over before insert/update.
--
-- Hardening vs. what was in prod: every security definer function pins search_path = '' (rule in
-- /vantera-db-migrations); bodies already schema-qualify every table they touch.

-- 1. RLS safety net -------------------------------------------------------------------------

create or replace function public.rls_auto_enable()
returns event_trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  cmd record;
begin
  for cmd in
    select *
    from pg_event_trigger_ddl_commands()
    where command_tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      and object_type in ('table', 'partitioned table')
  loop
    if cmd.schema_name is not null and cmd.schema_name in ('public') then
      begin
        execute format('alter table if exists %s enable row level security', cmd.object_identity);
        raise log 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      exception
        when others then
          raise log 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      end;
    else
      raise log 'rls_auto_enable: skip % (schema %)', cmd.object_identity, cmd.schema_name;
    end if;
  end loop;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_event_trigger where evtname = 'ensure_rls') then
    create event trigger ensure_rls on ddl_command_end
      when tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      execute function public.rls_auto_enable();
  end if;
end;
$$;

-- 2. Onboarding → auth user metadata --------------------------------------------------------

-- The keys written to auth.users.raw_user_meta_data (account_id, plan, member_role, company
-- fields) are DISPLAY-ONLY. raw_user_meta_data is end-user-writable through the auth API, so
-- these values are spoofable and, for a user in several workspaces, last-writer-wins. Never read
-- them server-side for authorization or entitlement — accountId comes from the session (rule 02).
-- Membership deletes do not fire the sync, so a removed member keeps a stale account_id here.
-- Longer term these belong in raw_app_meta_data.

create or replace function public.sync_onboarding_to_auth_user(p_account_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- One update per member of the account; a missing account simply matches no rows.
  update auth.users u
  set raw_user_meta_data = u.raw_user_meta_data
    || jsonb_strip_nulls(jsonb_build_object(
         'display_name', a.name,
         'company_name', a.name,
         'account_id', a.id::text,
         'member_role', am.role,
         'onboarding_role', a.onboarding_role,
         'onboarding_industry', a.onboarding_industry,
         'onboarding_icp', a.onboarding_icp,
         'onboarding_linkedin_url', a.onboarding_linkedin_url,
         'website_url', a.website_url,
         'plan', a.plan,
         'avg_deal_value_usd', case when a.avg_deal_value_cents is not null then round(a.avg_deal_value_cents / 100.0, 2) end,
         'revenue_goal_usd', case when a.revenue_goal_cents is not null then round(a.revenue_goal_cents / 100.0, 2) end,
         'onboarding_completed_at', a.onboarding_completed_at
       ))
  from public.accounts a
  join public.account_members am on am.account_id = a.id
  where a.id = p_account_id
    and am.user_id = u.id;
end;
$$;

create or replace function public.trg_accounts_sync_auth_meta()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- never let a sync failure block an account write
  begin
    perform public.sync_onboarding_to_auth_user(new.id);
  exception when others then
    null;
  end;
  return new;
end;
$$;

create or replace function public.trg_account_members_sync_auth_meta()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    perform public.sync_onboarding_to_auth_user(new.account_id);
  exception when others then
    null;
  end;
  return new;
end;
$$;

create or replace trigger accounts_sync_auth_meta
  after insert or update of name, onboarding_role, onboarding_industry, onboarding_icp,
    onboarding_linkedin_url, website_url, plan, avg_deal_value_cents, revenue_goal_cents,
    onboarding_completed_at
  on public.accounts
  for each row execute function public.trg_accounts_sync_auth_meta();

create or replace trigger account_members_sync_auth_meta
  after insert or update on public.account_members
  for each row execute function public.trg_account_members_sync_auth_meta();

-- 3. Default display_name on auth.users -----------------------------------------------------

create or replace function public.trg_auth_users_default_display_name()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(new.raw_user_meta_data->>'display_name', '') = ''
     and coalesce(new.raw_user_meta_data->>'company_name', '') <> '' then
    new.raw_user_meta_data := new.raw_user_meta_data
      || jsonb_build_object('display_name', new.raw_user_meta_data->>'company_name');
  end if;
  return new;
exception when others then
  return new;
end;
$$;

create or replace trigger auth_users_default_display_name
  before insert or update on auth.users
  for each row execute function public.trg_auth_users_default_display_name();

-- None of these functions are meant to be called by clients.
revoke all on function public.rls_auto_enable() from public, anon, authenticated;
revoke all on function public.sync_onboarding_to_auth_user(uuid) from public, anon, authenticated;
revoke all on function public.trg_accounts_sync_auth_meta() from public, anon, authenticated;
revoke all on function public.trg_account_members_sync_auth_meta() from public, anon, authenticated;
revoke all on function public.trg_auth_users_default_display_name() from public, anon, authenticated;
