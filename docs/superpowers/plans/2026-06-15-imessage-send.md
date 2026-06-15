# iMessage (LoopMessage) Send Path — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** Make drafted `imessage` touches actually send via LoopMessage with replies flowing back, so the only manual step is a LoopMessage subscription + sender + creds.

**Architecture:** Real adapter behind the existing `MessageInfra` (API shapes flagged for activation), an `imessage` branch in `outreach-send`/`send-dispatch`/`process-inbound`, a new inbound route, and a `webhook_events` source migration. Mirrors the email/linkedin send paths.

**Spec:** `docs/superpowers/specs/2026-06-15-imessage-send-design.md`. **Branch:** `phase-imessage-send` (off `main`).

> **Migration note:** the new migration is `0021_imessage_webhook_source.sql` (gapless-numbering guard). It collides with the `0021` on `phase-maildoso-email` and `phase-linkedin-harden`; whichever merges second renumbers.

---

## File Structure
- `packages/imessage-infra/src/loopmessage.ts` (+ `.test.ts`) — real adapter + factory.
- `packages/db/migrations/0021_imessage_webhook_source.sql`; `packages/db/src/schema.test.ts` — source guardrail.
- `packages/jobs/src/pipeline/types.ts` — `OutreachSendDeps` (+`messageInfra`,`imessageSender`), `SendContext.lead.phone`, `InboundDeps.messageInfra`, `SendDispatchStore.countImessageSentToday`.
- `packages/jobs/src/pipeline/outreach-send.ts` (+ `.test.ts`) — imessage send branch.
- `packages/jobs/src/pipeline/pg-store.ts` — `getSendContext` selects phone; `countImessageSentToday`.
- `packages/jobs/src/pipeline/safety-limits.ts` — `IMESSAGE_STEADY_DAILY`.
- `packages/jobs/src/pipeline/send-dispatch.ts` (+ `.test.ts`) — imessage pacing/cap.
- `packages/jobs/src/pipeline/inbound.ts` (+ `.test.ts`) — imessage source branch.
- `packages/jobs/src/trigger/outreach-send.ts`, `trigger/process-inbound.ts` — wire `messageInfra`/`imessageSender`.
- `apps/web/src/app/api/webhooks/imessage/route.ts` — inbound route.
- `.env.example` — IMESSAGE_* vars.

---

## Task 1: Real LoopMessage adapter
**Files:** `packages/imessage-infra/src/loopmessage.ts` (+ `.test.ts`)

- [ ] **Step 1: Write tests** (`loopmessage.test.ts`) — inject a fake `fetch`; assert send posts auth headers + body shape and returns `{providerMessageId, sentAt}`; `verifyWebhook` timing-safe (matching secret true, wrong false, missing false); `parseEventWebhook` maps a LoopMessage inbound payload → `{type:"reply", fromPhone, body}` and a status payload → `{type:"delivery", delivered}`.

- [ ] **Step 2: Run → fail.** `pnpm --filter @vantera/imessage-infra test`

- [ ] **Step 3: Implement** — replace the stub class. Endpoint/header/field names carry `// CONFIRM ON ACTIVATION`:

