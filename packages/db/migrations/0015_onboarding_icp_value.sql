-- Onboarding ICP + value proposition captured during workspace setup.

ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS icp_description text,
  ADD COLUMN IF NOT EXISTS value_proposition text;
