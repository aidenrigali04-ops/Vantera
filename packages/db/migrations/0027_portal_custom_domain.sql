-- White-label client portal hostname per workspace
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS portal_domain_status varchar(32) DEFAULT 'not_configured';

ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS portal_domain_dns jsonb DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS accounts_portal_domain_unique
  ON accounts (portal_domain)
  WHERE portal_domain IS NOT NULL AND portal_domain <> '';