```ts
import { timingSafeEqual } from "node:crypto";
import type { MessageEvent, MessageHandle, MessageInfra, SendMessageRequest } from "./types";
import { InMemoryMessageInfra } from "./in-memory";

const SEND_URL = "https://server.loopmessage.com/api/v1/message/send/"; // CONFIRM ON ACTIVATION

export interface LoopMessageConfig {
  authKey: string;
  secretKey: string;
  webhookSecret: string;
  fetchImpl?: typeof fetch;
}

export class LoopMessageInfra implements MessageInfra {
  private readonly fetchImpl: typeof fetch;
  constructor(private readonly cfg: LoopMessageConfig) { this.fetchImpl = cfg.fetchImpl ?? fetch; }

  async sendMessage(req: SendMessageRequest): Promise<MessageHandle> {
    const res = await this.fetchImpl(SEND_URL, {
      method: "POST",
      headers: { Authorization: this.cfg.authKey, "Loop-Secret-Key": this.cfg.secretKey, "Content-Type": "application/json" }, // CONFIRM
      body: JSON.stringify({ recipient: req.toPhone, text: req.body, sender_name: req.fromIdentity, passthrough: req.sendRef }), // CONFIRM fields
    });
    if (!res.ok) throw new Error(`imessage provider send failed: ${res.status}`);
    const json = (await res.json()) as { message_id?: string };
    return { providerMessageId: String(json.message_id ?? ""), sentAt: new Date().toISOString() };
  }

  verifyWebhook(headers: Record<string, string>, _rawBody: string): boolean {
    const presented = headers["authorization"] ?? headers["x-loop-secret"]; // CONFIRM header on callback
    if (!presented) return false;
    const a = Buffer.from(presented);
    const b = Buffer.from(this.cfg.webhookSecret);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  // Delegate the vendor-neutral mapping to the shared reference parser, then adapt the
  // LoopMessage field names here as confirmed on activation.
  parseEventWebhook(payload: unknown): MessageEvent | null {
    if (typeof payload !== "object" || payload === null) return null;
    const p = payload as Record<string, unknown>;
    const t = p.alert_type ?? p.event_type; // CONFIRM: LoopMessage uses alert_type (e.g. message_inbound / message_sent)
    if (t === "message_inbound" || t === "reply") {
      if (typeof p.text !== "string" && typeof p.body !== "string") return null;
      if (typeof p.recipient !== "string" && typeof p.from !== "string") return null;
      return { type: "reply", providerMessageId: typeof p.message_id === "string" ? p.message_id : null,
        fromPhone: String(p.recipient ?? p.from), body: String(p.text ?? p.body),
        receivedAt: typeof p.received_at === "string" ? p.received_at : new Date().toISOString() };
    }
    if (t === "message_sent" || t === "delivery") {
      if (typeof p.message_id !== "string") return null;
      return { type: "delivery", providerMessageId: p.message_id, sendRef: typeof p.passthrough === "string" ? p.passthrough : null,
        delivered: p.success === true || p.delivered === true };
    }
    return null;
  }
}

export function createMessageInfraFromEnv(env: Record<string, string | undefined> = process.env): MessageInfra {
  if (env.IMESSAGE_PROVIDER === "loopmessage") {
    return new LoopMessageInfra({
      authKey: env.IMESSAGE_AUTH_KEY ?? "", secretKey: env.IMESSAGE_SECRET_KEY ?? "",
      webhookSecret: env.IMESSAGE_WEBHOOK_SECRET ?? "",
    });
  }
  return new InMemoryMessageInfra(env.IMESSAGE_WEBHOOK_SECRET ?? "in-memory-secret");
}
```

- [ ] **Step 4: Run → pass.** Commit: `feat(imessage-infra): real LoopMessage adapter (endpoints flagged)`

---

## Task 2: Migration 0021 — webhook_events source += imessage
**Files:** `packages/db/migrations/0021_imessage_webhook_source.sql`, `schema.test.ts`

- [ ] **Step 1: Migration:**

```sql
-- imessage joins the webhook source set (dedup parity with email/linkedin/voice, 0014).
alter table public.webhook_events drop constraint if exists webhook_events_source_check;
alter table public.webhook_events add constraint webhook_events_source_check
  check (source in ('email', 'linkedin', 'stripe', 'voice', 'imessage'));
```

- [ ] **Step 2: Guardrail test** (mirror the `0019` block):

```ts
describe("imessage webhook source (0021)", () => {
  it("0021 adds imessage to the webhook source set", () => {
    const sql = readFileSync(join(migrationsDir, "0021_imessage_webhook_source.sql"), "utf8");
    expect(sql).toMatch(/source in \('email', 'linkedin', 'stripe', 'voice', 'imessage'\)/i);
  });
});
```

- [ ] **Step 3: `pnpm --filter @vantera/db test` → green** (incl. the gapless-numbering guard). Commit: `feat(db): 0021 imessage webhook source`

---

## Task 3: SendContext.phone + getSendContext
**Files:** `packages/jobs/src/pipeline/types.ts`, `pg-store.ts`

