# Vantera — AI Outreach Platform: Architecture

## Platform Scope (New)

**Mission:** Four AI SDK agents that autonomously source leads from 285M prospects and run personalized outreach across LinkedIn, Email, SMS, and AI Cold Calling.

No CRM. No client portal. Pure outbound machine.

---

## What Changes

### Remove
| Path | Reason |
|---|---|
| `app/(portal)/` | Client portal entirely gone |
| `lib/portal/` | Portal auth, config, invite, queries |
| `app/(admin)/admin/crm/` | CRM nav section |
| `app/(admin)/admin/contacts/` | Contact records UI |
| `app/(admin)/admin/records/` | Pipeline record UI |
| `app/(admin)/admin/pipeline/` | Pipeline view |
| `app/(admin)/admin/calendar/` | Calendar |
| `app/(admin)/admin/deliverables/` | Deliverables |
| `app/(admin)/admin/forecasting/` | Forecasting |
| `app/(admin)/admin/reports/` | Reports |
| `app/(admin)/admin/portal/` | Portal settings |
| `app/(admin)/admin/ai-brain/` | CRM AI brain (replaced by agent health) |
| `lib/ai/workflows/` | CRM workflows (bootstrap-business-context, daily-sweep, on-record-stage-change) |
| `lib/ai/tools/score-record.ts` | CRM pipeline scoring |
| `lib/ai/tools/summarize-business-context.ts` | CRM context summarizer |
| `lib/ai/context.ts` | CRM business context loader |
| `lib/records/` | Stage engine |
| `lib/sample-data/` | CRM seed data |
| `app/api/records/` | Records API |
| `app/api/contacts/` | Contacts API |
| `lib/settings/portal-*.ts` | Portal config actions |
| `trigger/sdr-pipeline-analyst.ts` | CRM pipeline scoring task |
| DB: `records`, `stage_definitions`, `contacts`, `activities`, `intelligence_signals` | CRM tables |
| DB: portal tables | Portal auth/config |

### Keep (Core Engine)
| Path | Purpose |
|---|---|
| `lib/aspire/` | 285M prospect DB via Apify — ICP targeting, scoring, enrichment |
| `lib/prospect-scout/` | Lead discovery, dedup, rotation, queue |
| `lib/sdr/` | Sequence drafting, scheduling, sending, reply handling |
| `trigger/sdr-prospect-scout.ts` | Agent 01 — hourly discovery cron |
| `trigger/sdr-lead-profiler.ts` | Agent 02 — DISC-aware sequence generation |
| `trigger/sdr-outreach-scheduler.ts` | Agent 03 — daily send orchestrator |
| `trigger/sdr-outreach-enroll.ts` | Enroll lead into sequence |
| `trigger/sdr-engagement-update.ts` | Track engagement signals |
| `trigger/draft-on-enroll.ts` | Draft on enroll event |
| `trigger/aspire-weekly-search.ts` | Weekly Aspire search refresh |
| `lib/ai/client.ts` | Core LLM wrapper (claude-opus-4-8, adaptive thinking) |
| `lib/ai/tools/draft-message.ts` | Voice-matched message drafting |
| `lib/ai/tools/classify-intent.ts` | Reply classification |
| `lib/ai/tools/generate-signals.ts` | Repurposed: generate outreach signals per lead |
| `lib/ai/memory.ts` | Lead-level memory (repurposed from account-level) |
| `lib/webhooks/resend/` | Email open/click/bounce/reply tracking |
| `app/api/webhooks/resend/` | Resend webhook endpoint |
| `app/api/webhooks/sdr/reply/` | Reply classification webhook |
| `app/api/sdr/` | Agent config + sequence CRUD APIs |
| `app/api/aspire/` | Prospect search + enroll APIs |
| `app/api/extension/linkedin/` | LinkedIn Chrome extension API |
| `app/api/drafts/` | Draft approve/discard |
| `lib/stripe/` | Billing |
| `lib/supabase/` | DB client |
| Auth: `app/(auth)/` | Admin login/signup (portal auth routes removed) |

---

## New: Agent 04 — AI Cold Caller

### Trigger Task
```
trigger/ai-cold-caller.ts
```
- Scheduled: daily 10am per timezone window
- Picks leads where `phone IS NOT NULL` and last_contacted > 3 days
- Calls via Twilio Voice programmable calls
- maxDuration: 1800s (30min window per batch)

### New Library
```
lib/cold-caller/
  script-generator.ts   # Opus 4.8 generates call script from lead profile + ICP
  call-launcher.ts      # Twilio Voice API — initiates outbound call
  transcript-handler.ts # Deepgram/AssemblyAI transcription webhook
  outcome-classifier.ts # Opus 4.8 classifies call: answered/voicemail/no-answer/booked
  voicemail-drop.ts     # Pre-recorded voicemail MP3 drop
```

### New API Routes
```
app/api/cold-caller/
  launch/route.ts       # Trigger a call batch
  webhook/route.ts      # Twilio status callback + recording
  transcript/route.ts   # Transcription webhook
```

### New DB Tables
```sql
cold_call_sessions (
  id uuid,
  account_id uuid,
  lead_id uuid,
  script text,               -- AI-generated before dial
  call_sid text,             -- Twilio CallSid
  status text,               -- queued / initiated / answered / voicemail / no_answer / failed
  outcome text,              -- booked / interested / objection / wrong_person / do_not_call
  duration_seconds int,
  recording_url text,
  transcript text,
  ai_summary text,           -- Opus 4.8 post-call summary
  created_at timestamptz
)

call_scripts (
  id uuid,
  account_id uuid,
  lead_id uuid,
  script_body text,
  model_used text,
  generated_at timestamptz
)
```

