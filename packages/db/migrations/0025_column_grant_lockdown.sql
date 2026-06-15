-- 0025: column-level lockdown for server-managed secret/state columns.
-- 0021/0022 used column-scoped REVOKEs, but Postgres ignores a column REVOKE when a
-- table-level grant exists — and Supabase grants ALL on these tables to `authenticated`
-- by default. So those REVOKEs were no-ops. Enforce at the column-GRANT level instead.

-- mailboxes: provisioning, warmup, and pause are all service-role (Trigger tasks); the web
-- client only READS non-secret columns. Remove client writes entirely and hide smtp_* so the
-- encrypted SMTP secret (and host/port/username) is never exposed over PostgREST.
REVOKE INSERT, UPDATE, DELETE ON public.mailboxes FROM authenticated, anon;
REVOKE SELECT ON public.mailboxes FROM authenticated, anon;
GRANT SELECT (
  id, account_id, email_address, domain, provider_ref, status,
  warmup_started_at, health, daily_send_limit, created_at, updated_at
) ON public.mailboxes TO authenticated;

-- leads: clients keep managing their own leads, but linkedin_connected_at is written ONLY by
-- the inbound relationship_accepted handler (service role). Grant client UPDATE on every column
-- except it. (New leads columns must be added here to stay client-updatable — intentional.)
REVOKE UPDATE ON public.leads FROM authenticated;
GRANT UPDATE (
  id, account_id, icp_id, source, external_ref, company_name, company_domain, company_size,
  industry, location, tech_stack, first_name, last_name, title, email, email_status, phone,
  phone_status, linkedin_url, rules_gate_passed, rules_gate_reasons, ai_score, ai_rationale,
  scored_at, status, created_at, updated_at, ai_insights, linkedin_invited_at, deal_value_cents,
  closed_at
) ON public.leads TO authenticated;