- [ ] **Step 1:** add `phone: string | null` to `SendContext.lead`'s type (next to `email`, `linkedinUrl`).
- [ ] **Step 2:** in `getSendContext` (`pg-store.ts`), add `leadPhone: leads.phone` to the select and `phone: r.leadPhone` to the returned `lead`.
- [ ] **Step 3:** `pnpm --filter @vantera/jobs type-check` → clean. Commit: `feat(jobs): expose lead phone on the send context`

---

## Task 4: outreach-send imessage branch
**Files:** `packages/jobs/src/pipeline/types.ts`, `outreach-send.ts`, `outreach-send.test.ts`

- [ ] **Step 1:** extend `OutreachSendDeps` with `messageInfra: MessageInfra` (import from `@vantera/imessage-infra`) and `imessageSender: string`.
- [ ] **Step 2: Write failing tests** (`outreach-send.test.ts`, reuse the existing fake-store + InMemory infras): (a) an `imessage` send to a lead with a phone calls `messageInfra.sendMessage` with `toPhone`/`fromIdentity` and records `channel:"imessage"` + `markSent`; (b) a **suppressed phone** → `markSuppressed`, no send (suppression-at-boundary, rule 11); (c) blank `imessageSender` → `revertToApproved` + `parked`.
- [ ] **Step 3: Run → fail.**
- [ ] **Step 4: Implement** in `outreach-send.ts`:
  - `target`: add `: ctx.channel === "imessage" ? (ctx.lead.phone ? normalizePhone(ctx.lead.phone) : null)` to the chain (import `normalizePhone` from `./call-brief`).
  - Suppression: ensure `isSuppressed` for `imessage` looks up kind `phone`. READ how `isSuppressed(accountId, channel, value)` maps channel→kind; if it doesn't map `imessage`→`phone`, pass the mapped kind (the suppression store uses `phone` for imessage — see `sequence-touch`'s `SUPPRESSION_KIND` map).
  - Provider branch: add `else if (ctx.channel === "imessage")`: if `!deps.imessageSender.trim()` → `revertToApproved` + return `parked`; else `const r = await deps.messageInfra.sendMessage({ fromIdentity: deps.imessageSender, toPhone: target, body: ctx.body ?? "", sendRef: ctx.id });` → `providerResult = { channel: "imessage", messageRef: r.providerMessageId }`.
  - `providerResult` union: add `| { channel: "imessage"; messageRef: string }`.
  - Bookkeeping: add an `imessage` arm → `recordOutreachSend({ …, channel: "imessage", messageRef: providerResult.messageRef })` + `markSent`.
- [ ] **Step 5: Run → pass** (existing email/linkedin/suppression tests stay green). Commit: `feat(jobs): send imessage touches via the message provider`

---

## Task 5: send-dispatch pacing + daily cap
**Files:** `packages/jobs/src/pipeline/safety-limits.ts`, `types.ts`, `pg-store.ts`, `send-dispatch.ts`, `send-dispatch.test.ts`

- [ ] **Step 1:** add `export const IMESSAGE_STEADY_DAILY = 40;` to `safety-limits.ts` (conservative; non-configurable, rule 04 spirit).
- [ ] **Step 2:** add `countImessageSentToday(accountId, dayStart): Promise<number>` to the dispatch store interface + a `pg-store.ts` impl (mirror `countLinkedInSentToday`, channel `imessage`, no stage filter).
- [ ] **Step 3: Write failing test** — imessage rows dispatch up to `IMESSAGE_STEADY_DAILY`, clamped by `countImessageSentToday`, paced with `paceWithJitter`.
- [ ] **Step 4: Implement** the `imessage` branch in `runSendDispatch` mirroring the linkedin branch: `let budget = IMESSAGE_STEADY_DAILY - (await deps.store.countImessageSentToday(accountId, dayStart));` then dispatch the account's imessage rows while `budget-- > 0`, scheduling via the existing pacing. (READ the email/linkedin branches and follow their exact claim/schedule shape.)
- [ ] **Step 5: Run → pass.** Commit: `feat(jobs): pace + daily-cap imessage dispatch`

---

## Task 6: process-inbound imessage branch
**Files:** `packages/jobs/src/pipeline/types.ts`, `inbound.ts`, `inbound.test.ts`

