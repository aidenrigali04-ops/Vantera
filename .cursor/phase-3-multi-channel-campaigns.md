# Phase 3 — Multi-Channel Campaign Sequences

Master reference for unified email + LinkedIn + SMS outreach campaigns.

## Goal

One campaign workflow with timed steps across channels:
- **Email** — auto-send via Resend (per-customer verified domain)
- **SMS** — auto-send via Twilio
- **LinkedIn** — queue for manual send; user copies message and marks sent

## Built

### Outreach runner
- `lib/outreach/send-sms.ts` — Twilio send with platform or per-account credentials
- `lib/outreach/runner.ts` — multi-channel `processDueCampaignSteps`, `materializeCampaignSteps`, `markCampaignStepSentCore`
- `lib/outreach/workflow-templates.ts` — default 3-step sequence, launch validation
- `lib/outreach/queries.ts` — exclude manual-send steps from cron; `findCampaignStepsForCampaign`

### Campaign wizard
- `components/outreach/CampaignSequenceBuilder.tsx` — add/remove steps, channel + delay + message
- `CampaignDetailClient.tsx` — sequence builder, LinkedIn manual queue, launch preview
- `saveCampaignWorkflow` server action — replaces single-step-only editing for new flows
- Enrollment accepts leads with email, phone, or LinkedIn URL

### Draft review (Phase 2 leftover)
- `POST /api/drafts/[id]/discard`
- `components/dashboard/DraftReviewSheet.tsx` — slide-over from dashboard action feed
- Action feed opens draft review panel for `draft_ready` signals

### Scoring
- `daily-lead-score` syncs composite score to `leads.score`

## Env vars

```
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
```

Per-account Twilio can use `integrationCredentials.accessToken` + `metadata.phoneNumber`.

## Manual ops

- Deploy Trigger.dev jobs: `pnpm trigger:deploy`
- Verify Twilio credentials in production

## Next (Phase 4 candidates)

- LinkedIn API automation (replace manual queue)
- SMS reply tracking
- Campaign analytics by channel
- A/B step variants
