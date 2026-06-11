# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What Vantera is

Vantera is a sales intelligence system run by SDR agents. The agents prospect, score, and outreach **only high-quality leads**, using data enrichment tailored to the customer's industry and ICP, then funnel closed leads into the customer's CRM. The product loop:

```
Prospect → Enrich (industry/ICP-tailored) → Score → Outreach → Nurture → Close → push to customer's CRM
```

### In scope
SDR agents, auth, onboarding, dashboard, LinkedIn outreach, email outreach, AI caller, Meta Ads + lead nurturing, data enrichment, CRM connection funnel (closed leads pushed to the customer's CRM — Vantera is not itself a CRM), revenue goal, progress & analytics tracking, team seats, Stripe billing.

### Out of scope
Inbox, white-label branding, client portal, and anything unrelated to sales, lead nurturing, outreach, or CRM connection.

### Key initiatives
- **Meta Ads generation** — users generate Meta ads directly on the platform via Claude and Higgsfield, feeding the lead-nurturing channel.
- **UI Designer Reference sheet** — a development-only artifact (never user-facing) used to build the dashboard UI. Workflow: replicate the reference precisely, then customize. No AI slop — every aspect, feature, and component must be pinpointed precisely against the reference.
- **UX Brain** — a backend development layer governing dashboard UI/UX: formatting, workflow, pipeline, and all aspects of the user experience. Its mandate is maximum positive user experience and predicted retention via optimal best practices. UI/UX changes route through it.
- **Key Prompting Notes** - When Building the UI go throuh this looping prompting until Ui is 100% matched from reference. Loop: Task>Do The Task>Verify Result> Repeat until Ui is 100% matched.

## Foundational decisions (locked 2026-06-11)

### Stack
| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js (latest, App Router) + React + TypeScript strict | Turborepo + pnpm workspaces monorepo |
| UI | Tailwind (latest) + shadcn/ui + Lucide + Framer Motion + Recharts | |
| Auth | Supabase Auth via `@supabase/ssr` | accountId always from validated session, never from URL/query/body |
| Database | Supabase Postgres + Drizzle ORM (latest) | Auth and data in one Postgres; RLS multi-tenancy from migration #1 |
| Background jobs | Trigger.dev v4 | Runs the SDR agent pipeline: crons, event-driven tasks, long-running AI calls (no timeout caps) |
| AI | Anthropic via Vercel AI SDK, single client wrapper | Never scatter direct SDK calls |
| Billing | Stripe | |
| Transactional email | Resend | Auth emails, notifications only — never cold outreach |

### Email outreach infrastructure
Vantera provisions sending domains + mailboxes per customer — fully in-platform, users never leave to set anything up. Implementation: **Smartlead API** (SmartSenders provisioning, warmup network, inbox rotation, reply webhooks), white-labeled so users never see Smartlead. All of Vantera's code talks only to a Vantera-owned `email-infra` interface (provision / send / warmup-status / replies) so the provider is swappable later (e.g. to owned raw infra) without touching product code. Building raw deliverability infra in-house was evaluated and rejected for now: warmup is time-gated (2–4 weeks) and requires an inbox network no greenfield build can replicate.

### Prospect data & enrichment
Primary discovery + signal provider: **Explorium AgentSource** (agent-native API/MCP, 100 QPS; 150M+ companies, 800M+ contacts, firmographic/technographic/signal data aggregated across 50+ providers). One query feeds both scoring stages: firmographics/technographics for the rules gate, signals (hiring, funding, tech changes, intent) for the AI rank. On top of it sits a Vantera-orchestrated **enrichment waterfall**, spent only on leads that pass the scoring gate: email verification before any send (protects provisioned mailboxes), phone validation for the AI caller, and optional premium enrichment (e.g. Clay) for verticals that need it. The industry/ICP-tailoring logic lives in Vantera's enrichment orchestrator, not in any one provider.

### Lead scoring (the "only high-quality leads" gate)
Hybrid, two stages:
1. **Rules gate** — deterministic ICP-fit checks (industry, company size, role, geo, tech stack). Cheap, explainable, filters the bulk.
2. **AI rank** — Claude scores survivors on nuanced fit (pain signals, timing, persona) and writes a rationale shown on the dashboard.

Only leads passing both stages get premium enrichment and enter outreach.