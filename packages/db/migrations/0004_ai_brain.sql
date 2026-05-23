-- Vantera migration 0004 — AI brain (persistent memory + observation log)
--
-- Adds two tables that turn the AI tooling from stateless calls into a
-- system that remembers what it has learned about each account:
--
--   ai_memory       — distilled, account-scoped knowledge. One row per
--                     (account, kind, subject). Re-running a workflow
--                     UPSERTs the same row and bumps `version`. `confidence`
--                     is 0..100 from the model.
--
--   ai_observations — append-only log of every AI-relevant event. Feeds the
--                     learning loop: future workflows can look back at which
--                     signals were dismissed, which drafts shipped, which
--                     predictions came true, and tighten prompts accordingly.
--
-- Both tables are RLS-ready (no policies in this migration — those land
-- alongside the rest of the account-isolation policies in 0001).

CREATE TYPE ai_memory_kind AS ENUM (
  'business_context',
  'contact_memory',
  'record_memory',
  'pattern',
  'preference'
);

CREATE TYPE ai_observation_kind AS ENUM (
  'tool_called',
  'signal_generated',
  'signal_dismissed',
  'message_drafted',
  'message_sent',
  'recommendation_accepted',
  'recommendation_dismissed',
  'prediction_made',
  'prediction_outcome'
);

CREATE TABLE IF NOT EXISTS ai_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  kind ai_memory_kind NOT NULL,
  subject_type varchar(30) NOT NULL,
  subject_id uuid NOT NULL,
  summary text NOT NULL,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence smallint NOT NULL DEFAULT 50,
  version smallint NOT NULL DEFAULT 1,
  model_used varchar(80),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ai_memory_account_kind_subject_idx
  ON ai_memory (account_id, kind, subject_type, subject_id);

CREATE INDEX IF NOT EXISTS ai_memory_account_id_idx
  ON ai_memory (account_id);

CREATE INDEX IF NOT EXISTS ai_memory_kind_account_idx
  ON ai_memory (kind, account_id);

CREATE TABLE IF NOT EXISTS ai_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  kind ai_observation_kind NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  outcome varchar(30),
  related_automation_id uuid REFERENCES automations(id),
  related_record_id uuid REFERENCES records(id),
  related_contact_id uuid REFERENCES contacts(id),
  related_signal_id uuid REFERENCES intelligence_signals(id),
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_observations_account_id_idx
  ON ai_observations (account_id);

CREATE INDEX IF NOT EXISTS ai_observations_kind_account_idx
  ON ai_observations (kind, account_id);

CREATE INDEX IF NOT EXISTS ai_observations_occurred_at_idx
  ON ai_observations (occurred_at);

-- Enable RLS so the same account-isolation guards apply here as elsewhere.
-- Policies match the standard pattern in 0001_rls_policies.sql.
ALTER TABLE ai_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_observations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_memory_account_isolation ON ai_memory;
CREATE POLICY ai_memory_account_isolation ON ai_memory
  FOR ALL
  USING (account_id = (auth.jwt() ->> 'account_id')::uuid)
  WITH CHECK (account_id = (auth.jwt() ->> 'account_id')::uuid);

-- Observations are append-only: SELECT + INSERT for tenants, no UPDATE/DELETE.
-- Service role bypasses RLS for backfills and admin maintenance.
DROP POLICY IF EXISTS ai_observations_account_select ON ai_observations;
CREATE POLICY ai_observations_account_select ON ai_observations
  FOR SELECT
  USING (account_id = (auth.jwt() ->> 'account_id')::uuid);

DROP POLICY IF EXISTS ai_observations_account_insert ON ai_observations;
CREATE POLICY ai_observations_account_insert ON ai_observations
  FOR INSERT
  WITH CHECK (account_id = (auth.jwt() ->> 'account_id')::uuid);
