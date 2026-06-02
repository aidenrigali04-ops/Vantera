-- Security hardening: supplemental RLS aligned with Vantera JWT claims (auth.jwt() ->> 'account_id').
-- Idempotent — safe to re-run. Complements 0001_rls_policies.sql, 0006, 0014.

-- ─── integration_credentials: dashboard read-only (writes via service role / Drizzle) ───
ALTER TABLE integration_credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "integration_credentials_account_isolation" ON integration_credentials;
DROP POLICY IF EXISTS "integration_credentials_tenant_select" ON integration_credentials;

CREATE POLICY "integration_credentials_tenant_select" ON integration_credentials
  FOR SELECT
  TO authenticated
  USING (account_id = (auth.jwt() ->> 'account_id')::uuid);

-- ─── feature_flags: read-only for authenticated clients ───
DROP POLICY IF EXISTS "feature_flags_account_isolation" ON feature_flags;
DROP POLICY IF EXISTS "feature_flags_tenant_select" ON feature_flags;

CREATE POLICY "feature_flags_tenant_select" ON feature_flags
  FOR SELECT
  TO authenticated
  USING (account_id = (auth.jwt() ->> 'account_id')::uuid);

-- ─── automation_runs: SELECT only (jobs write via service role) ───
DROP POLICY IF EXISTS "automation_runs_account_isolation" ON automation_runs;
DROP POLICY IF EXISTS "automation_runs_tenant_select" ON automation_runs;

CREATE POLICY "automation_runs_tenant_select" ON automation_runs
  FOR SELECT
  TO authenticated
  USING (account_id = (auth.jwt() ->> 'account_id')::uuid);

-- ─── Leads / Aspire / SDR / Outreach (JWT tenant isolation) ───
ALTER TABLE IF EXISTS lead_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS lead_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS aspire_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS sdr_agent_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS sdr_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS sdr_sequence_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS sdr_aspire_bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS outreach_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS outreach_campaign_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS outreach_campaign_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS ai_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS ai_observations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lead_scores_tenant_isolation" ON lead_scores;
CREATE POLICY "lead_scores_tenant_isolation" ON lead_scores
  FOR ALL TO authenticated
  USING (account_id = (auth.jwt() ->> 'account_id')::uuid)
  WITH CHECK (account_id = (auth.jwt() ->> 'account_id')::uuid);

DROP POLICY IF EXISTS "lead_drafts_tenant_isolation" ON lead_drafts;
CREATE POLICY "lead_drafts_tenant_isolation" ON lead_drafts
  FOR ALL TO authenticated
  USING (account_id = (auth.jwt() ->> 'account_id')::uuid)
  WITH CHECK (account_id = (auth.jwt() ->> 'account_id')::uuid);

DROP POLICY IF EXISTS "aspire_results_tenant_isolation" ON aspire_results;
CREATE POLICY "aspire_results_tenant_isolation" ON aspire_results
  FOR ALL TO authenticated
  USING (account_id = (auth.jwt() ->> 'account_id')::uuid)
  WITH CHECK (account_id = (auth.jwt() ->> 'account_id')::uuid);

DROP POLICY IF EXISTS "sdr_agent_configs_tenant_isolation" ON sdr_agent_configs;
CREATE POLICY "sdr_agent_configs_tenant_isolation" ON sdr_agent_configs
  FOR ALL TO authenticated
  USING (account_id = (auth.jwt() ->> 'account_id')::uuid)
  WITH CHECK (account_id = (auth.jwt() ->> 'account_id')::uuid);

DROP POLICY IF EXISTS "sdr_sequences_tenant_isolation" ON sdr_sequences;
CREATE POLICY "sdr_sequences_tenant_isolation" ON sdr_sequences
  FOR ALL TO authenticated
  USING (account_id = (auth.jwt() ->> 'account_id')::uuid)
  WITH CHECK (account_id = (auth.jwt() ->> 'account_id')::uuid);

