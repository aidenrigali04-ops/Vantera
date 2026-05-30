# Current Phase

Four-service restructure complete (Phases 1–8).

## Architecture

**Vantera** is structured around four core services:

| Service | Route | Purpose |
|---------|-------|---------|
| CRM — Active Clients | `/admin/crm/clients` | Post-conversion client lifecycle |
| CRM — Lead Pipeline (LMS) | `/admin/crm/pipeline` | Pre-conversion prospect management |
| Aspire | `/admin/outreach/aspire` | Prospect discovery → Add to Pipeline |
| LinkedIn | `/admin/outreach/linkedin` | Campaigns, sequences, enrollment |

**Positioning:** Nurture → Sell → Deliver

**Data model:** Dual — `leads` (pre-conversion) + `contacts` with `lifecycleStage` (post-conversion). Conversion via `convertLeadToClient()`.

**crm-dashboard:** Separate repo — agent monitor, not merged.

## Built (Phases 1–8)

- Sidebar, CRM hub tabs, Outreach sub-nav, legacy redirects
- Shared operational components (`KpiStrip`, `OperationalTable`, `BulkActionBar`, `DetailSidePanel`, `PageHeader`)
- Schema migrations `0005_core_services.sql`, `0006_rls_core_services.sql`
- Active Clients with lifecycle filter + KPI strip + unified timeline
- Lead Pipeline CRUD, bulk actions, detail view, convert-to-client
- Aspire 3-panel search UI + Add to Pipeline API
- LinkedIn campaigns, sequence builder UI, enrollment
- Dashboard action feed, Trigger.dev jobs (stub), feature flags
- Mobile bottom nav, onboarding copy, command palette routes

## Onboarding (explore-first)

New users land on the **demo dashboard** with sample data (3 clients, 5 deals, 2 projects) — not a 6-step wizard.

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
