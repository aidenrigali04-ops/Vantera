# Vantera development roadmap

**The single source of truth for sequencing** (rule 12). Work happens in this order; `/next-phase` reads this file. A checkbox flips only when the phase's full definition of done is met (rule 12). Descoped items become new bullets here — never silent drops.

**Sequencing principle:** build the revenue loop first (auth → leads → campaigns → live sends), monetize once value is demonstrable, expansion channels last. Compliance ships inside the phase that creates each surface (rule 11), not at the end.

Each entry stays short — the detail lives in that phase's spec (`docs/superpowers/specs/`) and plan (`docs/superpowers/plans/`), produced when its session starts.

---

- [x] **Phase 1 — Platform scaffold**
  Monorepo, Next.js 16 app, `@vantera/db` with RLS from migration #1, `@vantera/ai`, email/linkedin infra interfaces + fakes, Trigger.dev jobs, CI. Shipped 2026-06-11.

- [x] **Phase 2 — Auth, onboarding & app shell**
  Goal: a user can sign up, create an account, complete onboarding, and land on a real dashboard shell. Shipped 2026-06-11.
  Scope: Supabase signup/login/logout/reset pages; `create_account` flow; onboarding wizard capturing **industry/ICP + revenue goal** (becomes the campaign-wizard default, rule 08); dashboard shell + nav (rule 07 reference workflow); account settings incl. **account deletion** (GDPR groundwork, rule 11); team invites (schema only — UI can defer to Phase 7); scaffold `packages/help-content` so knowledge-sync (rule 09) has a home from the first feature.
  Depends on: nothing. Key rules: 02, 07, 09, 11.

- [x] **Phase 3 — SDR agents: Scout + Copy (agent-centric front door)**
  Goal: deploy a Prospect (Scout) Agent and a Copy Agent through setup wizards; the pipeline sources, gates, scores, enriches, and drafts personalized outreach into the review queue. Shipped 2026-06-11 (rule 08 rewritten to the agent model).
  Scope shipped: `agents`/`agent_icps`/`agent_assets` schema (RLS, 0007); `packages/prospect-data` (interface + in-memory fake + Explorium adapter); `packages/agent-brains` (rules gate, batched AI rank with `ai_insights`, website scan, email + LinkedIn copy brains, humanizer); Trigger.dev scheduler cron + scout-run + copy-draft tasks; **suppression enforced before every draft, with tests** (rule 11); agent wizards + `/agents` page with Live cards.
  Descoped to later phases: leads table UI (Phase 4), review-queue UI (Phase 4), automatic/manual send modes + preview step + user-drafted copy path (Phase 5), LinkedIn follow-up sequencing (Phase 5).

- [x] **Phase 4 — Leads & review queue UI**
  Goal: users see what their agents produced and approve outreach. Shipped 2026-06-11.
  Scope shipped: leads table UI with status tabs, pagination, and score/rationale/insights slide-over (rule 06 surface); review queue UI at `/review` (approve / edit-with-relint / decline / decline-and-suppress, style flags visible; Campaigns nav slot replaced per rule 08); suppression management UI at `/settings/suppression` (add+view only — entries never expire per 0003; adds flip queued drafts to suppressed); 0008 `scheduled_sends.style_flags`; daily retention purge job (90-day window from 0002); safety-limit scaffolding (`safety-limits.ts`, rule 04 ceilings, wired at the Phase 5 send boundary).
  Follow-up (pre-existing, flagged by whitelabel audit): rename the `leads.source` enum value `'explorium'` to a neutral value before any surface/DTO/export ever selects `source` — fold into Phase 5 or 6.
  Depends on: Phase 3. Key rules: 04, 06, 08, 11.

- [ ] **Phase 5 — Live channel adapters** *(build in progress 2026-06-12 — spec/plan in docs/superpowers)*
  Goal: real sends through real providers, replies flowing back in.
  Scope: Smartlead adapter implementing `EmailInfra` (domain/mailbox provisioning UX, warmup status gating sends, sends, reply webhooks); Unipile adapter implementing `LinkedInInfra` (hosted auth in onboarding, invites, messages, reply webhooks); webhook routes with **signature verification**; shared reply-classification handler ("interested" → next step, "not interested" → suppression); **unsubscribe link + one-click unsubscribe → suppression, physical address in cold emails** (rule 11).
  Built: 0009 migration; both adapters behind env factories; send-dispatch/outreach-send/process-inbound pipeline with kill switch, account pause, safety limits, warmup gating, suppression-at-boundary tests; reply brain; webhook + one-click-unsubscribe routes; `/settings/channels` (provisional UI); send-mode toggle (review/automatic) on the Outreach wizard + agent card + channel-readiness hints; review-queue stage chips + Processed view; lead slide-over reply badge; 4 help articles (incl. review-queue lifecycle); `.env.example` additions (`SMARTLEAD_WEBHOOK_SECRET`, `UNIPILE_WEBHOOK_SECRET`, `APP_URL`). Full gate green 2026-06-12. Remaining before `/ship-phase`: live smoke test per adapter with owner keys (warmupStatus, hosted-auth link, webhook 200/401) — needs real credentials, not runnable in CI.
  Deferred to later phases (not silent drops): manual-draft + user-drafted-copy send modes; deliverability alarm dashboards (minimal automatic reactions shipped: bounce/complaint → suppression + mailbox pause); reply conversation UI.
  Audit follow-ups: `scheduled_sends` check tying `linkedin_stage` to channel (follow-up migration); confirm the hosted-auth custom domain is configured vendor-side before launch (+ adapter assertion); consider blocking client writes to `leads.linkedin_connected_at`.
  Depends on: Phase 4. Key rules: 03, 04, 11. Note: provision warmup-dependent domains 2–4 weeks before any launch date.

