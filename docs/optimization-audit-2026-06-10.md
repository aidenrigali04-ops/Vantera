# Vantera Optimization Audit — 2026-06-10

> **Purpose / how to use this log.** This is a context-loadable findings log. Each
> finding has a stable ID (e.g. `SEC-001`, `UX-002`). To act on one, paste this
> file back to Claude and say: **"implement SEC-001"** or **"fix UX-001 and UX-008"**.
> Each entry carries enough location + evidence for implementation to start cold.
> Update the **Status** column as items ship (`open` → `in progress` → `done`).

**Scope audited:** auth (login/signup/OAuth, session, middleware), onboarding wizard,
dashboard, agents hub, leads/pipeline, navigation/IA, API routes + webhooks.
**Lenses:** security (as pentester), UX (as a brand-new user hunting the "aha"),
A/B experimentation (as a growth/CRO operator).
**App:** `apps/web` (Next.js 14 App Router, Drizzle/Supabase, JWT session cookie).

---

## Context snapshot (so a fresh session understands the system)

- **Product:** white-label AI outbound SDR platform. Core loop = *agent finds ICP leads →
  drafts/sends multi-channel outreach → replies/meetings land → pipeline → revenue*.
- **Aha moment (intended):** first batch of real ICP-matched prospects appears / first
  reply lands. Everything before that is setup cost.
- **Auth:** custom JWT (`HS256`, `SUPABASE_JWT_SECRET`) in an httpOnly cookie
  (`lib/auth/jwt.ts`, `lib/auth/session.ts`); 7-day max age. Middleware
  (`middleware.ts`) is authoritative on `/admin/*`, resolves tenant by host slug or
  session fallback, enforces RBAC (`lib/auth/rbac.ts`) and onboarding redirect.
- **Onboarding:** 6-step wizard (`OnboardingWizard.tsx`): business details → AI overview →
  lead preview → **subscription** → team → revenue goal.
- **Dashboard:** `components/dashboard/vantera-os/*` (rebuilt to the Figma "Vantera OS"
  dark theme this week). **Agents hub:** `components/agents/vantera-os/AgentsHubView.tsx`.
- **Nav (current):** Core = Dashboard, Agents, Outreach, Integrations; Workspace =
  Pipeline, Inbox, Settings, Help (`lib/navigation/admin-nav.ts`).

---

## Scoreboard

| Area | Open findings | Highest severity |
|---|---|---|
| Security | 6 | **High** (SEC-001) |
| UX / Onboarding / Aha | 9 | **High** (UX-001, UX-002) |
| A/B experiments | 6 | n/a (opportunities) |

Priority order to tackle first: **SEC-001 → UX-001 → SEC-002 → UX-002 → UX-003**.

---

## SECURITY

### SEC-001 — Reply webhook has no authentication (reply injection) · **HIGH** · open
- **Where:** `app/api/webhooks/sdr/reply/route.ts`
- **Evidence:** `POST` parses JSON and calls `handleSdrReply(...)` with **no signature,
  shared-secret, or token check**. It is also excluded from rate limiting
  (`shouldBypassRateLimit` skips `/api/webhooks/`), and it `catch`-swallows every error
  returning `{ success: true }`, so abuse is silent.
- **Risk:** anyone who can reach the URL can forge replies for an arbitrary `stepId` —
  marking sequence steps as "replied," polluting reply-rate metrics, halting follow-ups,
  and triggering downstream reply handling. Unauthenticated + unthrottled + silent.
- **Fix:** require a shared-secret header (HMAC over the raw body, like the Unipile/Stripe
  handlers) or a signed token; reject on mismatch with `401`; stop returning `success`
  on internal failure. Keep webhook rate-limit bypass only after auth is added.

### SEC-002 — Unipile webhook fails open + non-constant-time compare · **MEDIUM** · open
- **Where:** `app/api/webhooks/unipile/route.ts` (`verifySignature`)
- **Evidence:** `if (!signature || !secret) return !secret` — when
  `UNIPILE_WEBHOOK_SECRET` is unset, **every** request is accepted. Comparison uses
  `===` (timing-leaky) rather than `crypto.timingSafeEqual`.
- **Fix:** fail **closed** when the secret is missing in production; use
  `crypto.timingSafeEqual` on equal-length buffers.

### SEC-003 — Rate limiter fails open when Upstash unconfigured · **MEDIUM** · open
- **Where:** `lib/security/rate-limit.ts` (`applyRateLimit` returns `{ success: true }`
  when `UPSTASH_REDIS_REST_*` envs are missing).
- **Risk:** convenient in dev, but a missing/typo'd prod env silently disables all
  auth + general throttling (brute-force, enumeration).
- **Fix:** in `NODE_ENV === 'production'`, treat missing limiter config as a hard
  startup/health-check failure (or fail-closed on auth paths specifically).

