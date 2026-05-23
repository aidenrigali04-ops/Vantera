-- Vantera RLS Policies
-- Generated for Phase 0 completion
-- Service role bypasses all RLS (Supabase default behavior)
-- Application layer enforces accountId FIRST — RLS is second guard
--
-- Notes:
--   * `accounts` already has a permissive anon/authenticated SELECT policy
--     (`accounts_tenant_resolution_select`) added by an earlier migration to
--     allow middleware to resolve tenants by subdomain. That policy lives
--     alongside the FOR ALL account-isolation policy below — PostgreSQL
--     ORs permissive policies together so middleware lookups continue to
--     work for the anon role while authenticated users are scoped to their
--     own row.
--   * `activities` and `automation_runs` are append-only audit logs: RLS
--     permits SELECT + INSERT only. Updates and deletes go through the
--     service role (or directly against the DB via maintenance scripts).
--   * `vertical_templates` is shared seed data — readable by every
--     authenticated user; writes require the service role.

-- Idempotency: each CREATE POLICY is preceded by DROP POLICY IF EXISTS so
-- this migration is safe to re-run. ALTER TABLE … ENABLE ROW LEVEL
-- SECURITY is naturally idempotent in Postgres.

-- =====================================================================
-- accounts (special — match on id, not account_id)
-- =====================================================================

ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "accounts_account_isolation" ON accounts;
CREATE POLICY "accounts_account_isolation" ON accounts
  FOR ALL
  USING (id = (auth.jwt() ->> 'account_id')::uuid)
  WITH CHECK (id = (auth.jwt() ->> 'account_id')::uuid);

-- =====================================================================
-- users
-- =====================================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_account_isolation" ON users;
CREATE POLICY "users_account_isolation" ON users
  FOR ALL
  USING (account_id = (auth.jwt() ->> 'account_id')::uuid)
  WITH CHECK (account_id = (auth.jwt() ->> 'account_id')::uuid);

-- =====================================================================
-- contacts
-- =====================================================================

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contacts_account_isolation" ON contacts;
CREATE POLICY "contacts_account_isolation" ON contacts
  FOR ALL
  USING (account_id = (auth.jwt() ->> 'account_id')::uuid)
  WITH CHECK (account_id = (auth.jwt() ->> 'account_id')::uuid);

-- =====================================================================
-- stage_definitions
-- =====================================================================

ALTER TABLE stage_definitions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stage_definitions_account_isolation" ON stage_definitions;
CREATE POLICY "stage_definitions_account_isolation" ON stage_definitions
  FOR ALL
  USING (account_id = (auth.jwt() ->> 'account_id')::uuid)
  WITH CHECK (account_id = (auth.jwt() ->> 'account_id')::uuid);

-- =====================================================================
-- records
-- =====================================================================

ALTER TABLE records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "records_account_isolation" ON records;
CREATE POLICY "records_account_isolation" ON records
  FOR ALL
  USING (account_id = (auth.jwt() ->> 'account_id')::uuid)
  WITH CHECK (account_id = (auth.jwt() ->> 'account_id')::uuid);

-- =====================================================================
-- activities (append-only — no UPDATE or DELETE via RLS)
-- =====================================================================

ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "activities_account_isolation" ON activities;
CREATE POLICY "activities_account_isolation" ON activities
  FOR SELECT
  USING (account_id = (auth.jwt() ->> 'account_id')::uuid);

DROP POLICY IF EXISTS "activities_insert" ON activities;
CREATE POLICY "activities_insert" ON activities
  FOR INSERT
  WITH CHECK (account_id = (auth.jwt() ->> 'account_id')::uuid);

-- No UPDATE or DELETE policy — immutable log

-- =====================================================================
-- automations
-- =====================================================================

ALTER TABLE automations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "automations_account_isolation" ON automations;
CREATE POLICY "automations_account_isolation" ON automations
  FOR ALL
  USING (account_id = (auth.jwt() ->> 'account_id')::uuid)
  WITH CHECK (account_id = (auth.jwt() ->> 'account_id')::uuid);

-- =====================================================================
-- automation_runs (append-only audit log — no UPDATE or DELETE via RLS)
-- =====================================================================

ALTER TABLE automation_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "automation_runs_account_isolation" ON automation_runs;
CREATE POLICY "automation_runs_account_isolation" ON automation_runs
  FOR SELECT
  USING (account_id = (auth.jwt() ->> 'account_id')::uuid);

DROP POLICY IF EXISTS "automation_runs_insert" ON automation_runs;
CREATE POLICY "automation_runs_insert" ON automation_runs
  FOR INSERT
  WITH CHECK (account_id = (auth.jwt() ->> 'account_id')::uuid);

-- No UPDATE or DELETE policy — immutable log

-- =====================================================================
-- messages
-- =====================================================================

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "messages_account_isolation" ON messages;
CREATE POLICY "messages_account_isolation" ON messages
  FOR ALL
  USING (account_id = (auth.jwt() ->> 'account_id')::uuid)
  WITH CHECK (account_id = (auth.jwt() ->> 'account_id')::uuid);

-- =====================================================================
-- invoices
-- =====================================================================

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invoices_account_isolation" ON invoices;
CREATE POLICY "invoices_account_isolation" ON invoices
  FOR ALL
  USING (account_id = (auth.jwt() ->> 'account_id')::uuid)
  WITH CHECK (account_id = (auth.jwt() ->> 'account_id')::uuid);

-- =====================================================================
-- documents
-- =====================================================================

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "documents_account_isolation" ON documents;
CREATE POLICY "documents_account_isolation" ON documents
  FOR ALL
  USING (account_id = (auth.jwt() ->> 'account_id')::uuid)
  WITH CHECK (account_id = (auth.jwt() ->> 'account_id')::uuid);

-- =====================================================================
-- intelligence_signals
-- =====================================================================

ALTER TABLE intelligence_signals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "intelligence_signals_account_isolation" ON intelligence_signals;
CREATE POLICY "intelligence_signals_account_isolation" ON intelligence_signals
  FOR ALL
  USING (account_id = (auth.jwt() ->> 'account_id')::uuid)
  WITH CHECK (account_id = (auth.jwt() ->> 'account_id')::uuid);

-- =====================================================================
-- feature_flags
-- =====================================================================

ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "feature_flags_account_isolation" ON feature_flags;
CREATE POLICY "feature_flags_account_isolation" ON feature_flags
  FOR ALL
  USING (account_id = (auth.jwt() ->> 'account_id')::uuid)
  WITH CHECK (account_id = (auth.jwt() ->> 'account_id')::uuid);

-- =====================================================================
-- integration_credentials
-- =====================================================================

ALTER TABLE integration_credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "integration_credentials_account_isolation" ON integration_credentials;
CREATE POLICY "integration_credentials_account_isolation" ON integration_credentials
  FOR ALL
  USING (account_id = (auth.jwt() ->> 'account_id')::uuid)
  WITH CHECK (account_id = (auth.jwt() ->> 'account_id')::uuid);

-- =====================================================================
-- vertical_templates (shared seed — read by all authenticated users,
-- writes require the service role)
-- =====================================================================

ALTER TABLE vertical_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vertical_templates_read_all" ON vertical_templates;
CREATE POLICY "vertical_templates_read_all" ON vertical_templates
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- No INSERT/UPDATE/DELETE for regular users — service role only
