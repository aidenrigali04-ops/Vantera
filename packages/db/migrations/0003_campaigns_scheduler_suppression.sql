-- Migration #4: campaigns (wizard, rule 08), scheduler queue, suppression list (rule 11), platform kill switch.

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  name text not null,
  status text not null check (status in ('draft', 'active', 'paused', 'completed', 'archived')) default 'draft',
  channels text[] not null check (channels <@ array['email', 'linkedin'] and array_length(channels, 1) >= 1),
  -- array of {type: 'industry'|'icp', value}; the wizard's max-3 rule enforced in the DB (rule 08)
  targeting jsonb not null default '[]' check (jsonb_array_length(targeting) <= 3),
  copywriting_mode text check (copywriting_mode in ('user', 'agent')),
  user_copy jsonb,
  send_mode text check (send_mode in ('automatic', 'review', 'manual')),
  run_at_time time not null default '08:00',
  cadence text not null check (cadence in ('daily', 'weekly')) default 'daily',
  timezone text not null default 'UTC',
  created_by uuid references auth.users(id) on delete set null,
  launched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- composite-FK target so child rows can prove same-tenant linkage
  constraint campaigns_id_account_unique unique (id, account_id)
);

create index campaigns_account_status_idx on public.campaigns (account_id, status);
-- scheduler hot path: which active campaigns are due at this run time
create index campaigns_due_idx on public.campaigns (run_at_time) where status = 'active';

alter table public.campaigns enable row level security;

create policy campaigns_select on public.campaigns
  for select to authenticated using (public.is_account_member(account_id));
create policy campaigns_manage on public.campaigns
  for all to authenticated
  using (public.is_account_admin(account_id))
  with check (public.is_account_admin(account_id));

create trigger campaigns_set_updated_at
  before update on public.campaigns
  for each row execute function public.set_updated_at();

create table public.campaign_leads (
  campaign_id uuid not null,
  lead_id uuid not null,
  -- denormalized so RLS policies use the standard helpers
  account_id uuid not null references public.accounts(id) on delete cascade,
  status text not null check (status in ('pending', 'queued', 'sent', 'replied', 'suppressed', 'skipped', 'completed')) default 'pending',
  added_at timestamptz not null default now(),
  primary key (campaign_id, lead_id),
  -- composite FKs: client-writable rows can only link campaign/lead within the same account
  constraint campaign_leads_campaign_fk foreign key (campaign_id, account_id)
    references public.campaigns (id, account_id) on delete cascade,
  constraint campaign_leads_lead_fk foreign key (lead_id, account_id)
    references public.leads (id, account_id) on delete cascade
);

create index campaign_leads_account_idx on public.campaign_leads (account_id);
create index campaign_leads_campaign_status_idx on public.campaign_leads (campaign_id, status);
create index campaign_leads_lead_idx on public.campaign_leads (lead_id);

alter table public.campaign_leads enable row level security;

create policy campaign_leads_select on public.campaign_leads
  for select to authenticated using (public.is_account_member(account_id));
create policy campaign_leads_manage on public.campaign_leads
  for all to authenticated
  using (public.is_account_admin(account_id))
  with check (public.is_account_admin(account_id));

-- retention(scheduled_sends): drafts hold prospect PII so rows cascade with campaign/lead;
-- terminal rows (sent/failed/canceled) are purged after 180 days by a scheduled job (rule 11).
create table public.scheduled_sends (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  campaign_id uuid not null,
  lead_id uuid not null,
  channel text not null check (channel in ('email', 'linkedin')),
  status text not null check (status in ('drafting', 'pending_review', 'approved', 'scheduled', 'sending', 'sent', 'failed', 'canceled', 'suppressed')) default 'drafting',
  subject text,
  body text,
  scheduled_for timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- composite FKs: drafts can only link campaign/lead within the same account
  constraint scheduled_sends_campaign_fk foreign key (campaign_id, account_id)
    references public.campaigns (id, account_id) on delete cascade,
  constraint scheduled_sends_lead_fk foreign key (lead_id, account_id)
    references public.leads (id, account_id) on delete cascade
);

-- scheduler dequeue hot path
create index scheduled_sends_due_idx on public.scheduled_sends (scheduled_for) where status in ('approved', 'scheduled');
create index scheduled_sends_account_status_idx on public.scheduled_sends (account_id, status);
create index scheduled_sends_campaign_idx on public.scheduled_sends (campaign_id);
create index scheduled_sends_lead_idx on public.scheduled_sends (lead_id);

alter table public.scheduled_sends enable row level security;

create policy scheduled_sends_select on public.scheduled_sends
  for select to authenticated using (public.is_account_member(account_id));
create policy scheduled_sends_manage on public.scheduled_sends
  for all to authenticated
  using (public.is_account_admin(account_id))
  with check (public.is_account_admin(account_id));

create trigger scheduled_sends_set_updated_at
  before update on public.scheduled_sends
  for each row execute function public.set_updated_at();

-- The master suppression gate (rule 11): checked before every send on every channel.
-- Entries NEVER expire — there is no expires_at column and no update/delete policy by design.
-- lead_id is ON DELETE SET NULL: suppression must survive lead deletion (incl. GDPR erasure).
create table public.suppression_entries (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  kind text not null check (kind in ('email', 'linkedin')),
  -- lowercased email or normalized linkedin profile URL
  value text not null check (value = lower(value)),
  source text not null check (source in ('unsubscribe', 'bounce', 'complaint', 'manual', 'not_interested', 'gdpr')),
  note text,
  lead_id uuid,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  -- composite FK, set null on lead deletion only (suppression survives GDPR erasure)
  constraint suppression_entries_lead_fk foreign key (lead_id, account_id)
    references public.leads (id, account_id) on delete set null (lead_id)
);

-- suppression-check hot path: one index-only lookup at the scheduler boundary; doubles as dedupe
create unique index suppression_lookup_idx on public.suppression_entries (account_id, kind, value);
create index suppression_entries_lead_idx on public.suppression_entries (lead_id);

alter table public.suppression_entries enable row level security;

create policy suppression_entries_select on public.suppression_entries
  for select to authenticated using (public.is_account_member(account_id));
-- manual adds only; unsubscribe/bounce/complaint writes arrive via service role.
-- No update/delete policies: entries never expire.
create policy suppression_entries_insert on public.suppression_entries
  for insert to authenticated with check (public.is_account_admin(account_id));

-- app_settings: exception to the account_id rule — global/system table (platform kill switch etc.).
-- RLS enabled with NO policies: service-role only; the scheduler reads it server-side.
create table public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

create trigger app_settings_set_updated_at
  before update on public.app_settings
  for each row execute function public.set_updated_at();

insert into public.app_settings (key, value) values ('outreach_kill_switch', 'false'::jsonb);