### SEC-004 — Webhooks bypass rate limiting · **LOW (compounds SEC-001)** · open
- **Where:** `lib/security/rate-limit.ts` `shouldBypassRateLimit` skips `/api/webhooks/`
  and `/api/cron/`.
- **Note:** acceptable *only* once every webhook verifies a signature. Today, combined
  with SEC-001, the reply webhook is both unauthenticated and unthrottled. Re-evaluate
  after SEC-001/002 land.

### SEC-005 — Long-lived session, no rotation on privilege change · **LOW** · open
- **Where:** `lib/auth/constants.ts` (`SESSION_MAX_AGE_SECONDS = 7 days`), `lib/auth/jwt.ts`.
- **Note:** 7-day non-rotating JWT. `getSyncedAdminSession` re-binds to the live `users`
  row for API/actions (good — a deactivated user is caught there), but page loads via
  `getAdminSession` trust the token until expiry. Consider shorter access token + refresh,
  or a server-side session version to force-invalidate on role/deactivation changes.

### SEC-006 — Confirmed-good (no action) · **INFO**
- Tenant isolation is consistently scoped to `session.accountId` across data routes
  (e.g. `app/api/leads/route.ts`); middleware treats the admin JWT as authoritative on
  `/admin/*` and blocks cross-tenant access; Stripe (`constructEvent`) and Resend (svix)
  webhooks verify signatures; RBAC rank check gates admin routes; cookies are
  `httpOnly` + `secure` (prod) + `sameSite=lax`. Keep these patterns.

---

## UX / ONBOARDING / AHA MOMENT

### UX-001 — Dead link `/admin/agents` (404) on the primary aha path · **HIGH** · open
- **Where:** `components/dashboard/vantera-os/WelcomePanel.tsx:75` (blue agent card) and
  `components/onboarding/CleanSlateWelcome.tsx:45` ("Configure agents") both link to
  `/admin/agents`, which **does not exist** (no `app/(admin)/admin/agents/page.tsx`).
- **Impact:** a brand-new user's most prominent dashboard tile and a clean-slate CTA
  both 404. Direct hit to first-session trust and activation.
- **Fix:** point both to `/admin/outreach/agents` (canonical hub) or add a redirect alias
  like `/admin/sdr-agents`.

### UX-002 — Paywall sits before the aha moment · **HIGH** · open
- **Where:** `OnboardingWizard.tsx` `STEP_IDS` — order is business → ai_overview →
  lead_preview → **subscription** → team → revenue_goal.
- **Impact:** the user hits the credit-card step (step 4 of 6) having only *seen* a lead
  preview, not *acted* on real value. Payment friction before activation depresses
  completion and trial starts.
- **Fix options:** (a) move `subscription` after first real value (let them into the
  dashboard / first Scout run, then gate advanced volume); or (b) keep it but make
  `lead_preview` a stronger, interactive aha (let them enroll a lead) before asking.
  Pairs with **AB-001**.

### UX-003 — Two conflicting "first actions" for new users · **MEDIUM** · open
- **Where:** `CleanSlateWelcome.tsx` pushes **"Find prospects"** → `/admin/outreach/aspire`
  (manual search), while the dashboard panels' empty states + WelcomePanel push
  **"Launch agent" / "Set up Scouting Agent"** → agent setup (autonomous).
- **Impact:** the product tells a new user to do two different first things. Splits
  attention and dilutes the activation funnel.
- **Fix:** choose one canonical aha path (recommended: autonomous agent setup, since
  that's the product's differentiator) and make the other secondary. Pairs with **AB-003**.

### UX-004 — Onboarding progress is device-local only · **MEDIUM** · open
- **Where:** `OnboardingWizard.tsx` persists step + AI analysis + preview leads to
  `localStorage` (`vantera_onboarding_step_<accountId>`).
- **Impact:** switching device/browser mid-onboarding loses the (expensive) AI business
  analysis and lead preview; user re-does work or restarts.
- **Fix:** persist `analysis`/`leads` server-side on the account so resume works anywhere
  (localStorage stays as a fast-path cache).

### UX-005 — Weak password policy + no strength feedback · **MEDIUM** · open
- **Where:** `lib/auth/actions.ts` `signupSchema` — `min(8)` + one digit, no upper limit,
  no breach/common-password check, no client strength meter.
- **Impact:** weak credentials (security) and no guidance (UX → support + reset churn).
- **Fix:** add a strength meter on `components/auth/password-field.tsx`, raise guidance
  (length-first, e.g. 10–12+), and optionally a k-anonymity HIBP check server-side.

### UX-006 — Brand-new dashboard reads as "broken" (0% / — gauges) · **LOW** · open
- **Where:** `components/dashboard/vantera-os/MetricGaugesPanel.tsx`,
  `RevenueTrendCard.tsx`, `LeadsByStageCard.tsx` show 0%/—/empty for fresh accounts.
