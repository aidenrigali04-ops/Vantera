#!/usr/bin/env bash
# Replays packages/db/migrations in order onto $DATABASE_URL (a scratch postgres).
# Supabase migrations reference auth.users / auth.uid() and the authenticated/service_role/anon
# roles; this stubs just enough of that surface first, then applies every migration file in
# order. Fails on the first SQL error (used by both local iteration and the nightly drift-check
# workflow — see .github/workflows/migration-drift.yml).
#
# Every addition to the preamble below must be an auth/roles/extension STUB — never a change to
# an actual migration file under packages/db/migrations/.
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL must be set to a scratch postgres connection string}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MIGRATIONS_DIR="$REPO_ROOT/packages/db/migrations"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
-- Extensions the migrations assume are already enabled on Supabase.
create extension if not exists pgcrypto;
create extension if not exists "uuid-ossp";

-- Minimal stand-in for Supabase's auth schema: just enough surface (auth.users, auth.uid(),
-- auth.jwt(), auth.role()) for our migrations' FKs, RLS policies, and grants to replay.
create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function auth.uid() returns uuid
  language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;

create or replace function auth.role() returns text
  language sql stable as $$
    select nullif(current_setting('request.jwt.claim.role', true), '')
  $$;

create or replace function auth.jwt() returns jsonb
  language sql stable as $$
    select nullif(current_setting('request.jwt.claims', true), '')::jsonb
  $$;

-- Minimal stand-in for Supabase's storage extension: our migrations create a private bucket and
-- RLS policies on storage.objects (e.g. 0007_agents.sql's agent-assets bucket).
create schema if not exists storage;

create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false
);

create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text,
  owner uuid,
  created_at timestamptz not null default now()
);

create or replace function storage.foldername(name text) returns text[]
  language sql immutable as $$
    select (string_to_array(name, '/'))[1 : array_length(string_to_array(name, '/'), 1) - 1]
  $$;

-- Supabase's built-in Postgres roles that migrations grant privileges to / write RLS policies
-- against. `nologin` is fine — nothing in the replay ever authenticates as them.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
end
$$;
SQL

shopt -s nullglob
migrations=("$MIGRATIONS_DIR"/*.sql)
if [ ${#migrations[@]} -eq 0 ]; then
  echo "no migrations found under $MIGRATIONS_DIR" >&2
  exit 1
fi

for f in "${migrations[@]}"; do
  echo "applying $f"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"
done

echo "replayed ${#migrations[@]} migrations onto $DATABASE_URL"
