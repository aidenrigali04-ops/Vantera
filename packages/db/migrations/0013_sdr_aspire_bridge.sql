-- Phase 1: SDR ↔ Aspire bridge (Prospect Scout uses saved searches)

CREATE TABLE IF NOT EXISTS sdr_aspire_bindings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  config_id uuid NOT NULL REFERENCES sdr_agent_configs(id) ON DELETE CASCADE,
  saved_search_id uuid NOT NULL REFERENCES aspire_saved_searches(id) ON DELETE CASCADE,
  priority smallint NOT NULL DEFAULT 0,
  min_icp_score smallint NOT NULL DEFAULT 70,
  max_leads_per_run smallint NOT NULL DEFAULT 25,
  auto_enroll_sdr boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (config_id, saved_search_id)
);

CREATE INDEX IF NOT EXISTS sdr_aspire_bindings_account_idx
  ON sdr_aspire_bindings (account_id, is_active);

CREATE INDEX IF NOT EXISTS sdr_aspire_bindings_config_idx
  ON sdr_aspire_bindings (config_id, priority DESC);

ALTER TABLE sdr_agent_configs
  ADD COLUMN IF NOT EXISTS prospect_mode text NOT NULL DEFAULT 'aspire_bound',
  ADD COLUMN IF NOT EXISTS default_min_icp_score smallint NOT NULL DEFAULT 70,
  ADD COLUMN IF NOT EXISTS sync_icp_to_saved_searches boolean NOT NULL DEFAULT true;

ALTER TABLE aspire_saved_searches
  ADD COLUMN IF NOT EXISTS icp_config jsonb;

ALTER TABLE aspire_search_runs
  ADD COLUMN IF NOT EXISTS config_id uuid REFERENCES sdr_agent_configs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status varchar(20) NOT NULL DEFAULT 'success',
  ADD COLUMN IF NOT EXISTS enrolled_count smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS error_message text,
  ADD COLUMN IF NOT EXISTS finished_at timestamptz;

CREATE INDEX IF NOT EXISTS aspire_search_runs_status_idx
  ON aspire_search_runs (account_id, run_at DESC);
