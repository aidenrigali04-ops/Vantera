-- Migration #17: owned email infrastructure (rule 03). Self-built provider — Vantera owns
-- domains + DNS + Google Workspace mailboxes; warmup outsourced. Vendor-neutral columns (white-label).

-- per-account sending domains (tenant-scoped, RLS)
create table public.sending_domains (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  domain text not null,
  status text not null check (status in ('verifying', 'active', 'error')) default 'verifying',
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index sending_domains_account_domain_idx on public.sending_domains (account_id, domain);
create index sending_domains_account_status_idx on public.sending_domains (account_id, status);

alter table public.sending_domains enable row level security;

create policy sending_domains_select on public.sending_domains
  for select to authenticated using (public.is_account_member(account_id));
create policy sending_domains_manage on public.sending_domains
  for all to authenticated
  using (public.is_account_admin(account_id))
  with check (public.is_account_admin(account_id));

create trigger sending_domains_set_updated_at
  before update on public.sending_domains
  for each row execute function public.set_updated_at();

-- link mailboxes to their sending domain
alter table public.mailboxes
  add column domain_id uuid references public.sending_domains(id) on delete set null;
create index mailboxes_domain_idx on public.mailboxes (domain_id);

-- Vantera-owned Google Workspace tenant pool that purchased domains are attached to.
-- Internal infra config, NOT customer data: RLS enabled with NO authenticated policy,
-- so only the service role (jobs) can read/write it.
create table public.infra_workspace_tenants (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  customer_domain_count integer not null default 0,
  domain_cap integer not null default 20,
  created_at timestamptz not null default now()
);

alter table public.infra_workspace_tenants enable row level security;
