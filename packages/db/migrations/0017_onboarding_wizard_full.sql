-- Onboarding wizard rebuild (full migration)
--
-- Run this once on Supabase if you have not applied 0015/0016, or if you want
-- a single idempotent script that ensures all onboarding columns exist.
--
-- Flow supported:
--   Step 1 — business name, website_url, AI-derived icp + value prop
--   Step 2 — AI overview (reads icp_description / value_proposition)
--   Step 3 — lead preview (uses vertical + icp on accounts row)
--   Step 4 — subscription (uses existing plan enum: team | enterprise)

BEGIN;

-- ---------------------------------------------------------------------------
-- accounts — onboarding profile fields
-- ---------------------------------------------------------------------------

ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS icp_description text,
  ADD COLUMN IF NOT EXISTS value_proposition text,
  ADD COLUMN IF NOT EXISTS website_url text;

COMMENT ON COLUMN accounts.icp_description IS
  'AI- or owner-written ideal customer profile from onboarding step 1.';

COMMENT ON COLUMN accounts.value_proposition IS
  'AI- or owner-written value proposition from onboarding step 1.';

COMMENT ON COLUMN accounts.website_url IS
  'Public website URL captured during onboarding step 1.';

-- onboarding_completed_at and active_template_id are created in earlier
-- migrations (0000 / 0003). No changes needed here.

COMMIT;