- [ ] **Step 1:** add `messageInfra: Pick<MessageInfra, "parseEventWebhook">` to `InboundDeps`.
- [ ] **Step 2: Write failing tests** — `source:"imessage"` reply that classifies not-interested writes phone suppression + matches the lead by phone; a delivery event is a no-op `handled:true`.
- [ ] **Step 3: Implement** in `runInbound`, BEFORE the linkedin fallthrough: `if (payload.source === "imessage") { const event = deps.messageInfra.parseEventWebhook(payload.payload); … reply → findLeadByPhone + classify + addSuppression(account,"phone",normalizePhone(fromPhone),…); delivery → return {handled:true,action:"delivery"}; }`. READ the email reply arm for the exact classify/suppress calls + the lead-lookup store method (add `findLeadByPhone` if none exists, mirroring `findLeadByLinkedInUrl`).
- [ ] **Step 4: Run → pass.** Commit: `feat(jobs): handle inbound imessage replies + delivery`

---

## Task 7: Trigger wiring
**Files:** `packages/jobs/src/trigger/outreach-send.ts`, `trigger/process-inbound.ts`

- [ ] **Step 1:** in `trigger/outreach-send.ts` add `messageInfra: createMessageInfraFromEnv()` and `imessageSender: process.env.IMESSAGE_SENDER ?? ""` to the deps.
- [ ] **Step 2:** in `trigger/process-inbound.ts` add `messageInfra: createMessageInfraFromEnv()` to the deps.
- [ ] **Step 3:** `pnpm --filter @vantera/jobs test` (incl. `structure.test.ts`) + `type-check` → green. Commit: `feat(jobs): wire message provider into the send + inbound tasks`

---

## Task 8: Inbound webhook route
**Files:** `apps/web/src/app/api/webhooks/imessage/route.ts`

- [ ] **Step 1:** mirror `api/webhooks/linkedin/route.ts` exactly, swapping `createLinkedInInfraFromEnv` → `createMessageInfraFromEnv` (from `@vantera/imessage-infra`) and `"linkedin"` → `"imessage"` in `handleInboundWebhook`. `pnpm --filter web type-check` → clean. Commit: `feat(web): inbound imessage webhook route`

---

## Task 9: Env + full gate
**Files:** `.env.example`

- [ ] **Step 1:** add under a new iMessage section:
```bash
# iMessage (imessage-infra). IMESSAGE_PROVIDER=loopmessage to go live; default is the in-memory fake.
IMESSAGE_PROVIDER=
IMESSAGE_AUTH_KEY=
IMESSAGE_SECRET_KEY=
# Shared secret for inbound webhook verification (echoed auth header)
IMESSAGE_WEBHOOK_SECRET=
# Vantera-owned iMessage sender handle/number — the manual step alongside the subscription
IMESSAGE_SENDER=
```
- [ ] **Step 2:** `pnpm lint && pnpm type-check && pnpm test && pnpm build` → green.
- [ ] **Step 3:** `whitelabel-auditor` (no "LoopMessage" on user surfaces); confirm imessage suppression test green. Commit `docs: imessage env manifest`, push branch, report PR.

## Activation checklist (needs creds; not code)
1. Subscribe to LoopMessage; set `IMESSAGE_PROVIDER=loopmessage`, `IMESSAGE_AUTH_KEY`, `IMESSAGE_SECRET_KEY`, `IMESSAGE_WEBHOOK_SECRET`, `IMESSAGE_SENDER` (Vercel + Trigger).
2. Confirm the send endpoint + webhook `alert_type`/auth-header shapes against LoopMessage docs (the `CONFIRM ON ACTIVATION` items in `loopmessage.ts`).
3. Register the LoopMessage webhook at `/api/webhooks/imessage`. 4. `trigger deploy`. 5. Live smoke per the spec.

## Self-Review
Spec coverage: adapter (T1), source migration (T2), context phone (T3), send branch + suppression (T4), pacing/cap (T5), inbound (T6), wiring (T7), route (T8), env+gate (T9). Types: `messageInfra`/`imessageSender` consistent across `OutreachSendDeps`/`InboundDeps`/triggers; `providerResult` imessage variant used only in T4. Placeholders: only the `CONFIRM ON ACTIVATION` LoopMessage shapes (isolated to `loopmessage.ts`) + implementer-mapped store/test helper names.
