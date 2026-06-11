-- Migration #5: channel identities (mailboxes, linkedin accounts), outreach audit trail, replies, unsubscribe tokens (rules 03/04/11).

-- provisioned sending identities; provider_ref stays vendor-neutral (white-label, rule 03)
create table public.mailboxes (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  email_address text not null,
  domain text,
  provider_ref text,
  status text not null check (status in ('provisioning', 'warming', 'active', 'paused', 'error')) default 'provisioning',
  warmup_started_at timestamptz,
  health jsonb,
  daily_send_limit integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index mailboxes_account_email_idx on public.mailboxes (account_id, email_address);
create index mailboxes_account_status_idx on public.mailboxes (account_id, status);

alter table public.mailboxes enable row level security;

create policy mailboxes_select on public.mailboxes
  for select to authenticated using (public.is_account_member(account_id));
create policy mailboxes_manage on public.mailboxes
  for all to authenticated
  using (public.is_account_admin(account_id))
  with check (public.is_account_admin(account_id));

create trigger mailboxes_set_updated_at
  before update on public.mailboxes
  for each row execute function public.set_updated_at();

-- connected LinkedIn identities; safety limits live in scheduler code, not as configurable data (rule 04)
create table public.linkedin_accounts (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  provider_ref text not null,
  profile_url text,
  display_name text,
  status text not null check (status in ('connecting', 'active', 'restricted', 'disconnected')) default 'connecting',
  connected_by uuid references auth.users(id) on delete set null,
  connected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index linkedin_accounts_provider_idx on public.linkedin_accounts (account_id, provider_ref);
create index linkedin_accounts_account_status_idx on public.linkedin_accounts (account_id, status);

alter table public.linkedin_accounts enable row level security;

create policy linkedin_accounts_select on public.linkedin_accounts
  for select to authenticated using (public.is_account_member(account_id));
create policy linkedin_accounts_manage on public.linkedin_accounts
  for all to authenticated
  using (public.is_account_admin(account_id))
  with check (public.is_account_admin(account_id));

create trigger linkedin_accounts_set_updated_at
  before update on public.linkedin_accounts
  for each row execute function public.set_updated_at();

-- Append-only send audit (rule 11): refs only, no message body/PII, so it survives lead erasure
-- (all FKs set null). Inserts happen via service role from the scheduler — no client write policies.
create table public.outreach_sends (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  scheduled_send_id uuid references public.scheduled_sends(id) on delete set null,
  channel text not null check (channel in ('email', 'linkedin')),
  mailbox_id uuid references public.mailboxes(id) on delete set null,
  linkedin_account_id uuid references public.linkedin_accounts(id) on delete set null,
  message_ref text,
  sent_at timestamptz not null default now()
);

create index outreach_sends_account_sent_idx on public.outreach_sends (account_id, sent_at desc);
create index outreach_sends_campaign_idx on public.outreach_sends (campaign_id);
create index outreach_sends_lead_idx on public.outreach_sends (lead_id);
create index outreach_sends_scheduled_send_idx on public.outreach_sends (scheduled_send_id);
create index outreach_sends_mailbox_idx on public.outreach_sends (mailbox_id);
create index outreach_sends_linkedin_account_idx on public.outreach_sends (linkedin_account_id);

alter table public.outreach_sends enable row level security;

create policy outreach_sends_select on public.outreach_sends
  for select to authenticated using (public.is_account_member(account_id));

-- retention(replies): prospect-authored content, so rows cascade with their lead (rule 11).
create table public.replies (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete set null,
  outreach_send_id uuid references public.outreach_sends(id) on delete set null,
  channel text not null check (channel in ('email', 'linkedin')),
  provider_message_ref text,
  body text,
  received_at timestamptz not null,
  classification text check (classification in ('interested', 'not_interested', 'neutral', 'out_of_office', 'bounce', 'unsubscribe', 'other')),
  classification_rationale text,
  classified_at timestamptz,
  created_at timestamptz not null default now()
);

create index replies_account_received_idx on public.replies (account_id, received_at desc);
create index replies_lead_idx on public.replies (lead_id);
create index replies_campaign_idx on public.replies (campaign_id);
create index replies_outreach_send_idx on public.replies (outreach_send_id);

alter table public.replies enable row level security;

-- written only by the reply webhook handlers via service role — no client write policies
create policy replies_select on public.replies
  for select to authenticated using (public.is_account_member(account_id));

-- one-click unsubscribe: the public route resolves the token via service role (no login, rule 11);
-- clients can read their own, never write.
create table public.unsubscribe_tokens (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  email text not null,
  token uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now(),
  used_at timestamptz
);

create index unsubscribe_tokens_lead_idx on public.unsubscribe_tokens (lead_id);
create index unsubscribe_tokens_account_idx on public.unsubscribe_tokens (account_id);

alter table public.unsubscribe_tokens enable row level security;

create policy unsubscribe_tokens_select on public.unsubscribe_tokens
  for select to authenticated using (public.is_account_member(account_id));
