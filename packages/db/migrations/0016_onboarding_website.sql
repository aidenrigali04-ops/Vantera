-- Business website captured during onboarding step 1.

ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS website_url text;
