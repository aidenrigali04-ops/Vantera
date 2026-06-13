# AI Caller Agent — design

**Date:** 2026-06-13
**Status:** Approved (brainstorming)
**Kind:** `caller` — third user-facing SDR agent, peer to Scout (`scout`) and Outreach (`copy`).

Built strictly on the locked six-piece SDR skeleton (rule 13) and the post-qualification Outreach model (rule 08). No bespoke architecture.

## Decisions locked in brainstorming

- **Voice execution:** Retell AI, behind a new swappable `voice-infra` package (vendor name never leaves the package — rules 03–05).
- **Review unit:** per-lead **call brief**, carried as a `scheduled_sends` row (`channel = 'call'`, `status = 'pending_review'`) — identical review parity to email/LinkedIn drafts.
- **Call goal:** book a meeting. The AI qualifies briefly, then captures intent and sends the account's `booking_link`; outcome is classified. Warm-transfer deferred.
- **Caller ID (v1):** single shared `VOICE_FROM_NUMBER` from env. Per-account provisioned numbers are a later enhancement.
- **Booking mechanism (v1):** link-based (AI sends `booking_link` via follow-up + marks `booked`), not live warm-transfer.

## How it fits the pipeline

Requires a deployed Scout; inherits its ICPs read-only. Operates on **qualified leads** (`ai_score ≥ min_score`) that additionally have `phone_status = 'valid'`. Reuses the existing review queue (`scheduled_sends`), scheduler, and send boundary, so suppression is enforced at the same chokepoints as the other channels. The pipeline stops at `pending_review` until a human approves each brief.

## 1. DB identity (migration `0013_caller_agent.sql`)

- Extend `agents.kind` check to add `'caller'`. Document the caller `config` shape in the migration comment (below). No new per-agent columns.
- Extend `suppression_entries.kind` check to add `'phone'` (value = E.164, lowercased to satisfy the existing `value = lower(value)` constraint — digits/`+` are unaffected). **Phone is now part of the master suppression gate.**
- Extend `scheduled_sends.channel` check to add `'call'`. Add `brief jsonb` to carry the structured brief; the human-readable brief also renders in existing `body`.
- New table `calls` (execution + audit, one row per dial attempt):
  - `id, account_id, lead_id, agent_id, campaign_id, scheduled_send_id, provider_call_id`
  - `attempt_no smallint`, `status` (`queued | dialing | in_progress | completed | no_answer | voicemail | failed`)
  - `outcome` (`booked | callback | not_interested | no_answer | voicemail | do_not_call`, nullable until classified)
  - `duration_sec int, recording_url text, transcript text, started_at, ended_at, created_at, updated_at`
  - Composite FKs to lead/agent/campaign within the same account; RLS in the same migration (member select, admin manage; webhook writes via service role).
  - `retention(calls)`: rows cascade with the lead; terminal rows purged by the existing 180-day sweep (rule 11).
- Extend `webhook_events.source` check to add `'voice'` (idempotency parity).

### `agents.config` (caller)
```jsonc
{
  "cta": "free text — what the call should achieve",
  "booking_link": "https://cal.com/... — the booking target",
  "voice": { "voice_id": "<provider voice>", "persona_name": "Alex", "language": "en-US" },
  "recording_consent_mode": "two_party" | "one_party",
  "calling_window": { "days": ["mon","tue","wed","thu","fri"], "start_local": "09:00", "end_local": "17:00" },
  "max_attempts": 3
}
```

## 2. Setup wizard

Pages: `apps/web/src/app/(app)/agents/new/caller/page.tsx` (server) + `agents/caller-wizard.tsx` (client), composing `components/wizard/wizard-shell.tsx`. Edit page at `agents/caller/edit/page.tsx`. Card added to `/agents`.

Steps (collect only identity, goal, or context — strategy/pacing lives in the brain/compliance layer):

```
Name Your Agent → ICP (read-only, inherited) → Goal & Booking → Voice & Identity → Add Content (skip) → Calling Window → Finish → Deploy
```

- **ICP** — read-only confirmation, inherited from the deployed Scout.
- **Goal & Booking** — `cta` free text (example chips) + `booking_link`. The one input only the user knows.
- **Voice & Identity** — `persona_name`, `voice_id` pick, `language`. Caller ID is the shared env number in v1.
- **Add Content** — optional, skippable; reuses the `agent-assets` bucket for objection-handling context.
- **Calling Window** — compliance-bounded like LinkedIn safety limits. User picks days + start/end **within hard TCPA bounds** (never outside 08:00–21:00 prospect-local). Evaluated in the **prospect's** timezone. `max_attempts` selectable up to a safe ceiling.
- **Deploy** — flips status to `live`, auto-creates the internal campaign (`send_mode: 'review'`). Deploy summary states: briefs draft as leads qualify, every call waits in review.

One agent per kind per account (existing unique constraint).

## 3. Server actions + validation

