-- Allow middleware (anon key) to resolve tenants by subdomain or custom domain.
-- Only non-sensitive branding metadata lives on accounts; row-level tenant
-- isolation for app data is enforced on child tables.

CREATE POLICY "accounts_tenant_resolution_select"
ON public.accounts
FOR SELECT
TO anon, authenticated
USING (true);
