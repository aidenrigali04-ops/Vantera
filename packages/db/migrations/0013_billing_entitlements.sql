-- 0013: subscription entitlement snapshot + Stripe webhook idempotency source.
-- Snapshot is server-managed (written only by the Stripe webhook via the service role);
-- clients can never write these columns (column grants below).

alter table public.accounts
  add column plan text not null default 'none'
    check (plan in ('none','starter','growth','scale')),
  add column subscription_status text not null default 'none'
    check (subscription_status in ('none','trialing','active','past_due','canceled')),
  add column seats_purchased integer not null default 0,
  add column linkedin_accounts_purchased integer not null default 0,
  add column current_period_end timestamptz;

-- Re-issue the column-scoped client UPDATE grant so the new billing columns are NOT
-- client-writable. Prior grants were additive across 0001, 0007, 0010, and 0012;
-- we revoke everything and re-issue the full union here so the billing columns can
-- never slip through. Column set: 0001 (name, onboarding_industry, onboarding_icp,
-- revenue_goal_cents, onboarding_completed_at) + 0007 (website_url) +
-- 0010 (website_scan, website_scanned_at) + 0012 (avg_deal_value_cents).
-- Also closes a pre-existing gap: sender_address and outreach_paused are client-written
-- by channels/actions.ts (saveSenderAddress, toggleSendingPause) but were never formally
-- column-granted, so those client UPDATEs would have been rejected under the column-scoped
-- grant. Both are legitimately user-writable, so we add them here.
revoke update on table public.accounts from anon, authenticated;
grant update (name, onboarding_industry, onboarding_icp, revenue_goal_cents, onboarding_completed_at, website_url, website_scan, website_scanned_at, avg_deal_value_cents, sender_address, outreach_paused)
  on table public.accounts to authenticated;

-- Stripe joins the webhook idempotency table (same dedupe pattern as email/linkedin).
-- The inline check created in 0009 is named webhook_events_source_check by Postgres convention.
alter table public.webhook_events
  drop constraint if exists webhook_events_source_check;
alter table public.webhook_events
  add constraint webhook_events_source_check
  check (source in ('email','linkedin','stripe'));
