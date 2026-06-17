-- Migration #31: Meta Ads + nurturing (Phase 11, rule 01 key initiative). Users generate ad
-- concepts on-platform (copy via Claude, creative via the creative generator), publish them
-- through the white-labeled ads-infra interface, and ad-sourced leads flow into the SAME nurture
-- engine (sequence orchestrator) as everything else. The ad platform's name never reaches the UI.

-- 'ad' joins the leads source set (0009/0029): a lead that came in through an ad lead-form is a
-- normal lead row, distinguishable for attribution; it enters nurture via the existing sequence.
alter table public.leads drop constraint if exists leads_source_check;
alter table public.leads
  add constraint leads_source_check check (source in ('discovery', 'manual', 'import', 'inbound', 'ad'));

-- 'ads' joins the webhook source set (0029): an ad lead-form submission gets idempotency parity.
alter table public.webhook_events drop constraint if exists webhook_events_source_check;
alter table public.webhook_events add constraint webhook_events_source_check
  check (source in ('email', 'linkedin', 'stripe', 'voice', 'imessage', 'inbound', 'ads'));

-- An ad campaign: the user's own generated campaign config. Carries an internal execution
-- campaign (campaign_id) under which ad-sourced leads nurture — the same pattern agents use, so
-- the existing sequence orchestrator picks them up. User-owned content: cascades with the account.
create table public.ad_campaigns (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  name text not null,
  -- what this ad promotes + who it targets + what a click leads to (the generation inputs)
  offer text not null,
  target_icp text not null,
  cta text not null,
  status text not null check (status in ('draft', 'published', 'paused', 'archived')) default 'draft',
  daily_budget_cents bigint,
  -- provider-side handles, set by the service-role publish path (not sensitive)
  lead_form_id text,
  provider_campaign_id text,
  -- attribution ref passed to the provider so the lead webhook maps back to this row
  campaign_ref uuid not null default gen_random_uuid(),
  -- internal nurture campaign ad-sourced leads hang off (composite same-tenant FK)
  campaign_id uuid,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ad_campaigns_id_account_unique unique (id, account_id),
  constraint ad_campaigns_campaign_fk foreign key (campaign_id, account_id)
    references public.campaigns (id, account_id) on delete set null (campaign_id)
);

create index ad_campaigns_account_idx on public.ad_campaigns (account_id);
create unique index ad_campaigns_ref_idx on public.ad_campaigns (campaign_ref);

alter table public.ad_campaigns enable row level security;

create policy ad_campaigns_select on public.ad_campaigns
  for select to authenticated using (public.is_account_member(account_id));
create policy ad_campaigns_manage on public.ad_campaigns
  for all to authenticated
  using (public.is_account_admin(account_id))
  with check (public.is_account_admin(account_id));

create trigger ad_campaigns_set_updated_at
  before update on public.ad_campaigns
  for each row execute function public.set_updated_at();

-- Generated ad-concept variants under a campaign (copy + the creative brief). creative_url is set
-- once the creative generator produces an asset; style_flags carries unresolved humanizer flags so
-- a concept with a fabricated claim is never silently published (report #6).
create table public.ad_creatives (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  ad_campaign_id uuid not null,
  headline text not null,
  primary_text text not null,
  description text,
  cta text not null,
  creative_prompt text not null,
  creative_url text,
  style_flags text,
  status text not null check (status in ('draft', 'selected', 'published')) default 'draft',
  created_at timestamptz not null default now(),
  constraint ad_creatives_campaign_fk foreign key (ad_campaign_id, account_id)
    references public.ad_campaigns (id, account_id) on delete cascade
);

create index ad_creatives_campaign_idx on public.ad_creatives (ad_campaign_id);
create index ad_creatives_account_idx on public.ad_creatives (account_id);

alter table public.ad_creatives enable row level security;

create policy ad_creatives_select on public.ad_creatives
  for select to authenticated using (public.is_account_member(account_id));
create policy ad_creatives_manage on public.ad_creatives
  for all to authenticated
  using (public.is_account_admin(account_id))
  with check (public.is_account_admin(account_id));
