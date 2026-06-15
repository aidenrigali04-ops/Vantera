# iMessage (LoopMessage) send path — design spec

**Date:** 2026-06-15
**Status:** Scope approved; ready for implementation plan
**Branch:** `phase-imessage-send` (off `main`)
**Related rules:** 03–05 (channel infra, white-label), 08 (sequence), 11 (suppression/compliance), 13 (agent framework)

## Decision
Build the **iMessage send path** so the drafted `imessage` sequence touches actually send via **LoopMessage**, with replies flowing back. The interface (`MessageInfra`), in-memory fake, DB channel support (`0017`), and drafting (`sequence-touch`) already exist; the adapter is a stub and there is no send/inbound wiring. After merge the only manual step is a LoopMessage subscription + sender handle + creds. (4th channel = iMessage via LoopMessage; blue-bubble iMessage with SMS fallback handled by the provider.)

## What already exists (do NOT rebuild)
- `MessageInfra` interface (`sendMessage`/`verifyWebhook`/`parseEventWebhook`) + `InMemoryMessageInfra` fake (defines the `reply`/`delivery` event shapes).
- `0017`: `'imessage'` in `scheduled_sends.channel`, `campaigns.channels`, sequence `current_stage`.
- `sequence-touch` drafts `imessage` touches (short-form drafter; suppression kind = `phone`).
- Shared send/inbound machinery: `send-dispatch` (claims + paces + caps), `outreach-send` (one send), `process-inbound` (`runInbound`, source-routed), `handleInboundWebhook` helper, `webhook_events` dedup.

## The build (full send path: 1–5)

### 1. Real LoopMessage adapter (`packages/imessage-infra/src/loopmessage.ts`)
Replace the stub `LoopMessageInfra` with a real implementation behind `MessageInfra`, exact API shapes **isolated + `// CONFIRM ON ACTIVATION`** (Maildoso pattern), injectable `fetch`:
- `sendMessage(req)` → `POST https://server.loopmessage.com/api/v1/message/send/` with `Authorization: <authKey>` + `Loop-Secret-Key: <secretKey>` + `Content-Type: application/json`, body `{ recipient: req.toPhone, text: req.body, sender_name: req.fromIdentity }` (+ `req.sendRef` as passthrough/`message_id` metadata if supported). Returns `{ providerMessageId, sentAt }`.
- `verifyWebhook(headers, rawBody)` → LoopMessage echoes a custom auth header on callbacks; timing-safe compare against the configured webhook secret. Missing → false.
- `parseEventWebhook` → map LoopMessage inbound/status events to the existing `MessageEvent` union (`reply` / `delivery`), mirroring the in-memory fake's field names.
- Factory `createMessageInfraFromEnv`: `IMESSAGE_PROVIDER=loopmessage` → `LoopMessageInfra({ authKey, secretKey, webhookSecret, fetchImpl })`; default stays `InMemoryMessageInfra`.

### 2. Wire iMessage into `outreach-send`
- Add `messageInfra: MessageInfra` and `imessageSender: string` to `OutreachSendDeps`.
- Extend `SendContext.lead` with `phone` (and `getSendContext` selects `leads.phone`).
- `target`: `ctx.channel === "imessage"` → `normalizePhone(ctx.lead.phone)` (null → `markFailed("missing contact info")`).
- Suppression check uses `ctx.channel` → kind `phone` (suppression stores imessage under `phone`; align the `isSuppressed(channel)` mapping so `imessage` looks up `phone`).
- Provider call branch: `messageInfra.sendMessage({ fromIdentity: deps.imessageSender, toPhone: target, body: ctx.body ?? "", sendRef: ctx.id })`; guard a missing `imessageSender` → `revertToApproved` + `parked` (graceful, mirrors the caller's missing-number fix).
- `providerResult` union gains an `imessage` variant; bookkeeping records `recordOutreachSend({ channel: "imessage", messageRef })` + `markSent`.
- Trigger `outreach-send.ts` wires `messageInfra: createMessageInfraFromEnv()` + `imessageSender: process.env.IMESSAGE_SENDER ?? ""`.

### 3. `send-dispatch` pacing + daily cap
Include `imessage` rows in dispatch (don't drop them). Add `IMESSAGE_STEADY_DAILY` to `safety-limits` + `countImessageSentToday(accountId, dayStart)` store method; clamp imessage dispatch by the daily cap and the existing `paceWithJitter`. Mirror the email/linkedin branch in `runSendDispatch`.

### 4. Inbound (`process-inbound` + route)
- `runInbound`: add `if (payload.source === "imessage")` branch BEFORE the linkedin fallthrough → `messageInfra.parseEventWebhook` → `reply`: match lead by phone, classify (reply brain), suppress phone on not-interested/unsubscribe (rule 11); `delivery`: best-effort mark (no-op acceptable v1). Add `messageInfra` to `InboundDeps`; trigger wires it.
- New route `apps/web/src/app/api/webhooks/imessage/route.ts` mirroring the linkedin route: `createMessageInfraFromEnv()` → `handleInboundWebhook("imessage", …)` → enqueue `process-inbound`.
- Migration `0021_imessage_webhook_source.sql`: `webhook_events` source check `+= 'imessage'` (dedup parity). Numbered `0021` (gapless guard); collides with the Maildoso/LinkedIn `0021` — second-merged renumbers.

### 5. Env + smoke plan
`.env.example`: `IMESSAGE_PROVIDER`, `IMESSAGE_AUTH_KEY`, `IMESSAGE_SECRET_KEY`, `IMESSAGE_WEBHOOK_SECRET`, `IMESSAGE_SENDER`.

## Live smoke plan (needs creds + sender; not CI)
Approve an imessage touch → one message sends via LoopMessage; inbound reply webhook (valid auth header → 200, forged → 401) matches the lead and a "not interested" reply writes the phone to suppression; a suppressed phone is never re-sent; missing `IMESSAGE_SENDER` → graceful `parked`, not a hard failure.

## Definition of done (rules 03–05/11/12)
Full gate green; new adapter + outreach-send + inbound + dispatch tests; **suppression-at-boundary test for imessage**; `0021` guardrail; `whitelabel-auditor` (no "LoopMessage" on user surfaces); env manifest. The exact LoopMessage paths/signature are the only `CONFIRM ON ACTIVATION` items, isolated to the adapter.

## Out of scope
True carrier SMS (A2P/Twilio); delivery-status UI; per-account sender pools; the remaining ops checklist.
