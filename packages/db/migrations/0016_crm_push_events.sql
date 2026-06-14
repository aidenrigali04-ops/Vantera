-- Migration #17: CRM push execution (Phase 9, completes 0015_crm_connections).
-- Adds the close stage to leads and the push audit/retry queue. Vantera is not a CRM
-- (rule 01); these track closed-won deals being pushed OUT to the customer's tools.
-- A won-customer push is NOT an outreach send, so rule 11's suppression gate does not
-- apply here (intentionally absent).

-- Close stage on leads. status='converted' is reused as closed-won (no new status);
-- these add the deal value + close date the push payload and revenue can read. Both
-- nullable. Writable by account admins via the existing leads_manage policy (0002).
alter table public.leads
  add column deal_value_cents bigint,
  add column closed_at timestamptz;

-- Push audit + retry queue. Doubles as the per-lead push-status surface and the
-- connection-health signal. Enqueued by the close/manual-push actions (user session,
-- admin) and processed by the crm-push pipeline (service role).
-- retention(crm_push_events): operational/audit data tied to the account; cascades on
-- account deletion (RLS-scoped). Won customers, not unqualified prospects — no
-- prospect-data retention window applies.
create table public.crm_push_events (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  connection_id uuid references public.crm_connections(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  status text not null check (status in ('pending', 'success', 'failed')) default 'pending',
  attempts integer not null default 0,
  last_attempt_at timestamptz,
  next_retry_at timestamptz,
  payload jsonb,
  external_ref text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index crm_push_events_account_status_idx on public.crm_push_events (account_id, status);
create index crm_push_events_lead_idx on public.crm_push_events (lead_id);
create index crm_push_events_connection_idx on public.crm_push_events (connection_id);
-- retry cron scans pending events whose backoff has elapsed
create index crm_push_events_retry_idx on public.crm_push_events (next_retry_at) where status = 'pending';

alter table public.crm_push_events enable row level security;

create policy crm_push_events_select on public.crm_push_events
  for select to authenticated using (public.is_account_member(account_id));
-- admins enqueue (manual push / re-push); the pipeline updates status via service role
create policy crm_push_events_manage on public.crm_push_events
  for all to authenticated
  using (public.is_account_admin(account_id))
  with check (public.is_account_admin(account_id));

create trigger crm_push_events_set_updated_at
  before update on public.crm_push_events
  for each row execute function public.set_updated_at();
