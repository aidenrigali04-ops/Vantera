-- Client portal auth is separate from Vantera admin (Supabase) users.
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS portal_password_hash text,
  ADD COLUMN IF NOT EXISTS portal_account_created_at timestamptz;

CREATE TABLE IF NOT EXISTS portal_invite_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS portal_invite_tokens_contact_idx
  ON portal_invite_tokens (contact_id);

CREATE UNIQUE INDEX IF NOT EXISTS portal_invite_tokens_hash_idx
  ON portal_invite_tokens (token_hash);
