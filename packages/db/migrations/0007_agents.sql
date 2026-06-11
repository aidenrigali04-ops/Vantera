-- Migration #8: SDR agents (Scout + Copy) — the agent-centric front door (rule 08, rewritten).
-- Agents are the user-facing unit; campaigns remain the internal execution grouping a Copy
-- agent's drafts hang off. Pipeline stops at scheduled_sends 'pending_review' until Phase 5.

create table public.agents (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  kind text not null check (kind in ('scout', 'copy')),
  name text not null,
  status text not null check (status in ('draft', 'live', 'paused')) default 'draft',
  -- scout: {prospects_per_run, min_score}; copy: {cta, channels: {linkedin, email}}
  config jsonb not null default '{}',
  -- scheduling block (scout agents only; null for copy agents)
  run_at_time time,
  cadence text check (cadence in ('daily', 'weekly')),
  timezone text not null default 'UTC',
  -- next_run_at/last_run_at are advanced by the scheduler via service role
  next_run_at timestamptz,
  last_run_at timestamptz,
  campaign_id uuid,
  deployed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- composite-FK target so child rows can prove same-tenant linkage
  constraint agents_id_account_unique unique (id, account_id),
  -- one agent per kind per account in v1: the Copy wizard reads "the" Scout's ICPs read-only
  constraint agents_account_kind_unique unique (account_id, kind),
  -- composite FK: an agent can only point at a campaign in the same account
  constraint agents_campaign_fk foreign key (campaign_id, account_id)
    references public.campaigns (id, account_id) on delete set null (campaign_id)
);

-- scheduler hot path: which live scout agents are due
create index agents_due_idx on public.agents (status, next_run_at);
create index agents_campaign_idx on public.agents (campaign_id);

alter table public.agents enable row level security;

create policy agents_select on public.agents
  for select to authenticated using (public.is_account_member(account_id));
create policy agents_manage on public.agents
  for all to authenticated
  using (public.is_account_admin(account_id))
  with check (public.is_account_admin(account_id));

create trigger agents_set_updated_at
  before update on public.agents
  for each row execute function public.set_updated_at();

-- agent → ICP links (max 3 per agent, enforced in the server action; cross-row caps
-- need a trigger, deferred until the cap is contested)
create table public.agent_icps (
  agent_id uuid not null,
  icp_id uuid not null,
  -- denormalized so RLS policies use the standard helpers
  account_id uuid not null references public.accounts(id) on delete cascade,
  position smallint not null default 0,
  primary key (agent_id, icp_id),
  -- composite FKs: client-writable rows can only link agent/ICP within the same account
  constraint agent_icps_agent_fk foreign key (agent_id, account_id)
    references public.agents (id, account_id) on delete cascade,
  constraint agent_icps_icp_fk foreign key (icp_id, account_id)
    references public.icps (id, account_id) on delete cascade
);

create index agent_icps_account_idx on public.agent_icps (account_id);
create index agent_icps_icp_idx on public.agent_icps (icp_id);

alter table public.agent_icps enable row level security;

create policy agent_icps_select on public.agent_icps
  for select to authenticated using (public.is_account_member(account_id));
create policy agent_icps_manage on public.agent_icps
  for all to authenticated
  using (public.is_account_admin(account_id))
  with check (public.is_account_admin(account_id));

-- retention(agent_assets): user-owned content, kept while the agent exists; rows cascade with
-- agent/account deletion and the deletion job sweeps orphaned storage objects (rule 11).
create table public.agent_assets (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  agent_id uuid not null,
  kind text not null check (kind in ('file', 'image', 'link')),
  storage_path text,
  url text,
  filename text,
  mime_type text,
  size_bytes bigint,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  -- links carry a url; files/images carry a storage object
  constraint agent_assets_shape check (
    (kind = 'link' and url is not null) or (kind in ('file', 'image') and storage_path is not null)
  ),
  constraint agent_assets_agent_fk foreign key (agent_id, account_id)
    references public.agents (id, account_id) on delete cascade
);

create index agent_assets_agent_idx on public.agent_assets (agent_id);
create index agent_assets_account_idx on public.agent_assets (account_id);

alter table public.agent_assets enable row level security;

create policy agent_assets_select on public.agent_assets
  for select to authenticated using (public.is_account_member(account_id));
create policy agent_assets_manage on public.agent_assets
  for all to authenticated
  using (public.is_account_admin(account_id))
  with check (public.is_account_admin(account_id));

-- private bucket for copy-agent uploads; object paths are <account_id>/<agent_id>/<filename>
insert into storage.buckets (id, name, public)
values ('agent-assets', 'agent-assets', false)
on conflict (id) do nothing;

create policy agent_assets_objects_read on storage.objects
  for select to authenticated
  using (bucket_id = 'agent-assets' and public.is_account_member(((storage.foldername(name))[1])::uuid));
create policy agent_assets_objects_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'agent-assets' and public.is_account_admin(((storage.foldername(name))[1])::uuid));
create policy agent_assets_objects_update on storage.objects
  for update to authenticated
  using (bucket_id = 'agent-assets' and public.is_account_admin(((storage.foldername(name))[1])::uuid))
  with check (bucket_id = 'agent-assets' and public.is_account_admin(((storage.foldername(name))[1])::uuid));
create policy agent_assets_objects_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'agent-assets' and public.is_account_admin(((storage.foldername(name))[1])::uuid));

-- website context for the Scout agent: url is user-entered; scan fields are written by the
-- prospect pipeline via service role (no client grant)
alter table public.accounts
  add column website_url text,
  add column website_scan jsonb,
  add column website_scanned_at timestamptz;

grant update (website_url) on public.accounts to authenticated;

-- structured prospect-brain output consumed by the Copy agent and the lead detail panel:
-- {pain_points[], triggers[], motivations[], value_angle, aha_moment, summary}
alter table public.leads
  add column ai_insights jsonb;
