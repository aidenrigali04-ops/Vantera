-- Per-account custom outreach email domains (white-label sending + inbound replies)

ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS outreach_from_domain varchar(255),
  ADD COLUMN IF NOT EXISTS outreach_inbound_domain varchar(255),
  ADD COLUMN IF NOT EXISTS outreach_from_local_part varchar(64) DEFAULT 'outreach',
  ADD COLUMN IF NOT EXISTS outreach_domain_status varchar(32) DEFAULT 'not_configured',
  ADD COLUMN IF NOT EXISTS resend_outreach_domain_id varchar(255),
  ADD COLUMN IF NOT EXISTS outreach_domain_dns jsonb DEFAULT '{}'::jsonb;
