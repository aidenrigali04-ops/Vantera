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

## Onboarding (explore-first)

New users land on the **demo dashboard** with sample data (3 clients, 5 opportunities, 2 projects) — not a 6-step wizard.

| Step | Experience |
|------|------------|
| 1 | Sign up → sample workspace seeded → `/admin/dashboard` |
| 2 | Explore via `ExploreGuideRail` + full admin UI |
| 3 | Banner: "This is sample data — replace it with yours." |
| 4 | **Keep sample data** or **I'm ready to set up my workspace** (clean slate) |
| 5 | Clean slate → confirmation modal → empty state with "Add your first client →" |

Legacy `/admin/onboarding` redirects to dashboard. Optional wizard step files remain for settings migration later.

## Next

- Run migrations against Supabase if not applied
- Wire real Apollo/Clay (Aspire) and Chrome extension (LinkedIn)
- Expand RLS policies and production QA
