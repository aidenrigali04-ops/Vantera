# Phase 5 — Live channel adapters (design)

Approved 2026-06-11. Real sends through real providers, replies flowing back in. The
Phase 3/4 pipeline stops at `scheduled_sends.status = 'pending_review'`; this phase
carries approved drafts across the send boundary and closes the loop with replies,
unsubscribes, and compliance reactions. Key rules: 03 (email infra), 04 (LinkedIn
safety limits), 11 (suppression, unsubscribe, audit). Decisions taken with the owner:
one spec/one pass; send modes = **review + automatic**; verification = **TDD on fakes
+ one live smoke test per adapter**; executor = **cron dispatcher + per-send task**.

## 1. Scope & non-goals

**Ships**

- Live send boundary: `send-dispatch` cron + `outreach-send` task with suppression
  re-check, platform kill switch, per-account pause, safety limits, warmup gating,
  human-like pacing, and the `outreach_sends` audit trail.
- Smartlead adapter implementing the extended `EmailInfra`; provisioning UX;
  warmup-status gating; bounce/complaint/unsubscribe reactions.
- Unipile adapter implementing the extended `LinkedInInfra`; hosted-auth connect UX;
  invite → accept → message sequencing; account status webhooks.
- Webhook routes with signature verification + idempotent event processing.
- Shared reply classification (deterministic pre-checks + AI brain); replies cancel a
  lead's remaining sends; `not_interested` → suppression.
- One-click unsubscribe (link + RFC 8058 header) → suppression; physical-address
  footer on every cold email.
- Send modes: `review` (default, approve in queue → send) and `automatic` (drafts
  skip review unless humanizer style flags are unresolved).
- Whitelabel follow-up: `leads.source` enum value `'explorium'` renamed to
  `'discovery'`.

**Deferred (roadmap bullets, not silent drops)**

- Manual-draft and user-drafted-copy send modes (`campaigns.send_mode = 'manual'`,
  `user_copy`) — niche under the agent front door.
- Deliverability alarm dashboards. This phase ships the minimal automatic reaction
  only: bounce → suppression + mailbox health update; complaint → suppression +
  auto-pause the mailbox.
- Reply conversation UI. Replies are visible on the lead slide-over only.

## 2. Schema — migration 0009 (RLS in the same migration; rls-auditor pass required)

- `accounts.sender_address jsonb` — customer's physical mailing address
  (`{line1, line2?, city, region, postal, country}`) for the CAN-SPAM footer.
  Collected on `/settings/channels`; email dispatch refuses to run for an account
  until it is set.
- Per-account kill switch: the existing `accounts.outreach_paused` (0001) gets its
  toggle on `/settings/channels` — no new column. The platform-wide switch stays in
  `app_settings.outreach_kill_switch` (service-role only, no UI this phase).
- `scheduled_sends.linkedin_stage text check in ('invite','message')`, null for
  email — Phase 3 LinkedIn drafts hold only the connection note, so the follow-up
  message becomes a second draft row and the stage column tells the dispatcher
  which is which (see §3).
- `webhook_events` — inbound webhook idempotency + debugging: `id`, `source`
  (`'email' | 'linkedin'`), `provider_event_id` (unique per source), `payload jsonb`,
  `received_at`. **Service-role only: RLS enabled, no policies.**
  retention(webhook_events): purged after 30 days by the existing retention-purge job.
- `leads.linkedin_invited_at timestamptz`, `leads.linkedin_connected_at timestamptz`
  — connection-state tracking for LinkedIn sequencing.
- `leads.source` check constraint updated and existing rows migrated:
  `'explorium'` → `'discovery'`.
- No other `scheduled_sends` changes: the status lifecycle
  (`approved → scheduled → sending → sent | failed | canceled | suppressed`) already
  fits; identity assignment and `message_ref` are recorded on `outreach_sends`.

## 3. The send boundary (`packages/jobs`, rule-13 shape)

Pure cores in `pipeline/`, deps injected via `types.ts` interfaces, drizzle impls in
`pg-store.ts`, thin wrappers in `trigger/` (task id = file name).

### `pipeline/send-dispatch.ts` + `trigger/send-dispatch.ts` (cron, every 5 min)

1. Read `app_settings.outreach_kill_switch`; if on, exit (logged, tested).
2. Scan `scheduled_sends` due for dispatch: status `approved`, or `scheduled` with
   `scheduled_for <= now` that have no live task (recovery path — a crashed task's
   row is picked up on a later tick).
3. Skip accounts with `sending_paused`, campaigns not `active`, email accounts with
   no `sender_address`.
