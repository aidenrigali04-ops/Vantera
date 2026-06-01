# SDR Agents Module — Master Reference

Enterprise-only autonomous SDR runtime integrated with Vantera sales intelligence.

## Routes

| Route | Purpose |
|-------|---------|
| `/admin/outreach/agents` | Command center (when configured) or agent hub |
| `/admin/outreach/agents/setup` | 4-step setup wizard |
| `/admin/outreach/agents/sequences` | Active sequences table |
| `/admin/sdr-agents` | Alias → `/admin/outreach/agents` |

## Feature flag

`sdr_agent_enabled` — Enterprise plan, **off by default**. Enable per account in `feature_flags`.

All SDR server actions and APIs call `requireSDREnabled()`.

## Database tables

- `sdr_agent_configs` — one per account (agent identity + ICP + schedule)
- `sdr_sequences` — nurture sequence per lead (`lead_id`, not contact)
- `sdr_sequence_steps` — 5-step email/SMS schedule
- `sdr_activity_log` — immutable audit trail (feeds command center)

Migration: `packages/db/migrations/0012_sdr_agents.sql`

## Trigger.dev jobs

| Job | Schedule | File |
|-----|----------|------|
| `sdr-agent-find` | Daily 7am | `trigger/sdr-agent-find.ts` |
| `draft-sdr-sequence` | On-demand | `trigger/draft-sdr-sequence.ts` |
| `sdr-agent-send` | Hourly | `trigger/sdr-agent-send.ts` |

## Sales intelligence integration

- **Intelligence signals**: step sent (green), reply interested (red), objection (yellow), delivery failed (red)
- **Activities**: `sdr_reply_interested` on qualified reply
- **Lead pipeline**: updates `leads.relationship_status` → `qualified` on interested reply
- **AI memory**: segment performance via `ai_memory` (`kind=pattern`, `evidence.segmentKey`)
- **Draft review**: when `autonomous_ai_messaging=false`, creates `lead_drafts` + yellow signals
- **Automation runs**: logged via `getSystemAutomationId(..., 'sdr_find'|'sdr_draft'|'sdr_send')`

## API

```
GET/PATCH/POST  /api/sdr/config
POST            /api/sdr/config/pause | /resume
GET             /api/sdr/stats
GET             /api/sdr/activity
GET/DELETE      /api/sdr/sequences
GET/DELETE      /api/sdr/sequences/:id
POST            /api/webhooks/sdr/reply
```

## Manual ops

```bash
pnpm --filter @vantera/db build
pnpm db:apply packages/db/migrations/0012_sdr_agents.sql
pnpm trigger:deploy
```

Enable flag for an Enterprise account:

```sql
INSERT INTO feature_flags (account_id, flag_name, is_enabled)
VALUES ('<account-uuid>', 'sdr_agent_enabled', true)
ON CONFLICT DO NOTHING;
```
