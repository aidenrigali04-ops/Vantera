# SDR agent framework (locked 2026-06-11)

How every user-facing SDR agent is built and where its code lives. Scout (prospect) and Copy shipped first; Caller, Ads/Nurture, and any future agent follow the SAME skeleton — no agent gets a bespoke architecture. Rule 08 defines what the two shipped agents do; this rule defines the structure all of them share.

## The skeleton — one agent = six pieces, fixed locations

| Piece | Location | Constraint |
|---|---|---|
| 1. DB identity | `agents.kind` check constraint, extended by a new migration in `packages/db/migrations/` | One row per kind per account (v1 unique constraint). Per-kind settings go in `agents.config` jsonb, documented in the migration comment — never new one-off columns per agent. |
| 2. Setup wizard | `apps/web/src/app/(app)/agents/new/<kind>/page.tsx` (server) + `apps/web/src/app/(app)/agents/<kind>-wizard.tsx` (client) | Composes `components/wizard/wizard-shell.tsx` — never a hand-rolled stepper. Ends in a Deploy action that flips status to `live`. |
| 3. Server actions + validation | `apps/web/src/app/(app)/agents/actions.ts` + `validation.ts` | Validation = pure functions with colocated tests. Account always resolved from the session via RLS-scoped select (rule 02) — actions never accept an accountId. |
| 4. Brain | `packages/agent-brains/src/<domain>/` (e.g. `prospect/`, `copy/`, future `caller/`) | Pure prompt/logic modules: no Trigger.dev, no drizzle, no DB. All LLM calls via `getModel()` from `@vantera/ai`, accepted as an injectable `model` param so tests use mocks. Structured output through zod schemas exported next to the brain. |
| 5. Pipeline | core in `packages/jobs/src/pipeline/<name>.ts` (pure, deps injected via interfaces in `types.ts`; drizzle impl only in `pg-store.ts`) + thin wrapper in `packages/jobs/src/trigger/<name>.ts` | Task id = file name. The wrapper only wires real deps and logs — logic lives in the core so tests never need the Trigger runtime. |
| 6. Help article | `packages/help-content/content/agents-<kind>.md` | Ships in the same PR (knowledge-sync, rule 09). |

External data/services sit behind a swappable package (`packages/<domain>-data` or `<domain>-infra`): `types.ts` interface + `in-memory.ts` fake + one vendor adapter file. Vendor names never leave the package (white-label, rules 03–05).

## Cross-cutting constraints (enforced by guardrail tests)

- **Single AI entry**: only `packages/ai` imports `@ai-sdk/*` — `packages/ai/src/single-entry.test.ts` scans every workspace and fails on violations.
- **Brain purity**: `packages/agent-brains` imports no Trigger.dev/drizzle/DB — `packages/agent-brains/src/purity.test.ts`.
- **Thin trigger tasks**: every file in `packages/jobs/src/trigger/` (except `healthcheck.ts`) imports its core from `../pipeline/` — `packages/jobs/src/structure.test.ts`.
- **RLS in the same migration** for any new table, **suppression check before anything that could reach a prospect**, retention note for prospect-data tables — rules 02/11, already guarded in `packages/db/src/schema.test.ts` and `packages/jobs/src/pipeline/copy-draft.test.ts`.
- **No vendor names in help content** — `packages/help-content/src/articles.test.ts`.

## File hygiene

- Tests are colocated `*.test.ts` next to the unit — no separate `__tests__/` trees.
- One concern per file; when a brain or core file outgrows ~200 lines, split by stage (the way `prospect/` splits gate/rank/scan), don't grow a god-module.
- Shared UI primitives go in `apps/web/src/components/ui/` (shadcn-style), shared flow chrome in `apps/web/src/components/wizard/` — agent folders hold only agent-specific composition.
- Specs/plans for each agent live in `docs/superpowers/specs|plans/` (rule 12); the agents' runtime behavior contract stays in rule 08.

## Checklist: adding a new agent kind

1. Migration: extend `agents.kind` check; document the `config` shape in a comment; rls-auditor pass.
2. Brain modules + zod schemas in `packages/agent-brains/src/<domain>/` (tests first, mock model).
3. Provider package if a new external service is involved (interface + fake + adapter).
4. Pipeline core + store methods + thin trigger task (suppression test if it can reach a prospect).
5. Wizard pages + actions + validation tests; card on `/agents`.
6. Help article; whitelabel-auditor pass; roadmap + rule 08 updated.
