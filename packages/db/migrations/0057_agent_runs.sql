-- 0057 (audit round 3, T4): the agent operate path — every scheduled agent run leaves a
-- record. Before this the pipeline computed a full per-run summary and threw it away
-- (logged to ops only), so "what did my agent do last run / why 0 leads?" was unanswerable
-- in-product and a dead run still rendered as a green "Live" dot.
--
-- Writes are SERVICE-ROLE ONLY (RLS on, member select policy, no insert/update/delete
-- policies) — the Trigger.dev wrappers record runs; the web app only reads.
-- Retention (rule 11): operational telemetry about the customer's own agents; the
-- recording write prunes rows older than 90 days per agent, and everything cascades
-- with the account.
create table public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  agent_id uuid not null references public.agents(id) on delete cascade,
  kind text not null check (kind in ('scout','intent')),
  status text not null check (status in ('completed','skipped','failed')),
  -- the run's ScoutRunSummary / IntentScanSummary, verbatim (discovered, gatePassed,
  -- qualified, criteriaPending, targets, sourcingErrors, …)
  summary jsonb not null default '{}'::jsonb,
  note text,
  started_at timestamptz not null default now()
);

create index agent_runs_agent_idx on public.agent_runs (agent_id, started_at desc);

alter table public.agent_runs enable row level security;

create policy agent_runs_select on public.agent_runs
  for select to authenticated using (public.is_account_member(account_id));
