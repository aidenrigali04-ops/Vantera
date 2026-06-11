# Vantera

Sales intelligence run by SDR agents: prospect, score, and outreach **only high-quality leads**, then push closed leads into the customer's CRM.

```
Prospect → Enrich (industry/ICP-tailored) → Score → Outreach → Nurture → Close → push to customer's CRM
```

## Repo map

```
apps/web/                  Next.js 16 dashboard app (@vantera/web)
packages/db/               Drizzle schema + SQL migrations (RLS from migration #1)
packages/ai/               The single Anthropic client wrapper — all model access goes through here
packages/email-infra/      Provider-agnostic email outreach interface + in-memory fake
packages/linkedin-infra/   Provider-agnostic LinkedIn outreach interface + in-memory fake
packages/jobs/             Trigger.dev v4 tasks (SDR agent pipeline, schedulers)
.claude/rules/             Locked product + engineering decisions (the constitution)
.claude/skills|agents/     Project skills, subagents, and hooks for Claude Code sessions
docs/roadmap.md            Phase-by-phase development plan (single source of truth for sequencing)
docs/production-readiness.md  Enterprise production plan (envs, security, observability, compliance)
docs/superpowers/          Per-phase design specs and implementation plans
```

## Running it

```bash
pnpm install        # workspace install
pnpm dev            # all dev servers via turbo
pnpm test           # vitest across packages
pnpm lint && pnpm type-check && pnpm build   # the CI gate, locally
```

Copy `.env.example` to `.env.local` and fill values. Secrets never live in git.

## How decisions work

Every foundational choice is locked in `.claude/rules/` (stack, infra providers, scoring gate, campaign pipeline, compliance, deployment, delivery workflow). `CLAUDE.md` is the index. Change a rule deliberately and in its own commit — code follows rules, not the reverse.

## Prompt Playbook (driving Claude Code sessions)

| You type | What happens |
|---|---|
| `/next-phase` | Reads `docs/roadmap.md`, picks the next unchecked phase, drives brainstorm → spec → implementation plan for it |
| `/ship-phase` | Full verification (lint, type-check, test, build), knowledge-sync check, roadmap checkbox flip, then merge/PR options |
| `/building-vantera-features` | The feature definition-of-done checklist (TDD, white-label, suppression, help article) |
| `/vantera-db-migrations` | The migration checklist (RLS, tenant scoping, policy helpers, guardrail test) |

Session rhythm for a phase: start on a fresh branch (`phase-N-<slug>`) → `/next-phase` → approve the spec and plan → let subagent-driven TDD build it → `/ship-phase`.

When asking for ad-hoc work, the highest-leverage prompt structure is: **goal** (what user-visible outcome), **constraints** (which rules apply), **done means** (how to verify). Example: "Add a pause button to campaign cards. Constraints: rule 08 send modes, copilot tool registration per rule 09. Done means: test proves paused campaigns never reach the scheduler."
