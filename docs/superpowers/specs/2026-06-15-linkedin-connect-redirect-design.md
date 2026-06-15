# LinkedIn connect + inbound webhook reconciliation (2026-06-15)

## Goal

Two coupled pieces of Phase 5 LinkedIn finishing work:

1. **Connect UX (dashboard).** Make connecting LinkedIn a clean, single-flow
   experience: the user leaves to the hosted-auth page, signs in on LinkedIn, and is
   **redirected back into the app**. Frame **connecting an existing account** as the
   primary action, with **connecting additional existing accounts** as a clearly
   secondary one. No onboarding step and no managed/provisioned-account capability —
   both explicitly out of scope.

2. **Inbound webhook parser reconciliation.** Wiring the three live Unipile webhooks
   (done 2026-06-15) surfaced that our `parseEventWebhook` assumes a payload shape the
   provider does **not** send. Reconcile the adapter to the real payloads so inbound
   replies, invite-accepts, and account-status events actually parse — without which
   the LinkedIn loop silently no-ops (accounts never flip to connected; replies never
   classify/suppress).

Together these close the Phase 5 LinkedIn connect-UX gap and the inbound-parse gap
flagged on the roadmap.

## What already exists (reused, not rebuilt)

- `LinkedInInfra.createHostedAuthLink(accountId)` + `UnipileLinkedInInfra` adapter
  (`packages/linkedin-infra/src/unipile.ts`) — POSTs to the hosted-auth endpoint and
  returns `{ url, expiresAt }`. `accountId` rides through as the hosted-auth `name` and
  round-trips back on the `account_status` webhook as `vanteraAccountId` (tenant
  attribution).
- The `account_status` webhook is the **source of truth** for a connected account:
  `inbound.ts` → `upsertLinkedInAccountStatus` creates/updates the `linkedin_accounts`
  row (status `active` / `disconnected`). The connect surface never writes that row.
- `/settings/channels` page + `createLinkedInConnectLink()` server action +
  `LinkedInConnectButton` client component (plan-gated via `gate(..., "linkedinAccount")`).
- `APP_URL` env var (`.env.example`) — server-side base URL already used for
  webhook callbacks / unsubscribe links.

## 1. Hosted-auth return redirect

**Interface change.** Extend the method to accept optional redirect targets:

```ts
createHostedAuthLink(
  accountId: string,
  redirects?: { success: string; failure: string },
): Promise<HostedAuthLink>;
```

- `UnipileLinkedInInfra` threads them into the hosted-auth POST body as the provider's
  success/failure redirect params. **Exact field names are verified against the Unipile
  hosted-auth endpoint at build time** (via the Unipile endpoint reference); the durable
  contract is "redirect URLs pass through the interface," not the vendor's field spelling.
- `in-memory.ts` fake accepts and ignores the redirects (or echoes them for assertion);
  its test updated so the interface stays honest.
- White-label: redirect targets are always our own `APP_URL` origin — no vendor domain
  leaves the package.

**Server action.** `createLinkedInConnectLink()` builds the URLs from `APP_URL` via a
pure helper and passes them in:

```ts
buildConnectRedirects(appUrl: string): { success: string; failure: string }
// success → `${appUrl}/settings/channels?connected=1`
// failure → `${appUrl}/settings/channels?connected=failed`
```

Pure function, colocated test (trailing-slash normalization, missing `APP_URL` → throw
the same "try again shortly" lane the action already has).

**Same-tab navigation.** `LinkedInConnectButton` replaces
`window.open(url, "_blank")` with `window.location.assign(url)` (or `href = url`) so the
user is actually redirected out and back, rather than spawning a stale second tab.

## 2. Landing-back UX

- The channels page reads the `connected` search param:
  - `connected=1` → a one-time, dismissible banner: *"LinkedIn connection submitted —
    your account will appear here in a moment."* The row is populated by the
    `account_status` webhook (async), so we do **not** pre-create a placeholder row;
    webhook-only is the simpler, single-source-of-truth path. A page refresh (or the
    existing server render once the webhook lands) shows the `active` row.
  - `connected=failed` → an error banner with a retry hint (the primary connect button
    is right there).
- The banner is presentational; the param is informational only (never trusted for any
  state change — the webhook owns truth).

## 3. Primary vs. secondary connect

`LinkedInConnectButton` gains a `variant` prop (defaults to today's behavior so other
call sites are unaffected):

- **Empty state (no accounts):** primary/solid button — copy *"Connect your LinkedIn
  account"* — with a one-line reassurance: *"You'll sign in on LinkedIn's own page; we
  never see your password."* This is the emphasized, main action.
- **Has ≥1 account:** the existing status table, then a **secondary** (`ghost`/`outline`)
  *"Connect another account"* below it — visibly the lesser action.
- `Reconnect` (shown on a `disconnected` row) stays a small secondary action.

No copy names the provider (white-label, rule 04).

## 4. Knowledge-sync

`packages/help-content/content/channels-setup.md` updated: connecting your **own
existing** LinkedIn account is the primary path; you sign in on LinkedIn's page and are
returned to the app; the account shows as *Connecting* until confirmed, then *Active*.
No vendor names. No new copilot tool needed (no new user action type — same connect
action, restyled).

## Inbound webhook parser reconciliation

### Live webhooks (created 2026-06-15, account DSN `api48`)

Three webhooks, all → `https://vanterasystem.dev/api/webhooks/linkedin`, JSON, no
`account_ids` (all current + future accounts), each carrying header
`x-unipile-secret = <UNIPILE_WEBHOOK_SECRET>`:

