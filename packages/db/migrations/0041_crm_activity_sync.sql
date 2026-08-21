-- Migration #41: CRM activity sync (extends the Phase 9 push, 0015/0016).
-- Opt-in per connection via config.activity on crm_connections (jsonb, no new column):
--   { activity: { enabled: bool,
--                 events: { outreach: bool, replies: bool, meetings: bool },
--                 watermark: iso } }
-- When enabled, the crm-activity-sync pipeline (service role) logs LinkedIn touches as
-- timeline notes on the destination contact, creating the contact at the FIRST synced
-- touch — i.e. before close, which the account explicitly opted into; the default stays
-- closed-won-only (rule 01). The watermark starts at enable-time so history is never
-- back-dumped into the customer's CRM.
--
-- crm_contact_refs remembers the destination's contact id per (connection, lead) so all
-- of a lead's touches land on ONE contact — never a duplicate contact per event.
--
-- Written ONLY by the service-role pipeline — deliberately no authenticated write policy;
-- members may read (powers "synced" indicators). RLS in this same migration (rule 02).
--
-- retention(crm_contact_refs): rows cascade with the lead (GDPR erasure deletes the ref),
-- with the connection (disconnect forgets the destination ids), and with the account.
-- Refs exist only for leads on an account that opted into activity sync.

create table public.crm_contact_refs (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  connection_id uuid not null references public.crm_connections(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  external_ref text not null,
  created_at timestamptz not null default now()
);

create unique index crm_contact_refs_connection_lead_idx
  on public.crm_contact_refs (connection_id, lead_id);
create index crm_contact_refs_account_idx on public.crm_contact_refs (account_id);

alter table public.crm_contact_refs enable row level security;

create policy crm_contact_refs_select on public.crm_contact_refs
  for select to authenticated using (public.is_account_member(account_id));