4. Per account+channel, compute today's remaining allowance with
   `safety-limits.dailyAllowance()` against a count of today's `outreach_sends`.
   LinkedIn ramp age comes from `linkedin_accounts.connected_at`; invites count
   against the invite ceiling, messages against a new message cap (§5).
5. Email: choose an `active` mailbox (never `provisioning`/`warming`/`paused`/`error`)
   under its own daily cap, least-recently-used rotation by last `outreach_sends`
   row. No eligible mailbox → row stays `approved` for a later tick.
6. Assign jittered send times across the rest of the day via `paceWithJitter`; flip
   rows to `scheduled` with `scheduled_for`; fan out delayed `outreach-send` tasks.

### `pipeline/outreach-send.ts` + `trigger/outreach-send.ts` (one send)

1. Boundary re-checks immediately before the provider call (rule 11, all tested):
   suppression (`isSuppressed`), platform kill switch, account pause, campaign still
   active, draft still `scheduled`. Any failure → status `suppressed`/`canceled`,
   no provider call.
2. Mark `sending` → call the infra interface → on success mark `sent` and insert the
   `outreach_sends` audit row (account, campaign, lead, channel, mailbox/profile,
   `message_ref`, timestamp); on provider error mark `failed` with `error`. The
   `scheduled_send.id` is passed to the provider as the idempotency ref.
