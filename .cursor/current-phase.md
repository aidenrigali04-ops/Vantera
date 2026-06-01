# Current Phase

Sales intelligence rebrand complete. Four-service architecture (Nurture → Sell → Deliver) in place.

## Architecture

**Vantera** is an automated sales intelligence system:

| Stage | Route | Purpose |
|-------|-------|---------|
| Deliver — Active Clients | `/admin/clients` | Post-conversion client lifecycle |
| Sell — Pipeline | `/admin/pipeline` | Pre-conversion prospect management |
| Nurture — Aspire | `/admin/outreach/aspire` | Prospect discovery → Add to Pipeline |
| Nurture — LinkedIn | `/admin/outreach/linkedin` | Campaigns, sequences, enrollment |

**Positioning:** Nurture → Sell → Deliver

**Data model:** Dual — `leads` (pre-conversion) + `contacts` with `lifecycleStage` (post-conversion). Conversion via `convertLeadToClient()`.

**crm-dashboard:** Separate repo — agent monitor, not merged.

## Built

- Sidebar grouped by Nurture / Sell / Deliver; intelligence tab nav on pipeline + clients
- Shared operational components (`KpiStrip`, `OperationalTable`, `BulkActionBar`, `DetailSidePanel`, `PageHeader`)
- Schema migrations `0005_core_services.sql`, `0006_rls_core_services.sql`
- Active Clients with lifecycle filter + KPI strip + unified timeline
- Pipeline CRUD, bulk actions, detail view, convert-to-client
- Aspire 3-panel search UI + Add to Pipeline API
- LinkedIn campaigns, sequence builder UI, enrollment
- Dashboard action feed, Trigger.dev jobs (stub), feature flags
- Mobile bottom nav, explore-first onboarding, command palette routes
- Legacy `/admin/crm/*` redirects to new routes

## Phase 2 — Sales Intelligence (in progress)

Master reference: `.cursor/phase-2-sales-intelligence.md`

**Done:**
- Migration `0010_phase2_sales_intelligence.sql` — `aspire_results`, `lead_drafts`, `lead_scores`; extended `aspire_saved_searches`
- `lib/aspire/types.ts`, `icp-score.ts`, `search.ts` (Apollo + ICP scoring)
- `lib/ai/draft-message.ts` — per-lead email/SMS drafting
- `lib/aspire/enroll.ts` — enroll → pipeline → draft job
- Trigger.dev: `draft-on-enroll`, `aspire-weekly-search`, `daily-lead-score`
- API: `/api/aspire/search`, `/enroll`, `/enroll/bulk`, `/searches`, `/results/[searchId]`
- API: `/api/drafts`, `/api/drafts/[id]/approve`
- Resend webhook (inbound reply tracking)
- Per-customer outreach domains (Settings, in-dashboard DNS)
- Action feed: intelligence signal types from `intelligence_signals`

**Next:**
- Deploy Trigger.dev jobs (`pnpm trigger:deploy`)
- Set `APOLLO_API_KEY` in production
- Aspire UI: ICP ring, saved search CRUD, intelligence panel — DONE
- Campaign wizard: Find leads from Aspire in audience step — DONE
