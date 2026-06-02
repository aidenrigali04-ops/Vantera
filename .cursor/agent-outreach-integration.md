# Agent prompts + Trigger.dev (Vantera project)

## Agent markdown

```
apps/web/content/agents/
  _base.md              ← vantera-brand-voice
  prospect_scout.md     ← discovery / ICP (from platform spec)
  outreach_agent.md     ← full outreach playbook
  message_drafter.md    ← sequence copy + DISC (from outreach agent)
  pipeline_analyst.md   ← scoring + retention/upsell
```

Loaded by `lib/agents/prompt-loader.ts` + per-account `lib/sdr/resolve-client-context.ts`.

## Trigger.dev — Vantera project only

Do **not** use `proj_cotpwytcllemudkieuyu` (legacy Ai Marketing Agents stub).

```bash
# Vantera root .env
TRIGGER_PROJECT_REF=<your-new-vantera-project-ref>
TRIGGER_SECRET_KEY=<from Trigger.dev → Vantera project>
APOLLO_API_KEY=...
ANTHROPIC_API_KEY=...
RESEND_API_KEY=...

pnpm trigger:deploy
```

Tasks in `apps/web/trigger/`:

| Task id | Schedule | Spec agent |
|---------|----------|------------|
| `sdr-prospect-scout` | Mon 06:00 UTC | 01 Prospect Scout |
| `sdr-lead-profiler` | On demand | 02 Lead Profiler |
| `draft-sdr-sequence` | On demand | Alias → same run as profiler |
| `sdr-outreach-enroll` | On demand | 03 enrollment log |
| `sdr-outreach-scheduler` | Daily 09:00 UTC | 03 send due steps |
| `sdr-pipeline-analyst` | Daily 07:30 UTC | 04 Pipeline Analyst |
| `sdr-engagement-update` | On demand | 04 realtime (webhooks) |
| `aspire-weekly-search` | Mon 08:00 UTC | Aspire saved searches |

Reference architecture: `Downloads/vantera-sdr-platform-agents.md`

## Personalization per client

Each run calls `resolveClientContext(accountId)`:

- `agentName`, `fromEmail`, ICP, cities, exclusions from `sdr_agent_configs`
- `businessName`, vertical, booking link from `accounts`
- `autonomousOutreach` from `autonomous_ai_messaging` flag

Prompts never hardcode Vantera product copy for client SDR accounts unless that account is Vantera sales.
