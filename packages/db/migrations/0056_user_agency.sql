-- 0056 (UI/UX R6, 2026-07-15): user agency — corrections and knowledge flow BACK from the user.
--
-- 1) edited_by_user_at: stamped when a user corrects a lead's identity fields
--    (first_name/last_name/title/company_name — those columns were already client-writable
--    via the 0025 grant). Drafts read the same columns, so a correction grounds the next
--    message automatically; the stamp records that a human touched the record.
alter table leads add column if not exists edited_by_user_at timestamptz;
comment on column leads.edited_by_user_at is
  'R6: last user correction to identity fields. The corrected values feed drafts directly.';
-- Column-lockdown pattern (0038→0039 gotcha): the edit action runs through the RLS client.
grant update (edited_by_user_at) on leads to authenticated;

-- 2) lead_notes: plain-text annotations on the lead brief (author + timestamp).
--    RLS in the same migration (rule 02). Any workspace member can read and add;
--    a note is deleted by its author or a workspace admin. Notes are immutable (no update).
--    Retention (rule 11): notes are the customer's own work product, kept for the life of
--    the lead — they cascade with the lead row (GDPR erasure + retention purge included).
create table public.lead_notes (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  author_user_id uuid references auth.users(id) on delete set null,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index lead_notes_lead_idx on public.lead_notes (lead_id, created_at desc);

alter table public.lead_notes enable row level security;

create policy lead_notes_select on public.lead_notes
  for select to authenticated using (public.is_account_member(account_id));
create policy lead_notes_insert on public.lead_notes
  for insert to authenticated
  with check (public.is_account_member(account_id) and author_user_id = (select auth.uid()));
create policy lead_notes_delete on public.lead_notes
  for delete to authenticated
  using (author_user_id = (select auth.uid()) or public.is_account_admin(account_id));
