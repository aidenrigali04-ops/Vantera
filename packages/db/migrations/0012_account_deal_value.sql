-- Migration #13: average deal value per closed client (dashboard revenue snapshot).
-- The dashboard turns lead counts into dollars: closed (converted) and expected
-- (stage-weighted pipeline) MRR vs. the account's revenue_goal_cents. Leads carry
-- no monetary value, so the per-client value lives on the account, set in Settings.
-- Nullable: blank until the user provides it (the snapshot shows counts until then).

alter table public.accounts
  add column avg_deal_value_cents bigint;

-- Same column-level grant pattern as 0001: client updates limited to settable fields.
grant update (avg_deal_value_cents) on public.accounts to authenticated;
