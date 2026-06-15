-- leads.linkedin_connected_at is set ONLY by the inbound relationship_accepted handler
-- (service role). Block client writes as defense-in-depth (RLS already scopes leads per account).
REVOKE UPDATE (linkedin_connected_at) ON leads FROM authenticated, anon;
