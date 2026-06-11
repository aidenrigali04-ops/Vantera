-- Migration #1: multi-tenant base. RLS on from day one (locked decision, rule 02).
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table public.account_members (
  account_id uuid not null references public.accounts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (account_id, user_id)
);

alter table public.accounts enable row level security;
alter table public.account_members enable row level security;

-- security definer so policies can consult memberships without recursive RLS
create function public.is_account_member(target_account_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.account_members m
    where m.account_id = target_account_id and m.user_id = (select auth.uid())
  );
$$;

create function public.is_account_admin(target_account_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.account_members m
    where m.account_id = target_account_id
      and m.user_id = (select auth.uid())
      and m.role in ('owner', 'admin')
  );
$$;

create policy accounts_select on public.accounts
  for select using (public.is_account_member(id));
create policy accounts_update on public.accounts
  for update using (public.is_account_admin(id));

create policy account_members_select on public.account_members
  for select using (public.is_account_member(account_id));
create policy account_members_manage on public.account_members
  for all using (public.is_account_admin(account_id));

-- the only sanctioned way to create an account: account + owner membership atomically
create function public.create_account(account_name text)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  new_account_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'not authenticated';
  end if;
  insert into public.accounts (name) values (account_name) returning id into new_account_id;
  insert into public.account_members (account_id, user_id, role)
  values (new_account_id, (select auth.uid()), 'owner');
  return new_account_id;
end;
$$;
