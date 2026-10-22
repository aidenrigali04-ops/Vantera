-- 0065 (ML-4, 2026-10-21): fit feedback on any prospect — "Good fit" / "Not a fit".
--
-- The user's verdict on who they actually want to talk to. It feeds the qualification brain as
-- revealed preferences (alongside review-queue "wrong person" rejections and positive replies),
-- and a "Not a fit" lead is excluded from drafting by the pipeline (reversible: flip the verdict).
-- One verdict per lead — the latest click wins (upsert on lead_id).
--
-- Tenancy: account_id + a composite FK (lead_id, account_id) → leads (id, account_id), so a verdict
-- can only ever attach to a lead in the same workspace (same pattern as lead_signals, 0031).
-- RLS in the same migration (rule 02): any workspace member reads and records a verdict (like
-- lead_notes, 0056); the author is pinned to the caller. Writes go through the RLS client.
--
-- Retention (rule 11): retention(lead_feedback) = life of the lead. Verdicts are the customer's own
-- work product about their prospect and cascade with the lead row (GDPR erasure + retention purge).
create table public.lead_feedback (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  lead_id uuid not null,
  verdict text not null check (verdict in ('good_fit', 'not_fit')),
  reason text check (reason is null or char_length(reason) between 1 and 200),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lead_feedback_lead_fk foreign key (lead_id, account_id)
    references public.leads (id, account_id) on delete cascade,
  constraint lead_feedback_lead_unique unique (lead_id)
);

-- revealed-preferences read: the account's latest verdicts of each kind
create index lead_feedback_account_idx on public.lead_feedback (account_id, verdict, updated_at desc);
-- auth-user deletion sets created_by null — index the FK so that isn't a scan
create index lead_feedback_created_by_idx on public.lead_feedback (created_by);

-- a flipped verdict (upsert → update) must re-stamp updated_at: the revealed-preferences read
-- ranks by recency
create trigger lead_feedback_set_updated_at
  before update on public.lead_feedback
  for each row execute function public.set_updated_at();

alter table public.lead_feedback enable row level security;

create policy lead_feedback_select on public.lead_feedback
  for select to authenticated using (public.is_account_member(account_id));
create policy lead_feedback_insert on public.lead_feedback
  for insert to authenticated
  with check (public.is_account_member(account_id) and created_by = (select auth.uid()));
-- any member may change the verdict (it becomes theirs); the author is re-pinned on every write
create policy lead_feedback_update on public.lead_feedback
  for update to authenticated
  using (public.is_account_member(account_id))
  with check (public.is_account_member(account_id) and created_by = (select auth.uid()));
-- clearing a verdict: its author or a workspace admin (same rule as lead_notes, 0056)
create policy lead_feedback_delete on public.lead_feedback
  for delete to authenticated
  using (created_by = (select auth.uid()) or public.is_account_admin(account_id));
