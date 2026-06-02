-- Phase 3: Supabase Realtime for SDR / Aspire tables

-- JWT-scoped RLS (browser Supabase client uses auth.jwt() ->> 'account_id')
ALTER TABLE aspire_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE sdr_activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "aspire_results_jwt_select" ON aspire_results;
CREATE POLICY "aspire_results_jwt_select" ON aspire_results
  FOR SELECT
  TO authenticated
  USING (account_id = (auth.jwt() ->> 'account_id')::uuid);

DROP POLICY IF EXISTS "sdr_activity_log_jwt_select" ON sdr_activity_log;
CREATE POLICY "sdr_activity_log_jwt_select" ON sdr_activity_log
  FOR SELECT
  TO authenticated
  USING (account_id = (auth.jwt() ->> 'account_id')::uuid);

-- aspire_search_runs: add JWT policy (0006 used app.current_account_id for service paths)
DROP POLICY IF EXISTS "aspire_search_runs_jwt_select" ON aspire_search_runs;
CREATE POLICY "aspire_search_runs_jwt_select" ON aspire_search_runs
  FOR SELECT
  TO authenticated
  USING (account_id = (auth.jwt() ->> 'account_id')::uuid);

-- Add tables to Supabase Realtime publication (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'aspire_search_runs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.aspire_search_runs;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'aspire_results'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.aspire_results;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'sdr_activity_log'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sdr_activity_log;
  END IF;
END $$;
