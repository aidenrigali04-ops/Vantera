# Vantera development roadmap

**The single source of truth for sequencing** (rule 12). Work happens in this order; `/next-phase` reads this file. A checkbox flips only when the phase's full definition of done is met (rule 12). Descoped items become new bullets here — never silent drops.

**Sequencing principle:** build the revenue loop first (auth → leads → campaigns → live sends), monetize once value is demonstrable, expansion channels last. Compliance ships inside the phase that creates each surface (rule 11), not at the end.

Each entry stays short — the detail lives in that phase's spec (`docs/superpowers/specs/`) and plan (`docs/superpowers/plans/`), produced when its session starts.

---

- [x] **Phase 1 — Platform scaffold**
  Monorepo, Next.js 16 app, `@vantera/db` with RLS from migration #1, `@vantera/ai`, email/linkedin infra interfaces + fakes, Trigger.dev jobs, CI. Shipped 2026-06-11.

- [ ] **Phase 2 — Auth, onboarding & app shell**
  Goal: a user can sign up, create an account, complete onboarding, and land on a real dashboard shell.
  Scope: Supabase signup/login/logout/reset pages; `create_account` flow; onboarding wizard capturing **industry/ICP + revenue goal** (becomes the campaign-wizard default, rule 08); dashboard shell + nav (rule 07 reference workflow); account settings incl. **account deletion** (GDPR groundwork, rule 11); team invites (schema only — UI can defer to Phase 7); scaffold `packages/help-content` so knowledge-sync (rule 09) has a home from the first feature.
  Depends on: nothing. Key rules: 02, 07, 09, 11.

- [ ] **Phase 3 — Lead pipeline backend**
  Goal: the SDR Prospect Agent can source, gate, score, and enrich leads end-to-end (no outreach yet).
  Scope: prospect/lead/ICP schema (RLS + retention windows); Vantera-owned `enrichment` interface + Explorium adapter behind it (same pattern as email/linkedin-infra, rule 05); rules gate (deterministic ICP-fit); AI rank via `@vantera/ai` with dashboard-visible rationale (rule 06); enrichment waterfall orchestrator (email verification before sends, phone validation for the AI caller — stubs OK); Trigger.dev pipeline tasks; basic leads table UI with score rationale.
  Depends on: Phase 2 (accounts, ICP from onboarding). Key rules: 05, 06, 11.

- [ ] **Phase 4 — Campaign wizard & scheduler core**
  Goal: a user can create and launch a campaign; the scheduler runs it against fake infra.
  Scope: full rule 08 wizard (channels → targeting type-ahead, max 3 + onboarding default → copywriting paths → run options with mode preselection → preview for automatic mode → launch); Prospect Agent **(Live)** indicator; scheduler with run time + cadence, channel safety limits (rule 04 ceilings), per-lead copy tailoring via `@vantera/ai`; review-before-send draft queue; **suppression list table + enforcement at the scheduler boundary with tests** (rule 11).
  Depends on: Phase 3 (leads to campaign against). Key rules: 04, 08, 11.

- [ ] **Phase 5 — Live channel adapters**
  Goal: real sends through real providers, replies flowing back in.
  Scope: Smartlead adapter implementing `EmailInfra` (domain/mailbox provisioning UX, warmup status gating sends, sends, reply webhooks); Unipile adapter implementing `LinkedInInfra` (hosted auth in onboarding, invites, messages, reply webhooks); webhook routes with **signature verification**; shared reply-classification handler ("interested" → next step, "not interested" → suppression); **unsubscribe link + one-click unsubscribe → suppression, physical address in cold emails** (rule 11).
  Depends on: Phase 4. Key rules: 03, 04, 11. Note: provision warmup-dependent domains 2–4 weeks before any launch date.

- [ ] **Phase 6 — Help copilot v1**
  Goal: the approved copilot spec, live on every dashboard page.
  Scope: build `docs/superpowers/specs/2026-06-11-help-copilot-design.md` — `packages/help-agent`, `packages/help-content` index build, `/api/copilot` streaming route, overlay UI, action tiers + confirmation cards, `copilot_actions`/`copilot_knowledge_gaps` tables, red-team CI fixture; backfill help articles for Phases 2–5 surfaces.
  Depends on: Phases 2–5 (things to help with). Key rules: 09. Skill: building-copilot-features.

- [ ] **Phase 7 — Billing & team seats**
  Goal: customers can pay; plans gate usage.
  Scope: Stripe products/plans (per-LinkedIn-account pricing maps to plans, rule 04); checkout + customer portal; webhook-driven entitlements; seat management UI on the Phase 2 schema; plan gates on campaigns/mailboxes/seats; billing is deep-link-only for the copilot (rule 09).
  Depends on: Phase 5 (a sellable loop). Key rules: 02, 04, 09.

- [ ] **Phase 8 — Analytics & revenue goal**
  Goal: users see progress toward the revenue goal they set in onboarding.
  Scope: campaign funnel analytics (sent → opened/accepted → replied → meeting → closed); revenue-goal progress tracking; deliverability health surface (white-labeled warmup/bounce data); Recharts dashboards; copilot tools for every number shown.
  Depends on: Phases 5, 7. Key rules: 01, 07, 09.

- [ ] **Phase 9 — CRM push**
  Goal: closed leads land in the customer's CRM (Vantera is not a CRM, rule 01).
  Scope: Vantera-owned `crm-infra` interface (same swappable pattern); first two connectors (HubSpot, Salesforce); field mapping UI; push-on-close + retry handling; connection health surface.
  Depends on: Phase 8 (close tracking). Key rules: 01.

- [ ] **Phase 10 — AI caller**
  Goal: voice outreach to phone-validated leads.
  Scope: calling provider selection (spec decides; behind a `voice-infra` interface); call scripts tailored per lead; outcomes into the reply-classification flow; consent/recording rules per jurisdiction (extend rule 11 before build).
  Depends on: Phase 3 (phone validation), Phase 4 (scheduler). Key rules: 01, 05, 11.

- [ ] **Phase 11 — Meta Ads + nurturing**
  Goal: users generate Meta ads on-platform feeding the nurture channel (rule 01 key initiative).
  Scope: ad generation via Claude (copy) + Higgsfield (creative); campaign nurturing flows for ad-sourced leads; Meta account connection.
  Depends on: Phase 8 (analytics to measure it). Key rules: 01, 02.

---

## Continuous tracks (no single phase)

- **UI Designer Reference workflow** (rule 07): when a reference sheet exists for a surface, the replicate-precisely loop applies to that surface's phase.
- **Knowledge-sync** (rule 09): every user-facing change ships its help article from Phase 2 onward.
- **Production readiness** (`docs/production-readiness.md`): the "before first real user" items must be complete before Phase 5 sends anything real.
