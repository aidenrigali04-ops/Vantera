-- Migration #16: CRM push connections (Phase 9). Vantera is not a CRM (rule 01);
-- closed-won leads are pushed OUT to the customer's own tools. This migration adds
-- the connection-management surface that backs settings/integrations.
--
-- Two adapter shapes behind one crm-infra interface:
--   crm    -> hubspot | salesforce | gohighlevel  (upsert contact + create deal)
--   notify -> slack | monday                       (post message / create board item)
--
-- config jsonb (crm_connections):
--   { autoPush: bool,
--     target: { channelId?, boardId?, pipelineId?, stageId? },   -- destination-specific
--     mapping: { <ourField>: <theirField> } }                    -- field-mapping overrides
--
-- Tokens (access_token_enc / refresh_token_enc) are written ONLY by the service-role
-- OAuth callback (AES-256-GCM, CRM_TOKEN_KEY) and never selected client-side. They are
-- null until the OAuth exchange lands. The push pipeline + crm_push_events audit/retry
-- queue + leads close columns are the remainder of Phase 9 (see the CRM push spec) and
-- are intentionally not in this migration — this one stands up the connection UI.
--
-- retention(crm_connections): operational data tied to the account; cascades on account
-- deletion (RLS-scoped). These are won-customer destinations, not unqualified prospects,
-- so no prospect-data retention window applies.

create table public.crm_connections (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  provider text not null check (provider in
    ('hubspot', 'salesforce', 'gohighlevel', 'slack', 'monday')),
  kind text not null check (kind in ('crm', 'notify')),
  status text not null check (status in
    ('connecting', 'active', 'error', 'disconnected')) default 'connecting',
  access_token_enc text,
  refresh_token_enc text,
  token_expires_at timestamptz,
  external_account_ref text,
  config jsonb not null default '{}'::jsonb,
  last_error text,
  last_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- one connection per destination per account in v1
create unique index crm_connections_account_provider_idx
  on public.crm_connections (account_id, provider);
create index crm_connections_account_status_idx
  on public.crm_connections (account_id, status);

alter table public.crm_connections enable row level security;

-- Members read their account's connections; admins manage them (connect / disconnect /
-- toggle auto-push / save mapping all run through server actions on the user's session).
create policy crm_connections_select on public.crm_connections
  for select to authenticated using (public.is_account_member(account_id));
create policy crm_connections_manage on public.crm_connections
  for all to authenticated
  using (public.is_account_admin(account_id))
  with check (public.is_account_admin(account_id));

create trigger crm_connections_set_updated_at
  before update on public.crm_connections
  for each row execute function public.set_updated_at();
