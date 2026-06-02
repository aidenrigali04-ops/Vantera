-- Fractional SDR credits (0.1 lead pull, 0.3 outreach send)

ALTER TABLE sdr_credit_accounts
  ALTER COLUMN used_this_period TYPE numeric(12, 1)
  USING used_this_period::numeric(12, 1);

ALTER TABLE sdr_credit_accounts
  ALTER COLUMN used_this_period SET DEFAULT 0;

ALTER TABLE sdr_credit_ledger
  ALTER COLUMN credits TYPE numeric(12, 1)
  USING credits::numeric(12, 1);

ALTER TABLE sdr_credit_ledger
  DROP CONSTRAINT IF EXISTS sdr_credit_ledger_credits_check;

ALTER TABLE sdr_credit_ledger
  ADD CONSTRAINT sdr_credit_ledger_credits_check CHECK (credits > 0);
