# Phase 2 — Auth, onboarding & app shell (design)

**Date:** 2026-06-11 · **Status:** approved by owner (design presented in session, recommended options confirmed)

## Goal

A user can sign up, create an account, complete onboarding, and land on a real dashboard shell. (Roadmap Phase 2; rules 02, 07, 09, 11.)

## Decisions confirmed with owner

| Decision | Choice |
|---|---|
| Sign-in methods | Email/password only (OAuth later, no rework needed) |
| Onboarding gating | Hard gate — dashboard unreachable until onboarding completes |
| Account deletion | Pending request + 7-day grace window with cancel; Trigger.dev job processes it (vendor-cleanup stubs) |
| Shell scope | Full sidebar nav (Dashboard, Leads, Campaigns, Analytics, Settings); future sections get designed coming-soon states |

## What already exists (Phase 1)

- Schema (migrations 0000–0006, applied to dev project): `accounts` (with `onboarding_industry`, `onboarding_icp`, `revenue_goal_cents`, `onboarding_completed_at`), `account_members`, `user_profiles`, `account_invites` + `accept_invite()`, `account_deletion_requests`, `create_account()` RPC. Column-level grants limit client updates on `accounts` to name + onboarding fields; admins only via RLS.
- `apps/web`: Next.js 16 (App Router, Turbopack), `@supabase/ssr` browser/server clients, `proxy.ts` session refresh, Tailwind + shadcn-style primitives (button, card, badge).
- Team invites: **schema only** in Phase 2; invite UI defers to Phase 7 (per roadmap).

## Architecture

Server Actions + route-group guards (chosen over API route handlers and client-side mutations): all mutations are Next.js Server Actions using the `@supabase/ssr` server client; `accountId` always derived from the validated session server-side (rule 02). Each route group enforces its own gate in a server layout.

### Route structure (`apps/web/src/app`)

| Route | Gate | Content |
|---|---|---|
| `/` | public | Landing page (existing) + Sign in / Get started links |
| `(auth)/signup`, `login`, `forgot-password`, `reset-password` | redirect away if signed in (except reset-password, which runs inside a recovery session) | Centered-card auth pages |
| `auth/confirm` (route handler) | — | Verifies Supabase email-confirm + recovery tokens (`verifyOtp`), redirects into the gate chain |
| `onboarding` | signed in; account created here if missing; redirect to dashboard if `onboarding_completed_at` set | 3-step wizard |
| `(app)/dashboard`, `leads`, `campaigns`, `analytics`, `settings` | signed in → has account → onboarding complete; else redirect backward down the chain | Dashboard shell |

The gate chain is one pure, unit-tested function (`resolveGate(user, account) → destination`) consumed by the layouts, so the redirect logic has a single source of truth.

### Auth flows

- Signup captures email, password, **company name** (feeds `create_account` after first sign-in reaches `/onboarding`).
- Supabase sends the confirmation email (default SMTP for now — Resend wiring is a production-readiness item, not Phase 2).
- Password reset: recovery email → `auth/confirm` → `reset-password` (update password in recovery session).
- Logout: server action in the shell user menu.

### Onboarding wizard (retention brief: commitment/consistency)

Three steps, one field per step, progress bar starting endowed (account-created step pre-checked):

1. **Industry** — free-text type-ahead input
2. **ICP** — free text
3. **Revenue goal** — currency input, stored as `revenue_goal_cents`

Single save at the end (server action): updates the `accounts` row and sets `onboarding_completed_at`. These answers seed the campaign-wizard default targeting (rule 08).

**Spacing & visual polish (2026-06-12):** the wizard cards are focused single-task surfaces and follow the locked spacing scale in rule 07 — `[--card-spacing:--spacing(8)]`, `space-y-9` between fields, `space-y-3.5` within a field, `CardContent pb-8` so the footer divider never butts the last hint, `h-11 px-4 text-base` inputs. Each card carries an `AnimatedPanelBorder` overlaid as a sibling (matching the auth panels), beamed in the particle palette (`PARTICLE_BEAM`, `#FFCC1A → #FF730D → #EB291C`). Rule 07 is the source of truth; keep these in sync there, not per-spec.

### Dashboard home (retention brief: endowed progress)

- **Goal card** — "Targeting {icp} in {industry} — goal ${goal}/mo", real data from the `accounts` row, never placeholders.
- **Activation checklist** — starts 2/4 complete (account created ✓, onboarding ✓); next item "Launch your first campaign" marked coming-soon until Phase 4.
- **SDR agent status panel** — truthful "Standing by — goes Live when your first campaign launches".
- Leads / Campaigns / Analytics pages: designed coming-soon states that name what will appear and which phase unlocks it (no dead ends).

### Settings

- **Profile** — display name → `user_profiles` (user-scoped).
- **Workspace** — account name + onboarding answers, editable (RLS enforces admin-only).
- **Team** — members list read-only; invites labeled as coming later (Phase 7).
- **Danger zone** — deletion flow: type-account-name confirm → insert into `account_deletion_requests` (pending) → banner with scheduled date + Cancel (sets `canceled`). A `process-account-deletion` Trigger.dev task (in `packages/jobs`) skips requests younger than 7 days, runs vendor-cleanup stubs, then hard-deletes the account via service role (FK cascades wipe tenant data). Satisfies rule 11 GDPR groundwork.

### `packages/help-content` scaffold (rule 09)

- `content/*.md` with frontmatter `title`, `surface`, `routes`.
- Typed loader/index module + tests (parse frontmatter, list by route).
- First articles shipped in this phase: getting started & onboarding, dashboard overview, account settings & deletion, password & sign-in help. White-label: no vendor names anywhere.

## Error handling

- Server actions return typed `{ error }` results rendered inline on forms (no thrown errors to the client).
- Auth errors (wrong password, unconfirmed email, expired token) map to friendly messages; unknown errors get a generic message.
- Gate layouts never render protected content on failure — always redirect.

## Testing (TDD, rule 12)

- Unit: gate-chain resolver; onboarding save action validation (industry/ICP required, goal > 0); deletion request lifecycle (create, cancel, 7-day window respected by the job); help-content loader.
- Existing RLS guardrail tests in `packages/db` already cover the schema (no new migrations expected this phase).
- Full gate before ship: `pnpm lint && pnpm type-check && pnpm test && pnpm build`.

## Out of scope

OAuth providers, invite UI (Phase 7), real vendor deletion calls (no vendors connected yet), Resend SMTP wiring (production-readiness), any outreach/lead surface (Phases 3–5).
