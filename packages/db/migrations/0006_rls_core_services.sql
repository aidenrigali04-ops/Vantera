-- RLS for core service tables (tenant isolation via account_id)

ALTER TABLE "leads" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lead_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "aspire_saved_searches" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "aspire_search_runs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "linkedin_accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "linkedin_campaigns" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "linkedin_sequences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "linkedin_sequence_steps" ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS; anon/authenticated policies mirror existing tenant pattern.
CREATE POLICY "leads_tenant_isolation" ON "leads"
  FOR ALL USING (account_id = (current_setting('app.current_account_id', true))::uuid);

CREATE POLICY "lead_profiles_tenant_isolation" ON "lead_profiles"
  FOR ALL USING (account_id = (current_setting('app.current_account_id', true))::uuid);

CREATE POLICY "aspire_saved_searches_tenant_isolation" ON "aspire_saved_searches"
  FOR ALL USING (account_id = (current_setting('app.current_account_id', true))::uuid);

CREATE POLICY "aspire_search_runs_tenant_isolation" ON "aspire_search_runs"
  FOR ALL USING (account_id = (current_setting('app.current_account_id', true))::uuid);

CREATE POLICY "linkedin_accounts_tenant_isolation" ON "linkedin_accounts"
  FOR ALL USING (account_id = (current_setting('app.current_account_id', true))::uuid);

CREATE POLICY "linkedin_campaigns_tenant_isolation" ON "linkedin_campaigns"
  FOR ALL USING (account_id = (current_setting('app.current_account_id', true))::uuid);

CREATE POLICY "linkedin_sequences_tenant_isolation" ON "linkedin_sequences"
  FOR ALL USING (account_id = (current_setting('app.current_account_id', true))::uuid);

CREATE POLICY "linkedin_sequence_steps_tenant_isolation" ON "linkedin_sequence_steps"
  FOR ALL USING (account_id = (current_setting('app.current_account_id', true))::uuid);
