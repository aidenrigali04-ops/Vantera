-- Migration #6: help copilot audit tables (rule 09).

-- Append-only action audit: every copilot tool execution lands here.
-- Inserts via service role from the copilot route — no client write policies.
create table public.copilot_actions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  -- FK to auth.users lives in SQL only
  user_id uuid not null references auth.users(id) on delete cascade,
  tool_name text not null,
  tier text not null check (tier in ('read', 'navigate', 'mutate', 'critical')),
  input jsonb,
  result_status text not null check (result_status in ('success', 'error', 'denied', 'undone')),
  error text,
  created_at timestamptz not null default now()
);

create index copilot_actions_account_created_idx on public.copilot_actions (account_id, created_at desc);
create index copilot_actions_user_idx on public.copilot_actions (user_id);

alter table public.copilot_actions enable row level security;

create policy copilot_actions_select on public.copilot_actions
  for select to authenticated using (public.is_account_member(account_id));

-- knowledge-gap log: the help-content authoring backlog (rule 09)
create table public.copilot_knowledge_gaps (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  question text not null,
  surface text,
  status text not null check (status in ('open', 'resolved', 'dismissed')) default 'open',
  created_at timestamptz not null default now()
);

create index copilot_knowledge_gaps_account_status_idx on public.copilot_knowledge_gaps (account_id, status);

alter table public.copilot_knowledge_gaps enable row level security;

create policy copilot_knowledge_gaps_select on public.copilot_knowledge_gaps
  for select to authenticated using (public.is_account_member(account_id));
create policy copilot_knowledge_gaps_manage on public.copilot_knowledge_gaps
  for all to authenticated
  using (public.is_account_admin(account_id))
  with check (public.is_account_admin(account_id));
