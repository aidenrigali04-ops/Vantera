-- Simulation Lab isolation. No product tables. App sessions cannot see this schema.
-- Tables added later belong here, never in public, and follow the same RLS rule.
create schema if not exists sim;

revoke all on schema sim from public;
revoke all on schema sim from anon;
revoke all on schema sim from authenticated;

comment on schema sim is
  'Offline simulation only. Never enabled in a production build. No customer data.';
