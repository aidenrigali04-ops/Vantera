# Deployment & environments (locked 2026-06-11)

**Vercel** hosts `apps/web` (locked — natural Next.js fit, preview deploys per PR). Trigger.dev cloud runs `packages/jobs`. Supabase hosts auth + Postgres.

## Environment ladder

| Env | Web | Database | Jobs | Purpose |
|---|---|---|---|---|
| Local | `pnpm dev` | Supabase dev project | `trigger dev` | Day-to-day development |
| Preview | Vercel preview (per PR) | Supabase dev project | Trigger.dev dev env | Review user-visible changes before merge |
| Production | Vercel production (main) | Supabase prod project | Trigger.dev prod env | Real users, real sends |

## Rules

- **Migrations** are applied to prod via CI/CLI (`drizzle`/`supabase` tooling) — never hand-edited in the dashboard, never out of order. Every migration lives in `packages/db/migrations/` and is committed before it is applied anywhere.
- **Env vars** live in the Vercel / Trigger.dev / Supabase dashboards per environment. `.env.example` is the complete manifest of what exists; git never contains a real value.
- **Production deploys** happen only from `main` with CI green. Trigger.dev prod deploys (`trigger deploy`) ride the same gate.
- Vendor webhooks (Smartlead, Unipile, Stripe) point at the production domain only; dev webhook testing uses each provider's dev/sandbox targets or tunneled local URLs — never the prod handlers.