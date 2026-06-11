-- Migration #3: lead pipeline — ICPs, leads (with two-stage scoring), enrichment results (rules 05/06).

create table public.icps (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  name text not null,
  description text,
  -- rules-gate input (industry, company size, role, geo, tech stack); jsonb so the Phase 3 spec can evolve it
  criteria jsonb not null default '{}',
  source text not null check (source in ('onboarding', 'manual')) default 'manual',
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- composite-FK target so child rows can prove same-tenant linkage
  constraint icps_id_account_unique unique (id, account_id)
);

create index icps_account_idx on public.icps (account_id);

alter table public.icps enable row level security;

create policy icps_select on public.icps
  for select to authenticated using (public.is_account_member(account_id));
create policy icps_manage on public.icps
  for all to authenticated
  using (public.is_account_admin(account_id))
  with check (public.is_account_admin(account_id));

create trigger icps_set_updated_at
  before update on public.icps
  for each row execute function public.set_updated_at();

-- retention(leads): prospects with rules_gate_passed = false or never scored are purged after 90 days
-- by a scheduled job (rule 11); leads passing the gate are retained while the account exists.
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  icp_id uuid,
  source text not null check (source in ('explorium', 'manual', 'import')) default 'explorium',
  external_ref text,
  -- company block
  company_name text,
  company_domain text,
  company_size text,
  industry text,
  location text,
  tech_stack jsonb,
  -- contact block
  first_name text,
  last_name text,
  title text,
  email text,
  email_status text not null check (email_status in ('unverified', 'valid', 'invalid', 'risky')) default 'unverified',
  phone text,
  phone_status text not null check (phone_status in ('unvalidated', 'valid', 'invalid')) default 'unvalidated',
  linkedin_url text,
  -- scoring block: rules gate + AI rank (rule 06)
  rules_gate_passed boolean,
  rules_gate_reasons jsonb,
  ai_score integer check (ai_score between 0 and 100),
  ai_rationale text,
  scored_at timestamptz,
  status text not null check (status in ('sourced', 'rejected', 'qualified', 'enriched', 'in_campaign', 'replied', 'converted', 'archived')) default 'sourced',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leads_id_account_unique unique (id, account_id),
  -- composite FK: a client-writable lead can only reference an ICP in the same account
  constraint leads_icp_fk foreign key (icp_id, account_id)
    references public.icps (id, account_id) on delete set null (icp_id)
);

create index leads_account_status_idx on public.leads (account_id, status);
create index leads_account_email_idx on public.leads (account_id, lower(email));
create index leads_account_score_idx on public.leads (account_id, ai_score desc) where rules_gate_passed;
create index leads_icp_idx on public.leads (icp_id);

alter table public.leads enable row level security;

create policy leads_select on public.leads
  for select to authenticated using (public.is_account_member(account_id));
create policy leads_manage on public.leads
  for all to authenticated
  using (public.is_account_admin(account_id))
  with check (public.is_account_admin(account_id));

create trigger leads_set_updated_at
  before update on public.leads
  for each row execute function public.set_updated_at();

-- retention(enrichment_results): rows cascade with their lead; raw provider payloads are purged with the lead (rule 11).
create table public.enrichment_results (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  kind text not null check (kind in ('email_verification', 'phone_validation', 'premium')),
  provider text,
  status text not null check (status in ('pending', 'success', 'failed')) default 'pending',
  payload jsonb,
  created_at timestamptz not null default now()
);

create index enrichment_results_lead_idx on public.enrichment_results (lead_id);
create index enrichment_results_account_idx on public.enrichment_results (account_id);

alter table public.enrichment_results enable row level security;

-- written only by the enrichment pipeline via service role — no client write policies
create policy enrichment_results_select on public.enrichment_results
  for select to authenticated using (public.is_account_member(account_id));
