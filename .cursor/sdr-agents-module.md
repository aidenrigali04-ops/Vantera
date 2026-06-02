# SDR Agents Module — Master Reference

Enterprise-only autonomous SDR runtime integrated with Vantera sales intelligence.

## Routes

| Route | Purpose |
|-------|---------|
| `/admin/outreach/agents` | Command center (when configured) or agent hub |
| `/admin/outreach/agents/setup` | 4-step setup wizard |
| `/admin/outreach/agents/sequences` | Active sequences table |
| `/admin/outreach/agents/aspire` | Prospect Scout — bindings, modes, manual runs |
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
Prospect Scout bridge: `packages/db/migrations/0013_sdr_aspire_bridge.sql`

## Trigger.dev jobs

| Job | Schedule | File |
|-----|----------|------|
| `sdr-prospect-scout` | Mon 6am UTC | `trigger/sdr-prospect-scout.ts` — Prospect Scout |
| `aspire-weekly-search` | Mon 8am UTC | `trigger/aspire-weekly-search.ts` |
| `sdr-lead-profiler` | On-demand | `trigger/sdr-lead-profiler.ts` (+ `draft-sdr-sequence` alias) |
| `sdr-outreach-enroll` | On-demand | `trigger/sdr-outreach-enroll.ts` |
| `sdr-outreach-scheduler` | Daily 9am UTC | `trigger/sdr-outreach-scheduler.ts` |
| `sdr-pipeline-analyst` | Daily 7:30am UTC | `trigger/sdr-pipeline-analyst.ts` |
| `sdr-engagement-update` | On-demand | `trigger/sdr-engagement-update.ts` |

Agent prompts: `apps/web/content/agents/` · Context: `lib/sdr/resolve-client-context.ts`

## Prospect Scout ↔ Aspire (Phase 1)

- `lib/prospect-scout/` — `runBoundSearch`, `runUnboundSearch`, `runAccountProspectScout`, `enrollProspect`
- `lib/sdr/aspire-config.ts` — bindings CRUD
- `GET/PUT /api/sdr/aspire-config` — config + saved search bindings
- `POST /api/sdr/aspire-config/run` — manual “Run now” (`{ searchId?: string }`)
- Table `sdr_aspire_bindings` links `sdr_agent_configs` ↔ `aspire_saved_searches`
- `aspire_search_runs` records `status`, `enrolled_count`, `finished_at`

Prospect modes on `sdr_agent_configs.prospect_mode`:

| Mode | Behavior |
|------|----------|
| `aspire_bound` (default) | Run active `sdr_aspire_bindings` against saved searches |
| `inline_icp` | Legacy Apollo find from config ICP only |
| `hybrid` | Bindings first, then inline fill for remaining headroom |

## Realtime (Phase 3)

Migration: `packages/db/migrations/0014_realtime_sdr_aspire.sql` — JWT SELECT RLS + `supabase_realtime` publication.

Hook: `lib/supabase/account-realtime.ts` (`useAccountRealtime`) — same pattern as Kanban `records`.

| Table | UI |
|-------|-----|
| `sdr_activity_log` | SDR command center activity feed (replaces 30s poll) |
| `aspire_search_runs` | Prospect Scout config recent runs |
| `aspire_results` | Aspire page saved-search results (scoped by `search_id`) |

Requires authenticated Supabase session with `account_id` in JWT (admin login).

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
GET/PUT         /api/sdr/aspire-config
POST            /api/sdr/aspire-config/run
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
pnpm db:apply packages/db/migrations/0013_sdr_aspire_bridge.sql
pnpm db:apply packages/db/migrations/0014_realtime_sdr_aspire.sql
pnpm trigger:deploy
```

Enable flag for an Enterprise account:

```sql
INSERT INTO feature_flags (account_id, flag_name, is_enabled)
VALUES ('<account-uuid>', 'sdr_agent_enabled', true)
ON CONFLICT DO NOTHING;
```
