-- LinkedIn Chrome extension auth (per workspace user)
ALTER TABLE "linkedin_accounts"
  ADD COLUMN IF NOT EXISTS "extension_token_hash" text,
  ADD COLUMN IF NOT EXISTS "extension_token_prefix" varchar(16),
  ADD COLUMN IF NOT EXISTS "extension_last_seen_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "extension_token_revoked_at" timestamptz;
