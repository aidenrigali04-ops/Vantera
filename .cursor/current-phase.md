# Current Phase

**Phase 6 — SDR Agents Runtime** (in progress)

Master references:
- `.cursor/sdr-agents-module.md` — full SDR module spec (implemented)
- `.cursor/phase-4-sdr-agents.md` — agent hub positioning
- `.cursor/phase-5-crm-integrations.md` — CRM connect + sync

## SDR Agents (current)

- Enterprise feature flag: `sdr_agent_enabled`
- Command center at `/admin/outreach/agents` when configured
- Setup wizard, sequences table, activity feed
- Daily lead discovery + Claude 5-step sequences + hourly send crons
- Reply webhook → intelligence signals + pipeline qualification

## Manual ops

- Apply migration: `pnpm db:apply packages/db/migrations/0012_sdr_agents.sql`
- Deploy Trigger.dev: `pnpm trigger:deploy`
- Enable `sdr_agent_enabled` per Enterprise account

## Positioning

**Build your SDR Agents** — Deploy AI agents that find, contact, and nurture leads around the clock — without adding headcount. Your pipeline never sleeps.

## Architecture

**Vantera** — automated sales intelligence (Nurture → Sell → Deliver)

| Stage | Route | Purpose |
|-------|-------|---------|
| Deliver | `/admin/clients` | Post-conversion client lifecycle |
| Sell | `/admin/pipeline` | Pre-conversion prospect management |
| **Integrations** | `/admin/integrations` | HubSpot, GHL, Salesforce connect + sync |
| **SDR Agents** | `/admin/outreach/agents` | Deploy & monitor AI agent roster |
| Nurture — Aspire | `/admin/outreach/aspire` | Prospect Scout agent |
| Nurture — Campaigns | `/admin/outreach/campaigns` | Outreach Agent sequences |

## Phase 4 — SDR Agents (complete)

Reference: `.cursor/phase-4-sdr-agents.md`

## Phase 5 — CRM Integrations (current)

- `/admin/integrations` — connect HubSpot, GoHighLevel, Salesforce
- Import leads from CRM → pipeline (dedupe by external ID / email)
- Export pipeline leads → CRM (skips already-linked records)
- CSV export via `/api/leads/export` (all or selected)
- Pipeline header "CRM sync" link + bulk Export CSV

## Manual ops

- Apply migration: `pnpm db:apply packages/db/migrations/0011_crm_lead_sources.sql`
- Deploy Trigger.dev: `pnpm trigger:deploy`
- Production env: `APOLLO_API_KEY`, `RESEND_*`, `TWILIO_*`, `TRIGGER_SECRET_KEY`, `CRON_SECRET`
