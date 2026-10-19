-- 0065: adaptive prospecting A1 — which strategy produced each lead.
--
-- Extends the 0040 experiment columns (leads.experiment_id, leads.strategy_variant) and the
-- 0049 scheduled_sends.recipe stamp. Those record a copy-recipe arm at draft time. They do not
-- record a full-funnel genome at lead entry, so this adds that record instead of overloading them.
--
-- agents.config may later hold active_strategy_id (jsonb, rule 13). No new agents column.
-- A stamp with experiment_id null and arm null is observational. It must never be written into
-- gene_effect_estimate. Causal effects wait for a randomized arm (phase A4).
--
-- retention(strategies): account configuration, kept for the life of the account, cascades on
-- account deletion.
-- retention(lead_strategy_stamp): prospect attribution. Cascades with the lead (composite FK)
-- and with the account, so a purged lead takes its stamp with it (rule 11). No separate sweep.

create table public.strategies (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  signature text not null,
  genome jsonb not null default '{}'::jsonb,
  source text not null check (source in ('hive', 'experiment', 'manual', 'default')),
  created_at timestamptz not null default now(),
  constraint strategies_id_account_unique unique (id, account_id),
  constraint strategies_account_signature_unique unique (account_id, signature)
);

alter table public.strategies enable row level security;

create policy strategies_select on public.strategies
  for select to authenticated using (public.is_account_member(account_id));
-- service-role pipeline writes only (no client write policy)

-- Composite experiment FK needs a same-tenant unique target. id is already the primary key;
-- (id, account_id) is the reference shape used by every other tenant FK in this schema.
alter table public.optimization_experiments
  add constraint optimization_experiments_id_account_unique unique (id, account_id);

create table public.lead_strategy_stamp (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  lead_id uuid not null,
  strategy_id uuid not null references public.strategies(id) on delete cascade,
  experiment_id uuid references public.optimization_experiments(id) on delete set null,
  arm text check (arm in ('champion', 'challenger')),
  stamped_at timestamptz not null default now(),
  constraint lead_strategy_stamp_lead_unique unique (lead_id),
  constraint lead_strategy_stamp_lead_fk foreign key (lead_id, account_id)
    references public.leads (id, account_id) on delete cascade,
  constraint lead_strategy_stamp_strategy_fk foreign key (strategy_id, account_id)
    references public.strategies (id, account_id) on delete cascade,
  constraint lead_strategy_stamp_experiment_fk foreign key (experiment_id, account_id)
    references public.optimization_experiments (id, account_id) on delete set null (experiment_id)
);

create index lead_strategy_stamp_account_lead_idx on public.lead_strategy_stamp (account_id, lead_id);

alter table public.lead_strategy_stamp enable row level security;

create policy lead_strategy_stamp_select on public.lead_strategy_stamp
  for select to authenticated using (public.is_account_member(account_id));
-- service-role pipeline writes only (no client write policy)
