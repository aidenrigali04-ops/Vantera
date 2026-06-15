-- Migration #18: Tracked-CTA conversion tokens. A unique, unguessable token is issued
-- when a CTA link is embedded in an outreach send; following it marks the lead converted
-- and closes the sequence run. Mirrors unsubscribe_tokens (0004) -- DB-backed random token,
-- service-role write surface -- but carries the campaign and the booking target_url that the
-- redirect resolves to. No HMAC: same stateless-vs-table tradeoff as unsubscribe.

-- retention(conversion_tokens): one-shot CTA tokens; swept with the lead/campaign they belong to.
create table public.conversion_tokens (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  campaign_id uuid not null,
  lead_id uuid not null,
  target_url text not null,
  token uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now(),
  used_at timestamptz,
  constraint conversion_tokens_campaign_fk foreign key (campaign_id, account_id)
    references public.campaigns (id, account_id) on delete cascade,
  constraint conversion_tokens_lead_fk foreign key (lead_id, account_id)
    references public.leads (id, account_id) on delete cascade
);

create index conversion_tokens_lead_idx on public.conversion_tokens (lead_id);
create index conversion_tokens_account_idx on public.conversion_tokens (account_id);

alter table public.conversion_tokens enable row level security;

create policy conversion_tokens_select on public.conversion_tokens
  for select to authenticated using (public.is_account_member(account_id));
-- writes (issue token / mark used) arrive via the service-role redirect route only -- no client write policy
