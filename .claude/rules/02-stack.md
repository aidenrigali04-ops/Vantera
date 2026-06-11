# Stack (locked 2026-06-11)

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
