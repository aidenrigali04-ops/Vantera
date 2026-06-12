-- Migration #10: Phase 5 live send boundary — webhook idempotency, CAN-SPAM sender
-- address, LinkedIn invite→accept→message sequencing, whitelabel source rename.

-- customer's physical mailing address for the cold-email footer (rule 11):
-- {line1, line2?, city, region, postal, country}. Email dispatch refuses accounts
-- without it.
alter table public.accounts add column sender_address jsonb;

-- LinkedIn sequencing state (rule 04/08): set by the send task / accepted-webhook.
alter table public.leads add column linkedin_invited_at timestamptz;
alter table public.leads add column linkedin_connected_at timestamptz;

-- whitelabel follow-up (Phase 4 audit): neutral discovery source. The inline check
-- from 0002 is named leads_source_check by Postgres convention.
alter table public.leads drop constraint if exists leads_source_check;
update public.leads set source = 'discovery' where source = 'explorium';
alter table public.leads alter column source set default 'discovery';
alter table public.leads
  add constraint leads_source_check check (source in ('discovery', 'manual', 'import'));

-- LinkedIn drafts come in pairs: stage 'invite' (connection note) and stage
-- 'message' (follow-up, parked until the lead accepts). Null for email.
alter table public.scheduled_sends
  add column linkedin_stage text check (linkedin_stage in ('invite', 'message'));

-- retention(webhook_events): debugging + idempotency only; purged after 30 days by
-- the retention-purge job (rule 11). Service-role only — RLS enabled, NO policies
-- (same pattern as app_settings).
create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('email', 'linkedin')),
  provider_event_id text not null,
  payload jsonb not null,
  received_at timestamptz not null default now()
);

-- one processing per provider event; doubles as the dedupe gate
create unique index webhook_events_source_event_idx
  on public.webhook_events (source, provider_event_id);
create index webhook_events_received_idx on public.webhook_events (received_at);

alter table public.webhook_events enable row level security;
