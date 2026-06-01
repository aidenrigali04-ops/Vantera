# Current Phase

**Phase 3 — Multi-channel campaign sequences** (complete)

Master reference: `.cursor/phase-3-multi-channel-campaigns.md`

## Architecture

**Vantera** — automated sales intelligence (Nurture → Sell → Deliver)

| Stage | Route | Purpose |
|-------|-------|---------|
| Deliver | `/admin/clients` | Post-conversion client lifecycle |
| Sell | `/admin/pipeline` | Pre-conversion prospect management |
| Nurture — Aspire | `/admin/outreach/aspire` | Prospect discovery → Add to Pipeline |
| Nurture — Campaigns | `/admin/outreach/campaigns` | Multi-channel sequences (email · LinkedIn · SMS) |

## Phase 2 — Sales Intelligence (complete)

Reference: `.cursor/phase-2-sales-intelligence.md`

- Aspire search, ICP scoring, enroll → draft pipeline
- Trigger.dev: `draft-on-enroll`, `aspire-weekly-search`, `daily-lead-score`
- Resend webhooks, per-customer outreach domains
- Draft approve API, intelligence action feed

## Phase 3 — Multi-Channel Campaigns (complete)

- Unified campaign sequence: email + LinkedIn + SMS steps with delays
- `CampaignSequenceBuilder` in campaign wizard
- SMS via Twilio (`lib/outreach/send-sms.ts`)
- LinkedIn steps queue for manual send + Mark sent in Results
- Draft discard API + dashboard draft review slide-over
- `daily-lead-score` syncs `leads.score`

## Manual ops

- Deploy Trigger.dev: `pnpm trigger:deploy`
- Production env: `APOLLO_API_KEY`, `RESEND_*`, `TWILIO_*`, `TRIGGER_SECRET_KEY`, `CRON_SECRET`
