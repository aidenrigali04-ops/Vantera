-- Migration #62 (renumbered from local #39 at the 2026-08-21 sync): reveal_runs — progress ledger for the pre-payment fast-pass scan
-- (journey v2 Phase 16, blueprint §6.2). One row per account, written stage-by-stage by
-- the fast-pass pipeline and polled by /api/reveal/status to drive the Reveal screen.
-- The UNIQUE(account_id) index doubles as the enqueue-exactly-once guard: the connect
-- return and the /reveal page both attempt an insert; the loser of the race is a 23505
-- and no second scan is triggered. Failed runs are retried by RESETTING the row (status
-- back to 'queued'), never by inserting a sibling.
--
-- retention(reveal_runs): one progress row per account holding only counters and
-- timestamps (no prospect data); cascades with account deletion, no independent sweep.

create table public.reveal_runs (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  status text not null check (status in
    ('queued', 'scanning', 'ranking', 'drafting', 'done', 'failed')) default 'queued',
  scanned int not null default 0,
  gate_passed int not null default 0,
  matched int not null default 0,
  drafted int not null default 0,
  error text,
  -- aha SLO stamps (§19.2): time-to-first-match and time-to-full-draft
  started_at timestamptz,
  first_match_at timestamptz,
  full_draft_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index reveal_runs_account_unique on public.reveal_runs (account_id);

alter table public.reveal_runs enable row level security;

create policy reveal_runs_select on public.reveal_runs
  for select to authenticated using (public.is_account_member(account_id));
-- writes arrive via the service-role fast-pass pipeline only (no client write policy)
