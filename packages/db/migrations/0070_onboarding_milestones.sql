-- 0070 (UX-1): onboarding milestones — when the user confirmed the drafted ICP and reviewed the first prospects. Nullable; stamped by server actions; read by the onboarding step resolver and the Today checklist. No RLS change (accounts policies already cover them).

alter table public.accounts
  add column buyers_confirmed_at timestamptz,
  add column prospects_reviewed_at timestamptz;

-- Stamped by onboarding server actions through the session client, so the two columns get the same column-level UPDATE grant the 0025 lockdown requires (as 0039/0063 did).
grant update (buyers_confirmed_at, prospects_reviewed_at) on public.accounts to authenticated;
