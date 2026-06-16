-- 0027: security_events — append-only audit log of security-relevant activity (failed logins,
-- webhook signature failures, rate-limit hits, sensitive mutations). Writes are service-role
-- only (no client write policy); account admins read their own account's events.
--
-- account_id is nullable by design: system/global events (a webhook with no resolvable account,
-- a failed login before account resolution) have none and are hidden from all client roles.
--
-- retention(security_events): 180 days. A scheduled purge trims older rows (audit-trail
-- retention, rule 11). Account-scoped rows also cascade on account deletion.

create table public.security_events (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references public.accounts(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  severity text not null default 'info' check (severity in ('info', 'warn', 'critical')),
  ip text,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index security_events_account_created_idx on public.security_events (account_id, created_at desc);
create index security_events_type_created_idx on public.security_events (event_type, created_at desc);

alter table public.security_events enable row level security;

-- Account admins read their own account's events. System events (account_id null) are visible
-- to no client role. No insert/update/delete policy => writes are service-role only.
create policy security_events_select on public.security_events
  for select to authenticated
  using (account_id is not null and public.is_account_admin(account_id));

-- Belt-and-suspenders (0025 philosophy): RLS already denies client writes (no write policy),
-- but remove the default table-level write grants too so writes are service-role only at the
-- grant level as well. SELECT grant stays — the RLS policy needs it to function.
REVOKE INSERT, UPDATE, DELETE ON public.security_events FROM authenticated, anon;
