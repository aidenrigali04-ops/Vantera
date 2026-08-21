-- 0039: 0038 added `onboarding_role` + `onboarding_linkedin_url` but omitted the column-scoped
-- client UPDATE grant. `accounts` uses the column-lockdown pattern (0025): new columns are NOT
-- client-updatable until explicitly granted to `authenticated`. Without this grant, the onboarding
-- "Personalize" step's UPDATE touches ungranted columns and Postgres rejects the whole statement
-- with "permission denied for table accounts" — surfaced to the user as "Could not save your answers."
-- RLS (accounts_update = is_account_admin) stays the real gate; this only widens which columns an
-- admin may write. Mirrors the grant re-issue pattern in 0007/0010/0012/0013/0019.
grant update (onboarding_role, onboarding_linkedin_url) on public.accounts to authenticated;
