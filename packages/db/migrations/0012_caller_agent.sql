-- Migration #13: AI Caller agent (kind 'caller'). Third SDR agent on the six-piece
-- skeleton (rule 13). Adds phone to the suppression gate, a 'call' channel to the
-- review queue, and a calls table for dial execution + audit.
-- agents.config (caller): {cta, booking_link, voice:{voice_id,persona_name,language},
--   recording_consent_mode, calling_window:{days[],start_local,end_local}, max_attempts}

alter table public.agents drop constraint if exists agents_kind_check;
alter table public.agents add constraint agents_kind_check
  check (kind in ('scout', 'copy', 'caller'));

-- phone joins email + linkedin as a suppression kind (E.164; satisfies value = lower(value))
alter table public.suppression_entries drop constraint if exists suppression_entries_kind_check;
alter table public.suppression_entries add constraint suppression_entries_kind_check
  check (kind in ('email', 'linkedin', 'phone'));

-- 'call' joins the review queue; the structured brief rides in brief jsonb, human-readable in body
alter table public.scheduled_sends drop constraint if exists scheduled_sends_channel_check;
alter table public.scheduled_sends add constraint scheduled_sends_channel_check
  check (channel in ('email', 'linkedin', 'call'));
alter table public.scheduled_sends add column brief jsonb;

-- voice joins email/linkedin as a webhook source (idempotency parity, 0009)
alter table public.webhook_events drop constraint if exists webhook_events_source_check;
alter table public.webhook_events add constraint webhook_events_source_check
  check (source in ('email', 'linkedin', 'voice'));

-- retention(calls): one row per dial attempt; cascades with the lead. Terminal rows
-- purged by the 180-day scheduled_sends sweep companion (rule 11).
create table public.calls (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  lead_id uuid not null,
  agent_id uuid not null,
  campaign_id uuid not null,
  scheduled_send_id uuid not null,
  provider_call_id text,
  attempt_no smallint not null default 1,
  status text not null check (status in
    ('queued', 'dialing', 'in_progress', 'completed', 'no_answer', 'voicemail', 'failed')) default 'queued',
  outcome text check (outcome in
    ('booked', 'callback', 'not_interested', 'no_answer', 'voicemail', 'do_not_call')),
  duration_sec int,
  recording_url text,
  transcript text,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint calls_lead_fk foreign key (lead_id, account_id)
    references public.leads (id, account_id) on delete cascade,
  constraint calls_agent_fk foreign key (agent_id, account_id)
    references public.agents (id, account_id) on delete cascade,
  constraint calls_campaign_fk foreign key (campaign_id, account_id)
    references public.campaigns (id, account_id) on delete cascade,
  constraint calls_send_fk foreign key (scheduled_send_id)
    references public.scheduled_sends (id) on delete cascade
);

create unique index calls_provider_call_idx on public.calls (provider_call_id) where provider_call_id is not null;
create index calls_account_status_idx on public.calls (account_id, status);
create index calls_lead_idx on public.calls (lead_id);
create index calls_send_idx on public.calls (scheduled_send_id);

alter table public.calls enable row level security;

create policy calls_select on public.calls
  for select to authenticated using (public.is_account_member(account_id));
-- writes arrive via the service-role pipeline only (no client write policy)

create trigger calls_set_updated_at
  before update on public.calls
  for each row execute function public.set_updated_at();
