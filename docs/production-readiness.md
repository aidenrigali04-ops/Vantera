# Vantera production readiness plan

Enterprise-grade operations, staged by when each item must exist: **before the first real user** (anything user-data-bearing goes live — practically, before Phase 2 deploys to production), **before the first real send** (Phase 5 — the riskiest surface), **before the first paid user** (Phase 7), and **continuous**. Hosting and environments are locked in rule 10; compliance requirements in rule 11.

---

## Before the first real user (gate for deploying Phase 2)

**Environments & CI/CD**
- [ ] Vercel project linked to the repo; preview deploy per PR; production deploys from `main` only.
- [ ] Supabase **prod project separate from dev**; anon/service keys per env in the right vaults (Vercel / Trigger.dev / GitHub Actions secrets).
- [ ] Migration discipline in CI: a job applies `packages/db/migrations/` to prod on merge (Supabase CLI or drizzle-kit), plus a drift check that fails if schema ≠ migrations.
- [ ] Branch protection on `main`: CI green required, no force pushes (mirrors the local bash-guard hook).
- [ ] Trigger.dev prod environment created; `trigger deploy` wired into the release flow.

**Security**
- [ ] RLS verified against the prod project (run the `rls-auditor` checklist on the applied schema, not just the files).
- [ ] Security headers + sensible defaults on the Next.js app (CSP groundwork, no `x-powered-by`).
- [ ] Rate limiting on auth-adjacent routes (login, signup, password reset).
- [ ] Supabase Auth hardening: email confirmations on, sane password policy, leaked-password protection.
- [ ] `pnpm audit` + Dependabot (or Renovate) in CI.

**Observability**
- [ ] Error tracking (Sentry or Vercel observability) wired in `apps/web` with source maps; alert channel configured.
- [ ] `/api/health` endpoint + external uptime monitor.
- [ ] Structured server logs carrying `accountId` (and later `campaignId`) for correlation.

**Data**
- [ ] Supabase PITR/backups enabled on prod; one restore drill performed and documented.
- [ ] Account deletion path works end-to-end (Phase 2 feature; verify in prod).

## Before the first real send (gate for Phase 5 go-live)

This is the highest-risk surface: real emails and LinkedIn actions on customers' behalf.

- [ ] **Suppression list live and enforced at the scheduler boundary** with passing tests (rule 11) — non-negotiable.
- [ ] Unsubscribe flow tested end-to-end in prod (link → suppression write → future sends blocked).
- [ ] Cold-email template includes physical address; sender identity accurate.
- [ ] Webhook signature verification on every inbound route (email infra, LinkedIn infra) — tested with forged-payload rejection.
- [ ] **Sending kill switch**: one flag halts all outbound sends platform-wide (and per account). The single most important operational control; test it.
- [ ] Deliverability alarms: bounce rate and spam-complaint thresholds that *automatically pause* the offending campaign/mailboxes and notify.
- [ ] LinkedIn safety limits verified in the scheduler (ramp, ~100 invites/week, randomized pacing; non-configurable below thresholds).
- [ ] Warmup gating verified: a mailbox in `warming` phase cannot be selected for campaign sends.
- [ ] **Lead time planned: domain + mailbox provisioning starts 2–4 weeks before a customer's launch date** (warmup is time-gated; it cannot be compressed).
- [ ] Trigger.dev failure alerts on pipeline tasks (a silently dead scheduler is a churned customer).
- [ ] GDPR erasure runbook: account- and lead-level deletion incl. vendor-side deletion calls (email infra, LinkedIn infra, enrichment provider); documented and rehearsed.
- [ ] Subprocessor list + DPAs collected (email provider, LinkedIn provider, enrichment provider, Supabase, Vercel, Anthropic, Stripe, Resend).

## Before the first paid user (gate for Phase 7 go-live)

- [ ] Stripe live mode: products/prices created, webhook endpoint verified (signature checked), entitlement sync tested with live-mode test clocks.
- [ ] Billing failure paths: dunning behavior decided; downgrade/cancel does not strand running campaigns silently (pause + notify).
- [ ] Terms of Service + Privacy Policy published (cold-outreach products get scrutiny; say what Vantera does on the user's behalf).
- [ ] Support channel live (even just email) — the copilot's escalation circuit-breaker (rule 09) needs somewhere to escalate.

## Continuous

**Release discipline (every merge to main)**
1. CI gate: lint, type-check, test, build (+ red-team copilot fixture once Phase 6 ships).
2. Migrations applied automatically; drift check green.
3. Vercel production deploy; `trigger deploy` for job changes.
4. Post-deploy: error-rate watch on the new release.

**Recurring**
- Weekly: review deliverability dashboards, Trigger.dev failure rates, knowledge-gap log (`copilot_knowledge_gaps`) for help-content backlog.
- Monthly: dependency updates (Dependabot merges), `rls-auditor` sweep over the full schema, restore-drill rotation.
- Quarterly: review vendor limits/costs against growth (see cost map), rotate API keys.

**Cost & limits map** (watch as usage grows)
| Resource | Limit/lever | Failure mode |
|---|---|---|
| Enrichment API | 100 QPS | Pipeline backpressure — queue in Trigger.dev, never burst |
| Anthropic API | Rate tier / spend | Scoring + copy generation stall; copilot degrades |
| LinkedIn | ~100 invites/wk/account (hard safety ceiling) | Account restriction = customer catastrophe; never raise |
| Email | Warmup-gated daily caps per mailbox | Deliverability collapse if ignored; scale mailboxes, not caps |
| Trigger.dev | Concurrency per plan | Scheduler lag at customer-count scale |
| Supabase | Connection limits (use pooling), storage | App-wide outage |
| Vercel | Function duration/bandwidth | Keep long work in Trigger.dev, never in routes |

**Incident response (runbook skeleton)**
1. Detect (alert) → 2. Halt blast radius (sending kill switch if outreach-related) → 3. Diagnose via correlated logs (`accountId`/`campaignId`) → 4. Fix forward or roll back (Vercel instant rollback; DB via forward-only migration) → 5. Customer comms if data or sends were affected → 6. Postmortem note in `docs/incidents/`.

**Scale-up triggers** (revisit, don't pre-build)
- >50 active accounts: dedicated staging environment + Supabase branching workflow.
- First enterprise customer: SOC 2 readiness assessment, SSO (Supabase Auth supports SAML), audit-log export.
- Multi-region demand: revisit Supabase region + Vercel regional functions.
