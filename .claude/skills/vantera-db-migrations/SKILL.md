---
name: vantera-db-migrations
description: Use whenever creating or modifying database tables, schema files, or SQL migrations in packages/db — enforces the RLS-from-day-one tenancy model with guardrail tests before any schema change is committed.
---

# Vantera DB Migrations

## Overview

Every table is tenant-scoped and RLS-protected **in the same migration that creates it** (locked, rule 02). The reference implementation is `packages/db/migrations/0000_init.sql` + the guardrail test in `packages/db/src/schema.test.ts`. This checklist makes the pattern unskippable.

## Checklist for every new table

- [ ] Tenant column: `account_id uuid not null references public.accounts(id) on delete cascade` (exceptions: global/system tables — justify in the migration comment)
- [ ] `alter table public.<name> enable row level security` in the **same** migration
- [ ] Policies go through the existing helpers — `public.is_account_member(account_id)` for select, `public.is_account_admin(account_id)` for writes; never inline membership subqueries
- [ ] Any new `security definer` function sets `set search_path = ''` and reads the user via `(select auth.uid())`
- [ ] Drizzle schema in `src/schema.ts` mirrors the SQL (FKs to `auth.users` live in SQL only — auth schema isn't modeled in Drizzle)
- [ ] Guardrail test extended: add the new table to the RLS assertion list in `src/schema.test.ts` (same `it.each` pattern)
- [ ] Retention window stated for prospect-data tables (rule 11)
- [ ] Migration files are append-only: new file `NNNN_<slug>.sql`, never edit an applied migration

## Before committing

Dispatch the `rls-auditor` subagent on the diff (`git diff -- packages/db`) and resolve every finding.

## Common mistakes

| Mistake | Fix |
|---|---|
| RLS "in a follow-up migration" | Same migration or it doesn't merge — the guardrail test should fail |
| Policy with inline `exists (select … account_members …)` | Use `is_account_member` / `is_account_admin` — avoids recursive-RLS bugs |
| `security definer` without `set search_path = ''` | Search-path hijack risk; always pin it |
| Editing `0000_init.sql` to add a table | New migration file; applied migrations are immutable |
| Drizzle-only table (no SQL migration) | The SQL migration is the source of truth; both must exist |