-- Migration #43: reply matching — the provider-id join key + reply replay safety.
--
-- Root cause (prod, found 2026-07-05): inbound LinkedIn webhooks identify the prospect by
-- member provider_id (ACoAA…), while leads store the vanity URL from discovery — the URL
-- match never hit, every reply exited "no matching lead", and analytics showed 0 replied
-- despite 131 stored webhook events. Fix: persist the prospect's provider_id (resolved at
-- send time anyway) and match on it first; URL and unique-name matching are fallbacks that
-- BACKFILL this column, so the system self-heals for leads contacted before this migration.
--
-- Also a partial unique index on replies(account_id, provider_message_ref): provider
-- retries and the stored-event replay (backfilling the missed replies) can never insert
-- the same reply twice.
--
-- Columns on existing RLS-protected tables — no policy changes; service-role writes only
-- (no client grant on the new column, matching the other service-written lead columns).

alter table public.leads add column linkedin_provider_ref text;

create index leads_linkedin_provider_ref_idx
  on public.leads (account_id, linkedin_provider_ref)
  where linkedin_provider_ref is not null;

create unique index replies_provider_message_ref_idx
  on public.replies (account_id, provider_message_ref)
  where provider_message_ref is not null;
