-- SDR outreach credits (SDR agent actions only — not manual Aspire add-to-pipeline)

DO $$ BEGIN
  CREATE TYPE sdr_billing_tier AS ENUM ('free', 'standard', 'premium');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS sdr_credit_accounts (
  account_id uuid PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  billing_tier sdr_billing_tier NOT NULL DEFAULT 'free',
  used_this_period numeric(12, 1) NOT NULL DEFAULT 0 CHECK (used_this_period >= 0),
  period_start timestamptz NOT NULL DEFAULT date_trunc('month', now()),
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sdr_credit_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  action varchar(40) NOT NULL,
  credits numeric(12, 1) NOT NULL CHECK (credits > 0),
  reference_id varchar(120),
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sdr_credit_ledger_account_idx
  ON sdr_credit_ledger (account_id, created_at DESC);

ALTER TABLE sdr_credit_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sdr_credit_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sdr_credit_accounts_tenant ON sdr_credit_accounts;
CREATE POLICY sdr_credit_accounts_tenant ON sdr_credit_accounts
  FOR ALL USING (account_id = (auth.jwt() ->> 'account_id')::uuid);

DROP POLICY IF EXISTS sdr_credit_ledger_tenant ON sdr_credit_ledger;
CREATE POLICY sdr_credit_ledger_tenant ON sdr_credit_ledger
  FOR ALL USING (account_id = (auth.jwt() ->> 'account_id')::uuid);

ALTER PUBLICATION supabase_realtime ADD TABLE sdr_credit_accounts;