`apps/web/src/app/(app)/agents/actions.ts` + `validation.ts`. Validation = pure functions with colocated tests (E.164 / booking URL / calling-window bounds / TCPA clamp). Account resolved from session via RLS-scoped select — actions never accept an `accountId`.

## 4. Brain — `packages/agent-brains/src/caller/`

Pure modules, model injected, structured output via colocated zod schemas. No Trigger/drizzle/DB (purity test).

- `brief.ts` → `draftCallBrief(input, model)`: from `ai_insights` (pain_points, triggers, value_angle, aha_moment, summary) + `cta` + content → structured brief: `opening_line`, `talking_points[]`, `objection_handling[]`, `goal_statement`, and a **recorded-line disclosure** prepended when `recording_consent_mode = 'two_party'`. Humanizer-style linter keeps the opening human; unresolved flags surface in the review queue via `style_flags` (same convention as copy).
- `classify.ts` → `classifyOutcome(transcript, model)`: maps a completed-call transcript to the canonical outcome enum. `not_interested` and `do_not_call` both drive suppression.

Split by stage if either file outgrows ~200 lines.

## 5. Pipeline — core (pure, deps injected) + thin trigger wrappers

- `pipeline/call-brief.ts` (+ `trigger/call-brief.ts`): qualified leads with `phone_status = 'valid'` → suppression check (incl. phone) → `draftCallBrief` → insert `scheduled_sends` (`channel='call'`, `pending_review`).
- `pipeline/call-dispatch.ts` (+ trigger): at the send boundary, for `approved` call rows inside the prospect-local calling window and under `max_attempts` → **re-check suppression** → `voiceInfra.placeCall` → insert `calls` row (`status='dialing'`). This is the rule-11 send-boundary re-check.
- `pipeline/inbound.ts` extended for `VoiceEvent` (+ `trigger/process-voice-webhook.ts`): dedupe via `webhook_events` (`source='voice'`) → update the `calls` row → `classifyOutcome` → write outcome → on `not_interested`/`do_not_call`, write phone to `suppression_entries`. `no_answer`/`voicemail` reschedules the next attempt within the window until `max_attempts`.

Store methods (drizzle) only in `pg-store.ts`; interfaces in `types.ts`. Task id = file name; wrappers only wire real deps + log.

## 6. External service — `packages/voice-infra`

`types.ts` interface + `in-memory.ts` fake + `retell.ts` adapter.

```ts
interface VoiceInfra {
  placeCall(req: PlaceCallRequest): Promise<CallHandle>;     // from number, lead context, brief, voice, recording-consent flag
  verifyWebhook(headers, rawBody): boolean;                   // timing-safe (crypto.timingSafeEqual)
  parseEventWebhook(payload): VoiceEvent | null;
}
type VoiceEvent =
  | { type: "call_started"; providerCallId: string }
  | { type: "call_ended"; providerCallId: string; rawDisposition: string; durationSec: number; recordingUrl: string | null; transcript: string | null };
```

All `@ai-sdk/*` usage stays in `packages/ai` (single-entry test) — the brain calls `getModel()`. The voice provider is not an AI-SDK provider, so no conflict.

New env (white-label naming, added to `.env.example`): `VOICE_API_KEY`, `VOICE_WEBHOOK_SECRET`, `VOICE_FROM_NUMBER`.

## 7. Compliance (rule 11 — built in)

- Suppression checked before drafting **and** before dialing; phone added as a suppression kind.
- TCPA calling hours enforced in **prospect-local** time, non-configurable below safe bounds.
- Recorded-line disclosure injected into the opening for two-party-consent regions.
- Every call lands in `calls` as the audit trail.
- Deletion path: account/lead deletion cascades `calls` and fires a provider-side deletion call (rule 11).
- **DoD test:** a phone-suppressed lead is never dialed (guarded in `call-dispatch.test.ts` / `call-brief.test.ts`).

## 8. Help article

`packages/help-content/content/agents-caller.md` ships in the same PR (knowledge-sync, rule 09). No vendor names (whitelabel-auditor pass).

## Out of scope (v1)

- Per-account provisioned caller numbers.
- Live warm-transfer to a human.
- Inbound calls / callback IVR.
- SMS as an independent channel (the booking-link follow-up reuses the existing channel send, not a new SMS agent).

## Checklist (rule 13 — adding a new agent kind)

1. Migration: extend `agents.kind`, `suppression_entries.kind`, `scheduled_sends.channel`, `webhook_events.source`; new `calls` table + RLS; document `config` shape; rls-auditor pass.
2. Brain modules + zod schemas in `agent-brains/src/caller/` (tests first, mock model).
3. `voice-infra` package: interface + in-memory fake + Retell adapter.
4. Pipeline cores + store methods + thin trigger tasks (suppression tests).
5. Wizard pages + actions + validation tests; card on `/agents`.
6. Help article; whitelabel-auditor pass; roadmap + rule 08 updated.
