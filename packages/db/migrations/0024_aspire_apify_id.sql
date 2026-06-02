-- Prospects are sourced from Apify, not Apollo.io — rename column + fix ON CONFLICT arbiter.

DROP INDEX IF EXISTS aspire_results_account_apollo_idx;
DROP INDEX IF EXISTS aspire_results_account_apify_idx;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'aspire_results'
      AND column_name = 'apollo_id'
  ) THEN
    ALTER TABLE aspire_results RENAME COLUMN apollo_id TO apify_id;
  END IF;
END $$;

DELETE FROM aspire_results a
USING aspire_results b
WHERE a.account_id = b.account_id
  AND a.apify_id IS NOT NULL
  AND a.apify_id = b.apify_id
  AND a.id < b.id;

CREATE UNIQUE INDEX IF NOT EXISTS aspire_results_account_apify_idx
  ON aspire_results (account_id, apify_id);
