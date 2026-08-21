-- 0040: self-optimizing outreach (Phase 3) — the champion/challenger experiment engine's store.
--
-- Inert until an owner starts an experiment: with no running experiment and an empty playbook, every
-- draft resolves to the champion (empty strategy) = pre-optimizer behavior. Nothing here changes a
-- send on its own; the pipeline only ever marks an experiment ready_to_adopt/halted (suggest-only),
-- and the owner adopts.
--
-- retention(optimization_experiments): kept for the life of the account (learned config + its audit);
-- cascades on account deletion.
-- retention(optimization_playbook): kept for the life of the account; cascades on account deletion.

create table public.optimization_experiments (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  stage_key text not null check (stage_key in ('acceptance', 'reply', 'booking', 'close')),
  champion_strategy jsonb not null default '{}'::jsonb,
  challenger_strategy jsonb not null default '{}'::jsonb,
  allocation_pct integer not null default 25 check (allocation_pct between 0 and 100),
  min_sample integer not null default 30,
  status text not null default 'running'
    check (status in ('running', 'ready_to_adopt', 'adopted', 'discarded', 'halted')),
  decision_reason text,
  started_at timestamptz not null default now(),
  concluded_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index optimization_experiments_account_status_idx
  on public.optimization_experiments (account_id, status);
-- At most one live (running or ready_to_adopt) experiment per account — one variable at a time.
create unique index optimization_experiments_one_live
  on public.optimization_experiments (account_id)
  where status in ('running', 'ready_to_adopt');

alter table public.optimization_experiments enable row level security;
-- Members read; only admins start/adopt/discard. The decide pipeline updates status via service role.
create policy optimization_experiments_select on public.optimization_experiments
  for select to authenticated using (public.is_account_member(account_id));
create policy optimization_experiments_manage on public.optimization_experiments
  for all to authenticated
  using (public.is_account_admin(account_id))
  with check (public.is_account_admin(account_id));

create table public.optimization_playbook (
  account_id uuid not null references public.accounts(id) on delete cascade,
  champion_strategy jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  updated_at timestamptz not null default now(),
  primary key (account_id)
);

alter table public.optimization_playbook enable row level security;
create policy optimization_playbook_select on public.optimization_playbook
  for select to authenticated using (public.is_account_member(account_id));
create policy optimization_playbook_manage on public.optimization_playbook
  for all to authenticated
  using (public.is_account_admin(account_id))
  with check (public.is_account_admin(account_id));

-- Per-lead experiment attribution (stamped by the copy-draft pipeline; service-role write). Additive
-- and nullable — existing rows and non-experiment leads are untouched. retention(leads) already stated.
alter table public.leads
  add column if not exists experiment_id uuid references public.optimization_experiments(id) on delete set null;
alter table public.leads
  add column if not exists strategy_variant text check (strategy_variant in ('champion', 'challenger'));
create index if not exists leads_experiment_idx
  on public.leads (experiment_id) where experiment_id is not null;
