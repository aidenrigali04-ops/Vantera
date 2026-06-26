-- Migration 0036: O(1) reply attribution via a normalized LinkedIn URL column.
-- Inbound reply/acceptance webhooks resolved the lead by scanning ALL of an account's
-- leads and normalizing each in JS (findLeadByLinkedInUrl) — O(account leads) per event,
-- which slows reply handling (and thus suppression/stop) as a tenant's lead table grows.
--
-- A DB-maintained GENERATED column + index turns it into an indexed lookup. The column is
-- generated from linkedin_url, so it can never drift from the source. The application read
-- path keeps a scan + JS-normalize fallback for any row whose stored normalize diverges from
-- the JS normalizeLinkedInUrl (e.g. exotic whitespace), so a reply is never mis-attributed.
-- The new column is covered by the existing leads RLS policies (leads_select / leads_manage).

alter table public.leads
  add column if not exists linkedin_url_normalized text
  generated always as (regexp_replace(lower(btrim(linkedin_url)), '/+$', '')) stored;

create index if not exists leads_account_linkedin_norm_idx
  on public.leads (account_id, linkedin_url_normalized)
  where linkedin_url_normalized is not null;