- **Impact:** empty gauges look like failure, not "not started yet."
- **Fix:** a first-run treatment — replace zero gauges with an encouraging "Run your first
  Scout to populate this" state, or sample/ghost data with a clear "example" label.

### UX-007 — "Integrations" occupies a primary nav slot over core-loop pages · **LOW** · open
- **Where:** `lib/navigation/admin-nav.ts` — Core nav = Dashboard, Agents, Outreach,
  **Integrations**; Pipeline + Inbox demoted to Workspace group.
- **Note:** this matches the Figma literally, but Integrations is a config surface
  (needs email-domain + CRM). For the daily core loop, Pipeline and Inbox are higher
  frequency. Consider whether the Figma's 4 literal items serve the loop, or swap
  Integrations ↔ Pipeline in the primary group.

### UX-008 — Agents nav adds an extra redirect hop · **LOW** · open
- **Where:** nav item `agent` href = `/admin/sdr-agents`, which is a server `redirect()`
  to `/admin/outreach/agents` (`app/(admin)/admin/sdr-agents/page.tsx`).
- **Fix:** point the nav item directly at `/admin/outreach/agents` (keep the alias for
  external/bookmarked links).

### UX-009 — "Calling Agent" is a dead-end tease · **LOW** · open
- **Where:** `AgentsHubView.tsx` `CallingAgentCard` — shows "Soon", no action, no backend.
- **Fix:** add a "Notify me" capture (validates demand + gives the click somewhere to go)
  or hide the card behind a flag until the feature exists.

---

## A/B TEST OPPORTUNITIES

> Each is framed as hypothesis → variants → primary metric → guardrail. Implement behind
> the existing feature-flag system (`lib/feature-flags/*`) so assignment + analytics are
> consistent. Run to significance on the primary metric; watch the guardrail.

### AB-001 — Paywall placement in onboarding
- **Hypothesis:** moving `subscription` to *after* first real value raises activation and
  net trials without hurting paid conversion.
- **Variants:** A = current (pay at step 4) · B = dashboard access first, gate advanced
  volume later.
- **Primary:** onboarding completion → 7-day activation. **Guardrail:** trial→paid rate.
- Ties to **UX-002**.

### AB-002 — Welcome panel: update chips vs single next-best-action
- **Hypothesis:** one prominent "do this next" CTA out-converts a stack of update chips
  for new/low-activity users.
- **Variants:** A = current live-update chips · B = single contextual NBA button.
- **Primary:** dashboard → meaningful action click-through. **Guardrail:** bounce/idle.

### AB-003 — First-action framing: manual search vs autonomous agent
- **Hypothesis:** leading with "Launch agent" (autonomous) beats "Find prospects" (manual)
  on time-to-first-lead because it removes manual search effort.
- **Variants:** A = Aspire-first · B = agent-setup-first.
- **Primary:** time-to-first-lead, D1 activation. **Guardrail:** setup abandonment.
- Ties to **UX-003**.

### AB-004 — Signup layout: OAuth-first vs email-first
- **Hypothesis:** surfacing Google/Apple above the email form lifts signup completion.
- **Variants:** A = current order · B = OAuth buttons primary, email collapsed.
- **Primary:** signup start → completion. **Guardrail:** downstream activation parity.
- **Where:** `components/auth/auth-credentials-panel.tsx`, `oauth-buttons.tsx`.

### AB-005 — Agent card CTA copy
- **Hypothesis:** value/time-framed copy ("Activate in ~2 min") beats generic "Set Up"
  on agent activation.
- **Variants:** A = "Set Up" · B = time/value-framed.
- **Primary:** agent activation rate. **Where:** `AgentsHubView.tsx` `AgentCard`.

### AB-006 — Revenue-goal step placement
- **Hypothesis:** keeping goal-setting at the end (peak-end) vs moving earlier
  (commitment/anchoring) changes goal-set rate and retention.
- **Variants:** A = end (current) · B = right after lead preview.
- **Primary:** goal-set completion + 30-day retention. **Where:** `OnboardingWizard.tsx`.

---

## Suggested sequencing

1. **Ship now (low effort, high impact):** UX-001 (dead link), UX-008 (redirect hop),
   SEC-001 (reply webhook auth).
2. **This week:** SEC-002, SEC-003, UX-003 (pick one aha path), UX-005 (password).
3. **Plan as experiments:** AB-001 + UX-002 (paywall), AB-003 (first action), then the
   rest behind flags.
4. **Backlog:** UX-004 (server-persist onboarding), UX-006 (first-run dashboard),
   UX-007 (IA), UX-009 (calling agent), SEC-005 (session rotation).

---

*Generated by automated audit on 2026-06-10. Re-run after the first batch ships to refresh
the scoreboard.*
