-- Onboarding now runs the website scan inline (server action calling the agent-brains
-- scanWebsite) and persists the result itself, so the scan columns added in 0007 need a
-- client grant. RLS (accounts_update, admin-scoped via is_account_admin) still restricts
-- writes to the caller's own account — onboarding runs as the account creator, who
-- create_account makes an owner; the scan is the seller's own context — same trust level as the
-- onboarding_industry/onboarding_icp fields they type. The prospect pipeline keeps
-- writing via service role and refreshes the scan when stale.
grant update (website_scan, website_scanned_at) on public.accounts to authenticated;