3. **Email composition at send time:** create an `unsubscribe_tokens` row; append the
   footer (unsubscribe link + the account's physical address); set the one-click
   unsubscribe (RFC 8058) header where the provider supports it.
4. **LinkedIn sequencing (two draft rows):** the LinkedIn copy brain already
   returns both a connection note and a follow-up message, and `copy-draft` inserts
   two `scheduled_sends` rows per lead — `linkedin_stage = 'invite'` (body = note,
   trimmed to ≤200 chars at send) and `linkedin_stage = 'message'` (body = full
   follow-up), both reviewed together in the queue. Dispatch sends invite rows
   normally (the send sets `leads.linkedin_invited_at`); message rows are eligible
   only once the relationship-accepted webhook has set
   `leads.linkedin_connected_at`. Message rows for leads invited >30 days ago with
   no acceptance → `canceled`.

### Send modes

- `review` (default, unchanged): drafts land `pending_review`; the queue's approve
  flips them to `approved`.
- `automatic`: `copy-draft` inserts drafts as `approved` directly — **except** drafts
  with unresolved humanizer `style_flags`, which always fall back to
  `pending_review`. Suppression is still checked at draft AND at send.
- Toggle on the Copy agent (wizard step + agent card settings) writes
  `campaigns.send_mode` on the agent's internal campaign.

### Cross-cutting

- **A reply on any channel cancels the lead's remaining `approved`/`scheduled`
  sends** (status `canceled`).
- Suppression adds already flip queued drafts to `suppressed` (Phase 4); the boundary
  re-check covers the race.

## 4. Email path (`packages/email-infra` + web)

**Interface extensions (vendor-neutral types):**

```ts
verifyWebhook(headers: Record<string, string>, rawBody: string): boolean;
parseEventWebhook(payload: unknown): EmailEvent | null;
// EmailEvent = discriminated union:
//   reply | bounce | complaint | unsubscribe | warmup_update
```

`in-memory.ts` fake extended to match (controllable from tests). New `smartlead.ts`
adapter: SmartSenders domain/mailbox provisioning, per-mailbox send, warmup status
mapping to `WarmupStatus`, webhook parsing + shared-secret verification
(`SMARTLEAD_WEBHOOK_SECRET`). The vendor name never leaves the package.

**Inbound reactions (in `pipeline/inbound.ts`):** bounce → suppression(`bounce`) +
mailbox `health` update; complaint → suppression(`complaint`) + auto-pause that
mailbox (`status = 'paused'`); unsubscribe event → suppression(`unsubscribe`);
warmup_update → mailbox `status`/`daily_send_limit` sync.

**Provisioning UX:** new `/settings/channels` page, "Email sending" section —
sender-address form (required before sends), domain/mailbox count picker →
`provision()`, then a mailbox list with white-labeled warmup status copy
("Warming up — building sender reputation") and daily caps. The Copy-agent wizard's
email step shows readiness and deep-links here.

## 5. LinkedIn path (`packages/linkedin-infra` + web)

**Interface extensions:**

```ts
verifyWebhook(headers: Record<string, string>, rawBody: string): boolean;
parseAccountWebhook(payload: unknown): AccountEvent | null;  // connected | disconnected
// parseReplyWebhook gains relationship-accepted events:
parseRelationshipWebhook(payload: unknown): RelationshipEvent | null;
```

New `unipile.ts` adapter: hosted auth link creation (white-labeled, success/failure
redirect back to `/settings/channels`), invites, messages, reply + relationship +
account-status webhook parsing, verification via `UNIPILE_WEBHOOK_SECRET`.

**Connect UX:** "LinkedIn" section on `/settings/channels` — Connect button opens the
hosted auth URL; the account webhook flips `linkedin_accounts` to `active`;
`disconnected` events surface a reconnect prompt. Copy wizard's LinkedIn step
deep-links here.

**Safety limits (rule 04, stay in our scheduler, non-configurable):** existing invite
ramp/ceiling unchanged; add `LINKEDIN_STEADY_DAILY_MESSAGES = 25` and a
`kind: 'invite' | 'message'` dimension to `dailyAllowance` for the linkedin channel.

## 6. Webhooks, replies, unsubscribe (apps/web API routes — thin)

- `POST /api/webhooks/email`, `POST /api/webhooks/linkedin`: verify the signature via
  the adapter (**forged payload → 401, tested**), insert into `webhook_events`
  (duplicate `provider_event_id` → 200 no-op), trigger the `process-inbound` task.
  No business logic in routes.
- `pipeline/inbound.ts` + `trigger/process-inbound.ts`: routes events per §4/§5.
  Replies: insert a `replies` row (lead matched by mailbox/profile + sender), then
  classify via the new **reply brain** `packages/agent-brains/src/reply/` —
  deterministic pre-checks (out-of-office, bounce phrasing, unsubscribe requests)
  then AI classification through `getModel()` with a zod schema
  (`interested | not_interested | neutral | out_of_office | unsubscribe | other` +
  rationale). Writes `classification`/`classification_rationale`/`classified_at`.
  `not_interested` and reply-text unsubscribes → suppression; `interested` →
  `campaign_leads.status = 'replied'`. Every reply cancels the lead's remaining sends.
- `GET /api/unsubscribe/[token]`: public, no login — resolve token via service role,
  write suppression(`unsubscribe`), mark token used, cancel pending sends to that
  address, render a minimal "You're unsubscribed" page. `POST` on the same route
  serves RFC 8058 one-click from the email header. Idempotent: a used token still
  renders success.

## 7. UI surfaces, help content, env

- **`/settings/channels`** (new): email provisioning + sender address + mailbox list;
  LinkedIn connect + account list; "Pause all sending" toggle
  (`accounts.outreach_paused`). Settings nav entry added.
- Copy-agent wizard: send-mode toggle (review/automatic) + channel readiness
  indicators with deep links. Agent card exposes the same send-mode setting.
- Lead slide-over: latest reply + classification badge. Review queue rows show
  post-approve states (scheduled / sent / failed).
- **No vendor names on any user-facing surface** — whitelabel-auditor pass before
  ship.
- Help articles (knowledge-sync, rule 09): `channels-setup.md` (provisioning,
  warmup expectations, LinkedIn connect, pause), `send-modes.md`, and
  `replies-unsubscribes.md`; the review-queue article gains the post-approve
  lifecycle. Copilot tools for new behavior registered when Phase 6 builds the
  registry (knowledge-gap log covers the interim).
- `.env.example` additions: `SMARTLEAD_WEBHOOK_SECRET`, `UNIPILE_WEBHOOK_SECRET`
  (server-side only).

## 8. Testing & verification

TDD throughout (mock model for the reply brain; fakes for both infra packages).
Guardrail tests required by the definition of done:

1. **A suppressed lead is never sent to** — boundary test in
   `outreach-send.test.ts` (rule 11 DoD).
2. **Forged webhook payloads are rejected** with 401 and produce no side effects.
3. **A `warming` mailbox is never selected** for a campaign send.
4. **Kill switch and account pause halt dispatch** (platform + per-account).
5. Safety-limit clamps for the new message cap (extend `safety-limits.test.ts`).
6. Duplicate webhook events are processed once (`webhook_events` idempotency).
7. Automatic-mode drafts with unresolved style flags land in `pending_review`.

Adapters are tested against recorded fixture payloads; CI never calls vendors.
Existing structure/purity guardrails automatically cover the new trigger tasks and
brain. Ship gate: `pnpm lint && pnpm type-check && pnpm test && pnpm build`, then one
**live smoke test per adapter** with real keys (Smartlead: provision check + warmup
status read; Unipile: hosted-auth link + webhook parse) before `/ship-phase`.

## Production-readiness note

The "before the first real send" checklist in `docs/production-readiness.md` gates
**go-live**, not this build: this phase implements the controls (kill switch,
suppression at the boundary, signature verification, warmup gating, safety limits,
unsubscribe), while prod-environment verification, deliverability alarm thresholds,
DPAs, and the 2–4-week warmup lead time remain operational tasks before real
customer sends.