- [ ] **Phase 6 — Help copilot v1**
  Goal: the approved copilot spec, live on every dashboard page.
  Scope: build `docs/superpowers/specs/2026-06-11-help-copilot-design.md` — `packages/help-agent`, `packages/help-content` index build, `/api/copilot` streaming route, overlay UI, action tiers + confirmation cards, `copilot_actions`/`copilot_knowledge_gaps` tables, red-team CI fixture; backfill help articles for Phases 2–5 surfaces.
  Built: RAG knowledge index via pgvector + Voyage embeddings; help-agent core with tiered tools (read/navigate/mutate/critical); `/api/copilot` streaming route with persistence + audit + tenant isolation; MorphPanel overlay with confirmation/outcome cards, feedback + escalation; pause/resume mutate with undo; navigate tier with highlights + walkthroughs; red-team fixture; copilot.md article; 0011 migration; 180-day copilot_conversations retention purge (cascades copilot_messages).
  Remaining before /ship-phase: live smoke test with owner VOYAGE_API_KEY (run `pnpm --filter @vantera/help-content build-index` to populate the index, then exercise the overlay).
  Depends on: Phases 2–5 (things to help with). Key rules: 09. Skill: building-copilot-features.

- [ ] **Phase 7 — Billing & team seats** *(build complete 2026-06-13 — spec/plan in docs/superpowers; pending /ship-phase)*
  Goal: customers can pay; plans gate usage.
  Scope: Stripe products/plans (per-LinkedIn-account pricing maps to plans, rule 04); checkout + customer portal; webhook-driven entitlements; seat management UI on the Phase 2 schema; plan gates on campaigns/mailboxes/seats; billing is deep-link-only for the copilot (rule 09).
  Built: `@vantera/billing` package (tiered plan config + add-on price ids, pure entitlement resolver + limit checks, `BillingProvider` interface, in-memory fake, Stripe adapter incl. webhook parsing, env factory); migration 0013 (account entitlement snapshot `plan`/`subscription_status`/`seats_purchased`/`linkedin_accounts_purchased`/`current_period_end`, server-managed via column grants + guardrail test, `webhook_events.source += stripe`; also closed a pre-existing grant gap — `sender_address`/`outreach_paused` were client-written but never granted); Stripe webhook handler + route (signature verify, idempotency, snapshot persist, lapse→pause via `outreach_paused`, first-subscription account linkage via `subscription_data.metadata.accountId`); `/settings/billing` page + Checkout/Portal actions; plan gates on mailbox/LinkedIn/campaign create-paths; `/settings/team` seat UI + invite/revoke/remove actions + seat-cap gate + accept-invite via the existing `accept_invite` SECURITY DEFINER RPC; read-tier copilot `getBillingStatus` tool (billing stays deep-link-only, rule 09); `billing.md` + `team-seats.md` help articles; `.env.example` Stripe keys. Per-package gate green (billing/db/web/help-content/transactional-email: lint 0 errors, type-check clean, all tests pass).
  Remaining before /ship-phase: full-monorepo `pnpm build`/`type-check` is currently red only from **unrelated inherited caller-agent work** (`packages/agent-brains/src/caller/brief.test.ts` imports a `./brief` that was never committed — pre-existing on the branch base, not Phase 7) — must be resolved/merged separately; `next build` not runnable offline (Google-Fonts fetch); rls-auditor on the 0013 diff (note the widened client UPDATE grant) + whitelabel-auditor on the new surfaces; live Stripe test-mode smoke (checkout → webhook → snapshot) with owner keys (`STRIPE_*`), not runnable in CI.
  Depends on: Phase 5 (a sellable loop). Key rules: 02, 04, 09.

- [ ] **Phase 8 — Analytics & revenue goal**
  Goal: users see progress toward the revenue goal they set in onboarding.
  Scope: campaign funnel analytics (sent → opened/accepted → replied → meeting → closed); revenue-goal progress tracking; deliverability health surface (white-labeled warmup/bounce data); Recharts dashboards; copilot tools for every number shown.
  Depends on: Phases 5, 7. Key rules: 01, 07, 09.

- [ ] **Phase 9 — CRM push**
  Goal: closed leads land in the customer's CRM (Vantera is not a CRM, rule 01).
  Scope: Vantera-owned `crm-infra` interface (same swappable pattern); first two connectors (HubSpot, Salesforce); field mapping UI; push-on-close + retry handling; connection health surface.
  Depends on: Phase 8 (close tracking). Key rules: 01.

- [x] **Phase 10 — AI caller**
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