| source | events | id |
|---|---|---|
| `messaging` | `message_received` | `tTl2lqBZQO2gWoGf1VC_PQ` |
| `users` | `new_relation` | `NEutnsGiQzKzXqfZXVw70Q` |
| `account_status` | `creation_success, reconnected, credentials, permissions, error, deleted` | `zNxTETeuSs-viLLQ8yzq8A` |

(The provider dashboard can't attach custom headers; these were created via the API so
the secret header is present. Auth note: the API key's trailing `=` is significant.)

### The mismatch (confirmed from the provider field reference)

`parseEventWebhook` (`packages/linkedin-infra/src/unipile.ts`)
assumes every payload has top-level `event` (the discriminator), `event_id` (idempotency
key), and — for status — `status ∈ {OK, CREATION_SUCCESS, DISCONNECTED}`. The real
provider payloads carry **none of those names**:

- **`messaging` / message_received**: fields include `account_id`, `sender` (object),
  `message`, `timestamp`, `message_id`, `provider_message_id`, `is_sender`,
  `webhook_name`, … — **no `event`, no `event_id`**.
- **`users` / new_relation**: `account_id`, `user_profile_url`, `user_provider_id`,
  `user_full_name`, `timestamp`, `webhook_name`, … — **no `event`, no `event_id`**.
- **`account_status`**: default fields render as **`AccountStatus`** and **`Product`**
  (capitalized), plus account identity — **no `status`, no `event`, no `event_id`**.

So as shipped, authenticated events arrive and **silently fail to parse**: accounts
never flip to connected, invite-accepts never advance the sequence, replies never
classify or suppress.

### Reconciliation work

1. **Capture-first (verification gate, before finalizing code).** Instrument the webhook
   route in a preview/dev env to log the raw body, then trigger one of each event
   (connect an account → `account_status`; send + accept an invite → `new_relation`;
   receive a DM → `message_received`). The captured JSON is the source of truth for
   exact nesting, the event discriminator, and the `AccountStatus` value set. No final
   parser code lands against guessed shapes.

2. **Discriminator.** Each webhook is single-event, but the route hands the parser an
   undifferentiated body. Resolve the type by field presence (e.g. `message` →
   reply; `user_profile_url` && no `message` → relationship_accepted; `AccountStatus`
   present → account_status), confirmed against captured payloads. (`webhook_name`
   carries our `name` and is a fallback signal, not the primary key.)

3. **Idempotency key.** With no `event_id`, `recordEvent` needs a per-source synthetic
   `providerEventId`: messaging → `provider_message_id` (fallback `message_id`);
   account_status → `account_id` + `AccountStatus` + `timestamp`; users → `account_id` +
   `user_provider_id` + `timestamp`. Keep it stable so retries dedupe in `webhook_events`.

4. **Status mapping.** Map `AccountStatus` values → our `"active" | "disconnected"`:
   success-class (`CREATION_SUCCESS`, `OK`, `RECONNECTED`, `SYNC_SUCCESS`) → active;
   fault-class (`CREDENTIALS`, `PERMISSIONS`, `ERROR`, `DELETED`, `STOPPED`) →
   disconnected; ignore transient (`CONNECTING`). Exact enum confirmed by capture.

5. **`is_sender` guard.** Drop messaging events where `is_sender === true` so our own
   outbound messages don't echo back as fake inbound replies.

6. **Update the contract everywhere it's mirrored.** `LinkedInEvent` types,
   `in-memory.ts` fake, and `unipile.test.ts` move to the real shapes (tests first,
   fed by the captured fixtures). The fake's payloads become realistic, not idealized.

This stays inside the `linkedin-infra` package (interface + adapter + fake + tests) plus
the route's `extractEventId`; no schema change, no new table.

## Explicitly out of scope (separate Phase 5 follow-ups)

- Hosted-auth **custom-domain assertion** (audit follow-up 2b) — keeps the hosted page
  itself white-labeled; depends on vendor-side domain config.
- **`scheduled_sends` `linkedin_stage` CHECK** migration (audit follow-up 2a).
- Onboarding connect step (decided: dashboard scope only).

## Testing

Connect UX:
- `buildConnectRedirects` unit tests — TDD (trailing slash, param shape, missing env).
- `linkedin-infra` adapter test: `createHostedAuthLink` includes the redirect URLs in
  the request body when provided, omits them when not; fake-interface test updated.
- whitelabel-auditor on the changed channels surface + help article.
- Manual: at localhost, click Connect → land on hosted auth → complete/cancel → verify
  redirect back to `/settings/channels?connected=1|failed` and the banner.

Webhook reconciliation:
- `parseEventWebhook` tests driven by the **captured real payload fixtures** (one per
  source) — reply, relationship_accepted, account_status(active), account_status
  (disconnected); plus the `is_sender === true` echo case → null.
- Idempotency-key derivation tests per source (stable synthetic `providerEventId`).
- The existing `inbound.test.ts` / suppression test still passes against the new event
  shapes (a suppressed reply is never sent to — rule 11 guard stays green).
- No send path changed → no new suppression test required; no new table → no migration,
  no RLS change.
- Full end-to-end account-row creation + reply flow rides the Phase 5 live webhook smoke
  test (the capture step above doubles as it), real Unipile credentials.

## Definition of done

Full gate green (`pnpm lint && pnpm type-check && pnpm test && pnpm build`); help
article shipped in the same change (rule 09); whitelabel-auditor pass; no vendor names
on the surface.
