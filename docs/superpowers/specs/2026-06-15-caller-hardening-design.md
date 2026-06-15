# Caller (Retell) production hardening — design spec

**Date:** 2026-06-15
**Status:** Scope approved; ready for implementation plan
**Branch:** `phase-caller-harden` (off `main`)
**Related rules:** 08 (caller behavior), 11 (compliance/suppression/recording), 13 (agent framework)

## Decision
The AI caller (Retell behind `voice-infra`) is built and tested end-to-end (Phase 10). This sub-project hardens it so the **only** manual step to go live is the caller phone number (`VOICE_FROM_NUMBER`) + `VOICE_API_KEY`. It does NOT rebuild anything.

## What already exists (do NOT rebuild)
- `RetellVoiceInfra`: `placeCall`, signed webhook verify (`x-retell-signature` `v={ts},d={digest}`, HMAC-SHA256, 5-min replay window, timing-safe), shared event parser.
- `call-brief`: drafts briefs into the review queue (`scheduled_sends.channel='call'`, `pending_review`), with a **phone-validity gate** (skips leads unless `phoneStatus='valid'` and `phone` present) + suppression check.
- `call-dispatch`: kill switch → per-lead attempt cap → **prospect-local calling window (TCPA)** → claim → phone suppression re-check → `placeCall` → record (`calls` row).
- `voice-inbound`: webhook dedup → outcome classification (provider fast-path `mapProviderDisposition`, else transcript brain) → `calls` update → **suppression on `not_interested`/`do_not_call`** (rule 11).
- `0014`: `calls` table (RLS, service-role writes only), phone suppression kind, `call` channel, `voice` webhook source.

## The hardening items (scope: 1, 2, 5)

### 1. Missing caller number → graceful, surfaced skip (the "phone number is the only manual step" guarantee)
**Gap:** the trigger wires `fromNumber: process.env.VOICE_FROM_NUMBER ?? ""`. With the env unset, `runCallDispatch` would proceed, `claimSending` each approved brief, then `placeCall` fails at the provider — leaving sends claimed/stuck and burning nothing useful.
**Fix:** at the top of `runCallDispatch` (right after the kill-switch guard), if `deps.fromNumber.trim()` is empty, return early `[{ sendId: "*", outcome: "no_caller_number" }]` — **no briefs claimed**. The trigger wrapper logs this at `warn`/`error` level (operator-facing surface: `VOICE_FROM_NUMBER` is a single platform env, not per-account).

### 2. `placeCall` failure handling (no stuck sends)
**Gap:** in `dispatchOne`, a `placeCall`/`insertCall` throw after `claimSending` leaves the send in `sending` forever.
**Fix:** wrap the `placeCall` → `insertCall` → `markSendSent` block in try/catch; on error call `deps.store.revertToApproved(call.id)` (the existing primitive) so the brief returns to the approved queue and retries next tick, and return outcome `"failed"`. Transient provider errors self-heal; persistent ones surface as repeated `failed` results in logs.

### 5. Live-smoke plan + env note
Documented below; `.env.example` already lists `VOICE_FROM_NUMBER` — add a one-line note that it is the only manual step for the caller.

### Reviewed, intentionally unchanged
- **Recording-consent default (item 3):** per the owner's decision, the caller continues to announce recording **only** when the account explicitly sets `recording_consent_mode='two_party'`; an unset mode does NOT auto-announce. Left as-is by choice.
- **Min-gap between attempts (item 4):** out of scope this pass; the per-lead attempt cap + calling window + 5-min cron cadence bound frequency.

## New outcomes
`CallDispatchOutcome` gains `"no_caller_number"` and `"failed"`.

## Live smoke plan (needs `VOICE_API_KEY` + `VOICE_FROM_NUMBER`; not CI)
1. Unset `VOICE_FROM_NUMBER` → run `call-dispatch` → result is a single `no_caller_number`, no `calls` rows, no claimed sends, a loud log line.
2. Set the number → approve one brief → one dial places; `calls` row created; `placeCall` failure (simulate) reverts the send to approved.
3. Webhook: valid `x-retell-signature` → 200 and the call row updates; forged/expired → 401.
4. `call_ended` with `do_not_call` → phone written to suppression; a second brief to that number is suppressed before dialing.

## Definition of done (rules 08/11/12)
Full gate green; new `call-dispatch` tests (missing-number guard claims nothing; `placeCall` failure reverts + returns `failed`); suppression path untouched and green; `whitelabel-auditor` (no "Retell" on user surfaces); `.env.example` note. No schema change.

## Out of scope
Per-account caller numbers; min-gap frequency cap; recording-default change; iMessage; the remaining production-ops checklist.
