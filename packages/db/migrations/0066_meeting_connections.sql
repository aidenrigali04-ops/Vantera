-- 0066 (ML-6, 2026-10-21): calendar integration — meetings booked through the seller's own
-- scheduling link (Calendly / Cal.com) are detected and attributed to the exact lead.
--
-- meeting_connections: one per provider per account. The customer pastes an API credential;
-- the server verifies it, creates the provider webhook with a per-connection signing secret, and
-- stores both AES-256-GCM encrypted (crm-infra keyring). Secrets are written ONLY by the service
-- role (server action after an admin check) and never exposed to client roles: SELECT is revoked
-- and re-granted on non-secret columns only (the 0026 lesson — a column REVOKE is a no-op while a
-- table grant exists). No client write policies: connect/disconnect run server-side.
-- Retention (rule 11): retention(meeting_connections) = until disconnected; the row is deleted on
-- disconnect and cascades with the account (vendor-side webhook deleted on disconnect too).
create table public.meeting_connections (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  provider text not null check (provider in ('calendly', 'calcom')),
  status text not null default 'active' check (status in ('active', 'error')),
  credential_enc text not null,
  signing_secret_enc text not null,
  webhook_ref text,
  external_owner_ref text,
  label text,
  last_event_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meeting_connections_account_provider_unique unique (account_id, provider)
);

create trigger meeting_connections_set_updated_at
  before update on public.meeting_connections
  for each row execute function public.set_updated_at();

alter table public.meeting_connections enable row level security;

create policy meeting_connections_select on public.meeting_connections
  for select to authenticated using (public.is_account_member(account_id));

revoke select on public.meeting_connections from authenticated, anon;
grant select (
  id, account_id, provider, status, webhook_ref, external_owner_ref, label,
  last_event_at, last_error, created_at, updated_at
) on public.meeting_connections to authenticated;
-- Supabase default privileges also grant table-level writes; with no write policies RLS denies them
-- today, but a future member UPDATE policy would then cover the secret columns, and TRUNCATE
-- bypasses RLS — revoke them outright (service role is unaffected).
revoke insert, update, delete, truncate, references, trigger on public.meeting_connections from authenticated, anon;
revoke all on public.meeting_connections from anon;

-- meeting_events: one row per provider booking attributed to a lead (unattributed bookings are
-- never stored — no prospect data without a lead). attribution = 'link' (our per-lead tag came
-- back on the booking) or 'email' (invitee email matched a lead in the same account). The
-- composite FK pins every event to a lead in the SAME account. Service-role writes only.
-- Retention (rule 11): retention(meeting_events) = life of the lead (cascades with it).
create table public.meeting_events (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  lead_id uuid not null,
  connection_id uuid references public.meeting_connections(id) on delete set null,
  provider text not null check (provider in ('calendly', 'calcom')),
  booking_ref text not null,
  status text not null check (status in ('booked', 'canceled')),
  start_at timestamptz,
  attribution text not null check (attribution in ('link', 'email')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meeting_events_lead_fk foreign key (lead_id, account_id)
    references public.leads (id, account_id) on delete cascade,
  -- account-scoped identity: two workspaces can share a calendar (same vendor booking id), and
  -- isolation must never rest on vendor-id uniqueness (rls-auditor 2026-10-21)
  constraint meeting_events_booking_unique unique (account_id, provider, booking_ref)
);

create index meeting_events_lead_idx on public.meeting_events (lead_id, start_at desc);
create index meeting_events_account_idx on public.meeting_events (account_id, created_at desc);
create index meeting_events_connection_idx on public.meeting_events (connection_id);

create trigger meeting_events_set_updated_at
  before update on public.meeting_events
  for each row execute function public.set_updated_at();

alter table public.meeting_events enable row level security;

create policy meeting_events_select on public.meeting_events
  for select to authenticated using (public.is_account_member(account_id));
revoke insert, update, delete, truncate, references, trigger on public.meeting_events from authenticated, anon;
revoke all on public.meeting_events from anon;

-- leads.meeting_source gains 'calendar': a booking the scheduling tool itself confirmed — the
-- most trustworthy meeting signal (outranks the reply detector 'agent'; 'manual' stays the user's).
alter table public.leads drop constraint if exists leads_meeting_source_check;
alter table public.leads add constraint leads_meeting_source_check
  check (meeting_source in ('agent', 'manual', 'calendar'));

-- the meetings webhook dedupes deliveries through webhook_events like every other vendor source
alter table public.webhook_events drop constraint if exists webhook_events_source_check;
alter table public.webhook_events add constraint webhook_events_source_check
  check (source in ('email', 'linkedin', 'stripe', 'voice', 'imessage', 'inbound', 'ads', 'calendly', 'calcom'));
