-- Migration #17: Outreach Sequence Orchestrator. A per-lead state machine drives every
-- validated prospect through LinkedIn -> Email -> iMessage -> Caller(x2), gated by a
-- verified-CTA conversion. iMessage joins the channel set (stubbed infra). Replies pause
-- the run for human handling via lead_notifications.

-- iMessage joins email/linkedin/call on the review queue (body holds the drafted text).
alter table public.scheduled_sends drop constraint if exists scheduled_sends_channel_check;
alter table public.scheduled_sends add constraint scheduled_sends_channel_check
  check (channel in ('email', 'linkedin', 'call', 'imessage'));

-- iMessage suppression rides on the lead's phone value (E.164; value = lower(value)).
-- No new kind needed -- 'phone' (0014) already covers text + call. Documented here for clarity.

-- iMessage joins the campaign channel set so a sequence campaign can declare it.
alter table public.campaigns drop constraint if exists campaigns_channels_check;
alter table public.campaigns add constraint campaigns_channels_check
  check (channels <@ array['email', 'linkedin', 'phone', 'imessage'] and array_length(channels, 1) >= 1);

-- Per-campaign ordered sequence config; null falls back to SEQUENCE_DEFAULTS in code.
alter table public.campaigns add column sequence_config jsonb;

-- retention(sequence_runs): one active run per lead per campaign; cascades with lead/campaign.
-- Terminal runs (converted/exhausted/stopped) are kept for audit and swept with the lead.
create table public.sequence_runs (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  campaign_id uuid not null,
  lead_id uuid not null,
  status text not null
    check (status in ('active', 'paused_reply', 'converted', 'exhausted', 'stopped')) default 'active',
  current_stage text not null
    check (current_stage in ('linkedin', 'email', 'imessage', 'call', 'done')) default 'linkedin',
  touches_done smallint not null default 0,
  call_attempts smallint not null default 0,
  next_action_at timestamptz not null default now(),
  entered_stage_at timestamptz not null default now(),
  last_touch_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- one run per lead per campaign (v1: no re-enrollment; enrollment upserts on this key)
  constraint sequence_runs_campaign_lead_unique unique (campaign_id, lead_id),
  constraint sequence_runs_campaign_fk foreign key (campaign_id, account_id)
    references public.campaigns (id, account_id) on delete cascade,
  constraint sequence_runs_lead_fk foreign key (lead_id, account_id)
    references public.leads (id, account_id) on delete cascade
);

-- the orchestrator hot path: which active runs are due
create index sequence_runs_due_idx on public.sequence_runs (next_action_at) where status = 'active';
create index sequence_runs_account_idx on public.sequence_runs (account_id);
create index sequence_runs_lead_idx on public.sequence_runs (lead_id);

alter table public.sequence_runs enable row level security;

create policy sequence_runs_select on public.sequence_runs
  for select to authenticated using (public.is_account_member(account_id));
-- writes arrive via the service-role orchestrator only (no client write policy)

create trigger sequence_runs_set_updated_at
  before update on public.sequence_runs
  for each row execute function public.set_updated_at();

-- retention(lead_notifications): in-app alerts (e.g. a lead replied). Read by members;
-- written by the pipeline. Swept with the lead.
create table public.lead_notifications (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  lead_id uuid not null,
  kind text not null check (kind in ('reply', 'converted', 'exhausted')),
  body text not null,
  read_at timestamptz,
  -- no updated_at: read_at is the only mutable field
  created_at timestamptz not null default now(),
  constraint lead_notifications_lead_fk foreign key (lead_id, account_id)
    references public.leads (id, account_id) on delete cascade
);

create index lead_notifications_account_unread_idx
  on public.lead_notifications (account_id, created_at) where read_at is null;
create index lead_notifications_lead_idx on public.lead_notifications (lead_id);

alter table public.lead_notifications enable row level security;

create policy lead_notifications_select on public.lead_notifications
  for select to authenticated using (public.is_account_member(account_id));
-- members may mark their own account's notifications read
create policy lead_notifications_update on public.lead_notifications
  for update to authenticated
  using (public.is_account_member(account_id))
  with check (public.is_account_member(account_id));
