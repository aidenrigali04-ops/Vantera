# Phase 4 — SDR Agents

Master reference for the AI SDR agent hub and positioning.

## Positioning

**Headline:** Build your SDR Agents

**Subheadline:** Deploy AI agents that find, contact, and nurture leads around the clock — without adding headcount. Your pipeline never sleeps.

## Built

### Hub page — `/admin/outreach/agents`
- Hero with positioning copy
- KPI strip: agents running, enrolled leads, drafts waiting, 24/7
- Four agent cards wired to existing product capabilities:
  - **Prospect Scout** → Aspire saved searches (`aspire-weekly-search` job)
  - **Outreach Agent** → Multi-channel campaigns + cron runner
  - **Message Drafter** → `draft-on-enroll` + dashboard draft review
  - **Pipeline Analyst** → `daily-lead-score` + action feed signals
- Recommended deploy order + integration settings link

### Discovery
- Dashboard promo banner (`SdrAgentsPromo`) with agent running count
- Pipeline hub primary CTA → Build SDR agents
- Workspace header action on pipeline/outreach routes
- Public landing page (`/`) updated with SDR Agents headline

### Lib
- `lib/agents/sdr-agents.ts` — definitions, copy constants, card builder
- `lib/agents/queries.ts` — snapshot stats from DB

## Manual ops

- Deploy Trigger.dev jobs for agents to run in production: `pnpm trigger:deploy`

## Next

- Per-agent enable/disable toggles stored on account
- Agent activity log / run history UI
- Autonomous mode toggle surfaced on agent cards
