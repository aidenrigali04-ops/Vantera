-- 0038: capture the user's role + their own LinkedIn URL on the onboarding "Personalize" step.
-- Both nullable so existing accounts are unaffected; RLS on `accounts` already governs access
-- (same row, new columns — no new policy needed).
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS onboarding_role text;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS onboarding_linkedin_url text;
