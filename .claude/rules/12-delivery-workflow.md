# Delivery workflow (locked 2026-06-11)

How Vantera gets built: a solo owner driving Claude Code sessions, phase by phase. `docs/roadmap.md` is the **single source of truth for sequencing** — work happens in roadmap order unless the owner explicitly reorders.

## The phase cycle

Every phase runs the same loop:

```
/next-phase → brainstorm → spec (docs/superpowers/specs/) → plan (docs/superpowers/plans/)
  → subagent-driven TDD build → verify → /ship-phase
```

- **Branching**: each phase gets `phase-N-<slug>`; merges to `main` only with the full gate green (`pnpm lint && pnpm type-check && pnpm test && pnpm build`).
- **TDD is the default** for all product code (superpowers:test-driven-development). Locked decisions get guardrail tests, not conventions (see the RLS test in `packages/db/src/schema.test.ts`).
- **Specs and plans are committed** — they are the project's memory across sessions.

## Definition of done (every phase)

1. Roadmap checkbox flipped in `docs/roadmap.md`.
2. Full CI gate green locally and in CI.
3. From Phase 2 on: matching help-content article(s) shipped per the knowledge-sync rule (rule 09) and copilot tools registered for new user-facing behavior.
4. Send-path features: suppression test shipped (rule 11). New tables: RLS in the same migration (rule 02) with a guardrail test.
5. No vendor names on any user-facing surface (white-label, rules 03/04/05).

## Session commands

| Command | Role |
|---|---|
| `/next-phase` | Session starter — picks the next roadmap phase, drives brainstorm → spec → plan |
| `/ship-phase` | Session closer — verification, knowledge-sync check, roadmap flip, merge/PR |
| `/building-vantera-features` | Feature definition-of-done checklist (use during any feature build) |
| `/vantera-db-migrations` | Migration checklist (use whenever schema changes) |

## Review gates (lightweight, agent-powered)

- `rls-auditor` subagent reviews every schema/migration diff before commit.
- `whitelabel-auditor` subagent scans user-facing surfaces before ship.
- The owner is the final gate: specs and plans are approved by a human before build starts.
