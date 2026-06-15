-- 0021: Maildoso per-mailbox SMTP credentials. smtp_secret is an AES-256-GCM blob (iv:tag:ct).
-- Server-managed: provisioning writes these via the service role in a Trigger task; clients
-- never read or write them (RLS already scopes mailboxes per account; no column grant to authenticated).
ALTER TABLE mailboxes
  ADD COLUMN smtp_secret text,
  ADD COLUMN smtp_host text,
  ADD COLUMN smtp_port integer,
  ADD COLUMN smtp_username text;

-- Explicitly deny client access to the secret columns (defense-in-depth alongside RLS).
REVOKE ALL (smtp_secret, smtp_host, smtp_port, smtp_username) ON mailboxes FROM authenticated, anon;
