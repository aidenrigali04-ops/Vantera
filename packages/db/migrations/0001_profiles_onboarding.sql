-- Migration #2: user profiles, onboarding capture, team invites, account deletion, billing refs.

-- shared updated_at trigger; plain trigger fn, search_path pinned
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- onboarding answers live on the account: they seed the campaign-wizard default targeting (rule 08).
-- Billing kept to Stripe refs only (Phase 7 fills in the rest).
-- outreach_paused is the per-account kill switch (production-readiness).
alter table public.accounts
  add column onboarding_industry text,
  add column onboarding_icp text,
  add column revenue_goal_cents bigint,
  add column onboarding_completed_at timestamptz,
  add column stripe_customer_id text unique,
  add column stripe_subscription_id text,
  add column outreach_paused boolean not null default false;

-- Stripe refs and the kill switch are server-managed: column-level grants limit client updates
-- to profile/onboarding fields (the accounts_update policy still gates row access).
revoke update on table public.accounts from anon, authenticated;
grant update (name, onboarding_industry, onboarding_icp, revenue_goal_cents, onboarding_completed_at)
  on public.accounts to authenticated;

-- recreate with an explicit with check so an update can't move a row across tenants
drop policy accounts_update on public.accounts;
create policy accounts_update on public.accounts
  for update to authenticated
  using (public.is_account_admin(id))
  with check (public.is_account_admin(id));

-- user_profiles: exception to the account_id rule — user-scoped, not tenant-scoped.
-- One row per auth user, owned and editable only by that user.
create table public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_profiles enable row level security;

create policy user_profiles_select on public.user_profiles
  for select to authenticated using ((select auth.uid()) = user_id);
create policy user_profiles_insert on public.user_profiles
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy user_profiles_update on public.user_profiles
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create trigger user_profiles_set_updated_at
  before update on public.user_profiles
  for each row execute function public.set_updated_at();

-- team invites (Phase 2 schema groundwork)
create table public.account_invites (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin', 'member')),
  token uuid not null unique default gen_random_uuid(),
  status text not null check (status in ('pending', 'accepted', 'revoked', 'expired')) default 'pending',
  -- FK to auth.users lives here in SQL only; auth schema isn't modeled in Drizzle
  invited_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index account_invites_pending_email_idx
  on public.account_invites (account_id, lower(email)) where status = 'pending';
create index account_invites_account_idx on public.account_invites (account_id);

alter table public.account_invites enable row level security;

create policy account_invites_select on public.account_invites
  for select to authenticated using (public.is_account_member(account_id));
create policy account_invites_manage on public.account_invites
  for all to authenticated
  using (public.is_account_admin(account_id))
  with check (public.is_account_admin(account_id));

-- the invitee is not yet a member, so no policy can admit them; security definer is the sanctioned path
create function public.accept_invite(invite_token uuid)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  invite record;
begin
  if (select auth.uid()) is null then
    raise exception 'not authenticated';
  end if;

  select * into invite
  from public.account_invites
  where token = invite_token and status = 'pending' and expires_at > now()
  for update;

  if not found then
    raise exception 'invite not found or no longer valid';
  end if;

  -- invites are bound to the invited email, not bearer links
  if (select lower(u.email) from auth.users u where u.id = (select auth.uid()))
       is distinct from lower(invite.email) then
    raise exception 'invite was issued to a different email';
  end if;

  insert into public.account_members (account_id, user_id, role)
  values (invite.account_id, (select auth.uid()), invite.role)
  on conflict (account_id, user_id) do nothing;

  update public.account_invites
  set status = 'accepted', accepted_at = now()
  where id = invite.id;

  return invite.account_id;
end;
$$;

-- GDPR deletion path groundwork (rule 11): a Trigger.dev job drives vendor deletion calls,
-- then hard-deletes the account (FK cascades wipe all tenant data).
create table public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  requested_by uuid references auth.users(id) on delete set null,
  status text not null check (status in ('pending', 'vendor_cleanup', 'completed', 'canceled')) default 'pending',
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index account_deletion_requests_account_idx on public.account_deletion_requests (account_id);

alter table public.account_deletion_requests enable row level security;

create policy account_deletion_requests_select on public.account_deletion_requests
  for select to authenticated using (public.is_account_member(account_id));
create policy account_deletion_requests_manage on public.account_deletion_requests
  for all to authenticated
  using (public.is_account_admin(account_id))
  with check (public.is_account_admin(account_id));
