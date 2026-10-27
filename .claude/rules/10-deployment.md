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
- **One deploy path per system.** Vercel deploys `apps/web` from its git integration; Trigger.dev prod deploys run only from `.github/workflows/deploy-trigger.yml`. No Vercel integration may add a **blocking deployment check** to production — a failing integration check silently holds every production deployment off the domain (2026-10: a Trigger.dev Vercel integration linked to the wrong project blocked promotion for a week). `postdeploy-verify.yml` names any such check when `VERCEL_TOKEN` is set.
- Vendor webhooks (Smartlead, Unipile, Stripe) point at the production domain only; dev webhook testing uses each provider's dev/sandbox targets or tunneled local URLs — never the prod handlers.