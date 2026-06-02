-- Short ICP headline from onboarding AI analysis (used for lead search + step 2 UI).

ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS icp_summary text;

COMMENT ON COLUMN accounts.icp_summary IS
  'One-line ideal customer summary from onboarding AI analysis.';
