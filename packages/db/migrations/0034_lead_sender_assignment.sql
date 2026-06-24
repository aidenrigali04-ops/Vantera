-- 0034: sticky sender assignment for multi-sender distribution (Phase 14, rule 04/13).
-- A lead is assigned to exactly ONE LinkedIn sender account for its whole outreach
-- lifecycle: an invite and its follow-up message must come from the same account
-- (you can only message a connection from the account that connected to them).
-- Nullable: a lead is unassigned until its first invite is dispatched. RLS already
-- governs public.leads (tenant-scoped via account_id, rule 02) — no new policy needed.
-- on delete set null: if a sender account is removed, the lead is simply re-assignable.

alter table public.leads
  add column linkedin_account_id uuid references public.linkedin_accounts(id) on delete set null;

create index leads_linkedin_account_idx on public.leads(linkedin_account_id);
