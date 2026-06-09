-- Unipile LinkedIn integration
-- Replaces Chrome extension with cloud-based LinkedIn API via Unipile

ALTER TABLE linkedin_accounts
  ADD COLUMN IF NOT EXISTS unipile_account_id text,
  ADD COLUMN IF NOT EXISTS unipile_connected boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS unipile_connected_at timestamptz,
  ADD COLUMN IF NOT EXISTS unipile_last_error text;

-- index for fast lookup by unipile account id (webhook routing)
CREATE UNIQUE INDEX IF NOT EXISTS linkedin_accounts_unipile_account_id_idx
  ON linkedin_accounts (unipile_account_id)
  WHERE unipile_account_id IS NOT NULL;
