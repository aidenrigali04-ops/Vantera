-- Client portal customization (services, sections, welcome copy)
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS portal_config jsonb NOT NULL DEFAULT '{}'::jsonb;
