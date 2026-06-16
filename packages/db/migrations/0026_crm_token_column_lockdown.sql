-- 0026: hide encrypted CRM OAuth tokens from client roles (defense-in-depth; mirrors 0025
-- for mailboxes.smtp_*). 0025's lesson: a column-scoped REVOKE is a no-op while a table-level
-- grant exists, so REVOKE SELECT entirely and re-GRANT only the non-secret columns.
--
-- access_token_enc / refresh_token_enc are AES-256-GCM ciphertext written ONLY by the
-- service-role OAuth callback and never selected client-side (every authenticated SELECT uses
-- an explicit non-secret column list). Even encrypted, they must not be exposable over
-- PostgREST. Writes are unchanged: RLS keeps them admin-scoped, and the service role (which
-- bypasses grants) still persists the tokens.

REVOKE SELECT ON public.crm_connections FROM authenticated, anon;
GRANT SELECT (
  id, account_id, provider, kind, status, token_expires_at,
  external_account_ref, config, last_error, last_sync_at, created_at, updated_at
) ON public.crm_connections TO authenticated;
