-- Phase 2: Sales intelligence — aspire results, lead drafts, lead scores

ALTER TABLE aspire_saved_searches
  ADD COLUMN IF NOT EXISTS audience_id uuid,
  ADD COLUMN IF NOT EXISTS run_frequency varchar(20) NOT NULL DEFAULT 'weekly',
  ADD COLUMN IF NOT EXISTS last_run_at timestamptz,
  ADD COLUMN IF NOT EXISTS total_found smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS aspire_saved_searches_active_idx
  ON aspire_saved_searches (is_active, account_id);

CREATE TABLE IF NOT EXISTS aspire_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  search_id uuid REFERENCES aspire_saved_searches(id),
  lead_id uuid REFERENCES leads(id),
  apollo_id varchar(255),
  raw_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  icp_score smallint NOT NULL DEFAULT 0,
  icp_signals jsonb NOT NULL DEFAULT '[]'::jsonb,
  status varchar(30) NOT NULL DEFAULT 'found',
  enrolled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS aspire_results_account_id_idx ON aspire_results (account_id);
CREATE INDEX IF NOT EXISTS aspire_results_search_id_idx ON aspire_results (search_id, account_id);
CREATE UNIQUE INDEX IF NOT EXISTS aspire_results_account_apollo_idx
  ON aspire_results (account_id, apollo_id)
  WHERE apollo_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS lead_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  channel varchar(20) NOT NULL,
  subject text,
  body text NOT NULL,
  drafted_by varchar(80) NOT NULL DEFAULT 'Sales Assistant',
  status varchar(30) NOT NULL DEFAULT 'pending_review',
  approved_by uuid REFERENCES users(id),
  sent_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS lead_drafts_account_id_idx ON lead_drafts (account_id);
CREATE INDEX IF NOT EXISTS lead_drafts_lead_id_idx ON lead_drafts (lead_id, account_id);
CREATE INDEX IF NOT EXISTS lead_drafts_status_idx ON lead_drafts (status, account_id);

CREATE TABLE IF NOT EXISTS lead_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  icp_score smallint NOT NULL,
  engagement_score smallint NOT NULL,
  composite_score smallint NOT NULL,
  signals jsonb NOT NULL DEFAULT '{}'::jsonb,
  scored_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lead_scores_account_id_idx ON lead_scores (account_id);
CREATE INDEX IF NOT EXISTS lead_scores_lead_id_idx ON lead_scores (lead_id, account_id);
CREATE INDEX IF NOT EXISTS lead_scores_scored_at_idx ON lead_scores (scored_at, account_id);
