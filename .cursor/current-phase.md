# Current Phase

**Phase 4 — SDR Agents** (in progress)

Master reference: `.cursor/phase-4-sdr-agents.md`

## Positioning

**Build your SDR Agents** — Deploy AI agents that find, contact, and nurture leads around the clock — without adding headcount. Your pipeline never sleeps.

## Architecture

**Vantera** — automated sales intelligence (Nurture → Sell → Deliver)

| Stage | Route | Purpose |
|-------|-------|---------|
| Deliver | `/admin/clients` | Post-conversion client lifecycle |
| Sell | `/admin/pipeline` | Pre-conversion prospect management |
| **SDR Agents** | `/admin/outreach/agents` | Deploy & monitor AI agent roster |
| Nurture — Aspire | `/admin/outreach/aspire` | Prospect Scout agent |
| Nurture — Campaigns | `/admin/outreach/campaigns` | Outreach Agent sequences |

## Phase 3 — Multi-Channel Campaigns (complete)

Reference: `.cursor/phase-3-multi-channel-campaigns.md`

## Phase 4 — SDR Agents (current)

- `/admin/outreach/agents` hub with four agent cards
- Dashboard promo banner + pipeline hub CTA
- Landing page headline updated
- Agent stats from live DB (campaigns, searches, drafts, pipeline)

## Manual ops

- Deploy Trigger.dev: `pnpm trigger:deploy`
- Production env: `APOLLO_API_KEY`, `RESEND_*`, `TWILIO_*`, `TRIGGER_SECRET_KEY`, `CRON_SECRET`