DROP POLICY IF EXISTS "sdr_sequence_steps_tenant_isolation" ON sdr_sequence_steps;
CREATE POLICY "sdr_sequence_steps_tenant_isolation" ON sdr_sequence_steps
  FOR ALL TO authenticated
  USING (account_id = (auth.jwt() ->> 'account_id')::uuid)
  WITH CHECK (account_id = (auth.jwt() ->> 'account_id')::uuid);

DROP POLICY IF EXISTS "sdr_aspire_bindings_tenant_isolation" ON sdr_aspire_bindings;
CREATE POLICY "sdr_aspire_bindings_tenant_isolation" ON sdr_aspire_bindings
  FOR ALL TO authenticated
  USING (account_id = (auth.jwt() ->> 'account_id')::uuid)
  WITH CHECK (account_id = (auth.jwt() ->> 'account_id')::uuid);

DROP POLICY IF EXISTS "outreach_campaigns_tenant_isolation" ON outreach_campaigns;
CREATE POLICY "outreach_campaigns_tenant_isolation" ON outreach_campaigns
  FOR ALL TO authenticated
  USING (account_id = (auth.jwt() ->> 'account_id')::uuid)
  WITH CHECK (account_id = (auth.jwt() ->> 'account_id')::uuid);

DROP POLICY IF EXISTS "outreach_campaign_enrollments_tenant_isolation" ON outreach_campaign_enrollments;
CREATE POLICY "outreach_campaign_enrollments_tenant_isolation" ON outreach_campaign_enrollments
  FOR ALL TO authenticated
  USING (account_id = (auth.jwt() ->> 'account_id')::uuid)
  WITH CHECK (account_id = (auth.jwt() ->> 'account_id')::uuid);

DROP POLICY IF EXISTS "outreach_campaign_steps_tenant_isolation" ON outreach_campaign_steps;
CREATE POLICY "outreach_campaign_steps_tenant_isolation" ON outreach_campaign_steps
  FOR ALL TO authenticated
  USING (account_id = (auth.jwt() ->> 'account_id')::uuid)
  WITH CHECK (account_id = (auth.jwt() ->> 'account_id')::uuid);

DROP POLICY IF EXISTS "ai_memory_tenant_select" ON ai_memory;
CREATE POLICY "ai_memory_tenant_select" ON ai_memory
  FOR SELECT TO authenticated
  USING (account_id = (auth.jwt() ->> 'account_id')::uuid);

DROP POLICY IF EXISTS "ai_observations_tenant_select" ON ai_observations;
CREATE POLICY "ai_observations_tenant_select" ON ai_observations
  FOR SELECT TO authenticated
  USING (account_id = (auth.jwt() ->> 'account_id')::uuid);

-- Portal: contacts see only their own row when contact_id is in JWT
DROP POLICY IF EXISTS "contacts_portal_self_only" ON contacts;
CREATE POLICY "contacts_portal_self_only" ON contacts
  FOR SELECT TO authenticated
  USING (
    id = (auth.jwt() ->> 'contact_id')::uuid
    AND account_id = (auth.jwt() ->> 'account_id')::uuid
  );

DROP POLICY IF EXISTS "records_portal_self_only" ON records;
CREATE POLICY "records_portal_self_only" ON records
  FOR SELECT TO authenticated
  USING (
    contact_id = (auth.jwt() ->> 'contact_id')::uuid
    AND account_id = (auth.jwt() ->> 'account_id')::uuid
  );

DROP POLICY IF EXISTS "documents_portal_visible" ON documents;
CREATE POLICY "documents_portal_visible" ON documents
  FOR SELECT TO authenticated
  USING (
    contact_id = (auth.jwt() ->> 'contact_id')::uuid
    AND account_id = (auth.jwt() ->> 'account_id')::uuid
    AND visible_to_client = true
  );
