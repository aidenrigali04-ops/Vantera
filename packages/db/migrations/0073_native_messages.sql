-- Migration #73: mirror messages the user types natively in LinkedIn into the Vantera thread.
--
-- Root cause (prod, found 2026-10-27): the inbox stitches a lead's thread from scheduled_sends
-- (what Vantera sent) + replies (what the prospect sent). A message the account owner typed in
-- LinkedIn itself arrives as an outbound echo webhook, which only paused the agent — its text was
-- stored nowhere, so threads the user had personally answered showed the prospect talking to
-- nobody. These rows are NOT sends: they live outside scheduled_sends on purpose, so they never
-- count toward send KPIs, sender caps, sequence touches, or own-message echo detection.
--
-- retention(native_messages): conversation content in a lead's thread, so rows cascade with their
-- lead (same window as replies, rule 11).
create table public.native_messages (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  -- composite FK (0002 leads_id_account_unique): the database itself guarantees the lead belongs
  -- to the same tenant as the row, not just the writer code
  lead_id uuid not null,
  channel text not null default 'linkedin' check (channel in ('linkedin')),
  -- the provider's message id — the same key on the webhook and the thread-sync read, so the two
  -- paths can never mirror one message twice
  provider_message_ref text not null,
  body text not null,
  sent_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint native_messages_lead_same_account
    foreign key (lead_id, account_id) references public.leads(id, account_id) on delete cascade
);

create unique index native_messages_provider_message_ref_idx
  on public.native_messages (account_id, provider_message_ref);
create index native_messages_lead_idx on public.native_messages (lead_id, sent_at);
create index native_messages_account_sent_idx on public.native_messages (account_id, sent_at desc);

alter table public.native_messages enable row level security;

-- written only by the inbound pipeline via service role — no client write policies
create policy native_messages_select on public.native_messages
  for select to authenticated using (public.is_account_member(account_id));

-- Thread-sync rotation (the webhook-independent backstop): when this lead's LinkedIn thread was
-- last reconciled against the provider. Null = never; the sync drains oldest-first so every
-- contacted lead's thread is re-checked in turn. Service-role writes only (no client grant).
alter table public.leads add column linkedin_thread_synced_at timestamptz;

create index leads_thread_sync_idx
  on public.leads (linkedin_thread_synced_at nulls first)
  where linkedin_provider_ref is not null;