---

## Restructured Admin UI

### Navigation (new)
```
/admin/dashboard          → Agent status overview (all 4 channels)
/admin/prospects          → Prospect pool: search, ICP config, preview 285M DB
/admin/agents/linkedin    → LinkedIn agent hub: queue, sequences, extension status
/admin/agents/email       → Email agent hub: sequences, deliverability, open/click
/admin/agents/sms         → SMS agent hub: Twilio status, reply rate
/admin/agents/cold-caller → Cold caller hub: call queue, outcomes, transcripts
/admin/campaigns          → Cross-channel campaign groups
/admin/analytics          → Funnel: sourced → contacted → replied → booked
/admin/settings           → Agent config, ICP, channels, billing
```

### Remove from Admin Nav
- CRM, Contacts, Records, Pipeline, Calendar, Deliverables, Forecasting, Reports, Portal, AI Brain

---

## Agent Architecture: How They Work Together

```
285M Prospect DB (Apify/Apollo)
        │
        ▼
[ Agent 01: Prospect Scout ]  ← cron hourly
  ICP score → dedup → queue
        │
        ▼
[ Agent 02: Lead Profiler ]   ← event: on new lead
  DISC profiling → memory write
  Opus 4.8 drafts 5-step sequence (email+SMS+LinkedIn)
        │
        ├──────────────────────────────────────────────────┐
        ▼                                                  │
[ Agent 03: Outreach Scheduler ] ← cron daily            │
  Email steps → Instantly/Resend                          │
  SMS steps → Twilio SMS                                  │
  LinkedIn steps → Chrome extension queue                 │
                                                          │
[ Agent 04: Cold Caller ]  ← cron daily ──────────────────┘
  Script generation (Opus 4.8)
  Twilio Voice dial
  Transcription → outcome classification
        │
        ▼
[ Reply Handler ]  ← webhook
  Classify intent (interested/objection/unsubscribe/booking)
  Route: interested → calendar link, booked → stop sequence
        │
        ▼
[ Analytics ] — per-channel funnel, A/B signal tracking
```

---

## AI Layer (Repurposed for Outreach)

All tools go through `lib/ai/client.ts` → `claude-opus-4-8` + adaptive thinking.

| Tool | Old Use | New Use |
|---|---|---|
| `draft-message.ts` | CRM reply drafting | Cold caller voicemail scripts, SMS templates |
| `classify-intent.ts` | Inbound triage | Reply classification (interested/objection/booking) |
| `generate-signals.ts` | Account intelligence | Lead-level engagement signals (who to call next) |
| `lib/sdr/draft-sequence.ts` | SDR sequences | All channel sequences (email + SMS + LinkedIn steps) |
| `lib/ai/memory.ts` | Account memory | Lead-level memory (what was sent, response patterns) |

**New AI tools to add:**
```
lib/ai/tools/
  generate-call-script.ts   # Outbound call script: opener, value prop, objection handlers, CTA
  classify-call-outcome.ts  # Post-call: booked / voicemail / interested / objection / DNC
  score-lead-engagement.ts  # Prioritize call queue by email/LinkedIn engagement signals
```

---

## Trigger.dev Task Map (Final)

| Task ID | Schedule | Agent | Description |
|---|---|---|---|
| `sdr-prospect-scout` | hourly | Scout | Pull from 285M DB per ICP |
| `sdr-lead-profiler` | on-event | Profiler | DISC profile + draft 5-step sequence |
| `sdr-outreach-enroll` | on-event | Scheduler | Enroll lead, schedule first touch |
| `sdr-outreach-scheduler` | daily 9am | Scheduler | Send all due email/SMS/LinkedIn steps |
| `sdr-engagement-update` | on-event | Analyst | Log opens, clicks, replies |
| `aspire-weekly-search` | weekly | Scout | Refresh Aspire saved searches |
| `draft-on-enroll` | on-event | Profiler | Draft sequence immediately on enroll |
| `ai-cold-caller` | daily 10am | Cold Caller | Dial lead batch, drop voicemails |
| `ai-cold-caller-transcript` | on-event | Cold Caller | Process recording → transcript → summary |

---

## DB Schema Delta

### Tables to drop
- `records`
- `stage_definitions`
- `contacts` (CRM contacts — distinct from `leads`)
- `activities` (CRM activity log)
- `intelligence_signals`
- `ai_memory` (account-level — repurpose or drop)
- Portal auth tables

### Tables to add
- `cold_call_sessions`
- `call_scripts`
- `agent_campaigns` (group leads into named campaigns per channel)

### Tables to keep (unchanged)
- `leads`, `lead_profiles`
- `outreach_sequences`, `sdr_sequence_steps`
- `outreach_campaign_steps`
- `reply_log`
- `aspire_searches`, `aspire_results`
- `sdr_agent_configs`
- `ai_observations` (repurposed: log all agent calls)
- `accounts`, `users`
- Stripe billing tables

---

## Implementation Order

1. **Remove CRM/Portal** — delete files/routes, drop DB tables, simplify middleware
2. **Restructure admin nav** — new 4-channel agent dashboard
3. **AI Cold Caller** — new trigger task + lib + DB tables
4. **Unified analytics** — cross-channel funnel view
5. **New AI tools** — `generate-call-script`, `classify-call-outcome`, `score-lead-engagement`
6. **Prospect pool UI** — browse/filter 285M DB with ICP preview before launching agents
