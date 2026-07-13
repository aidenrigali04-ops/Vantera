-- Proof grounding (2026-07-12): account-scoped, citable proof / pricing / FAQ facts the
-- conversation brains may quote when a prospect asks for evidence or price. The facts are injected
-- into the leadBlock grounding string, so findUngroundedClaims whitelists any metric quoted from a
-- proof point automatically (no humanizer change). These are the seller's own attested facts, NOT
-- prospect data, so there is no retention window. Member-read, admin-manage (same posture as the
-- ad_campaigns config table, 0030).

create table public.proof_points (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  -- how the brain uses it: a stat, an anonymized outcome/case study, a price, or an FAQ answer
  kind text not null check (kind in ('metric', 'outcome', 'pricing', 'faq')),
  -- the citable sentence, quoted verbatim by the brain (never invented beyond it)
  text text not null,
  -- only for kind = 'faq': the objection/question this fact answers
  question text,
  sort integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index proof_points_account_idx on public.proof_points (account_id);

alter table public.proof_points enable row level security;

-- Members read (the brains + the settings page); only admins add/edit/remove — proof is sent to
-- prospects as fact on the account's behalf, so editing it is an admin-class action.
create policy proof_points_select on public.proof_points
  for select to authenticated using (public.is_account_member(account_id));
create policy proof_points_manage on public.proof_points
  for all to authenticated
  using (public.is_account_admin(account_id))
  with check (public.is_account_admin(account_id));

create trigger proof_points_set_updated_at
  before update on public.proof_points
  for each row execute function public.set_updated_at();
