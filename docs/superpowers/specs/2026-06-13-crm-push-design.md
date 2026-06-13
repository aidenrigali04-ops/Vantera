# CRM push — closed deals into the customer's CRM (Phase 9)

**Date:** 2026-06-13
**Status:** Approved (design)
**Roadmap:** Phase 9 — CRM push. Key rule: 01 (Vantera is not a CRM; closed leads are pushed *out* to the customer's CRM).

## Goal

When a deal closes in Vantera, the won lead lands in the customer's own tool —
HubSpot, Salesforce, or GoHighLevel as a contact + deal, or Slack / Monday as a
notification / board item — automatically on close and on demand via a button.

## Scope decisions (locked during brainstorming)

1. **Trigger: both auto + manual.** Build minimal close-tracking now (a
   "Mark as closed-won" action with a deal value). Auto-push fires on that
   event when an active connection has auto-push enabled; a manual
   "Push to CRM" / "Re-push" button is always available.
2. **All five destinations now, two adapter shapes.** True CRMs
   (HubSpot, Salesforce, GoHighLevel) create a contact + deal. Notify tools
   (Slack, Monday) post a message / create a board item. Both shapes sit behind
   one `crm-infra` interface (approach A).
3. **OAuth for all five.** Users click Connect and authorize; Vantera holds the
   tokens, encrypted, and refreshes them. No pasted API keys.
4. **Field mapping: smart defaults + light overrides.** Vantera auto-maps the
   obvious fields on connect; the user can remap or add a few custom-field
   mappings in a simple UI.

### Out of scope (deliberate boundaries)

- **Funnel analytics dashboards** — Phase 8 owns the funnel (sent → … → closed)
  and revenue-goal charts. This phase only adds the *close stage* (deal value +
  closed date) and a "pushed to CRM" status the Phase 8 dashboards can later
  read.
- **Lost-deal tracking.** Only closed-won drives a push. No lost/stage pipeline
  (YAGNI).
- **Two-way sync.** Push only. Vantera never reads the CRM back as a source of
  truth (rule 01 — Vantera is not a CRM).
- **Suppression.** A won-customer push is not an outreach send, so rule 11's
  suppression gate does not apply and is intentionally absent from this path.

### White-label exception

Outreach vendors (Smartlead, Unipile, Explorium) stay hidden (rules 03–05). CRM
destinations are the **customer's own tools**, so their names (HubSpot,
Salesforce, GoHighLevel, Slack, Monday) **are** shown to users. Vendor API
specifics still live only inside `packages/crm-infra`.

## Architecture (approach A — one polymorphic interface)

```
Mark closed-won (web action)  ──┐
Manual "Push to CRM" (button) ──┤→ enqueue crm_push_events row
                                │
   retry cron (nextRetryAt due) ┘
                                │
        packages/jobs/src/trigger/crm-push.ts  (thin wrapper, task id "crm-push")
                                │
        packages/jobs/src/pipeline/crm-push.ts  (pure core, deps injected)
            resolve connection → refresh token if expired
            → connector.pushClosedDeal(ClosedDeal)
            → record success / failure + schedule retry (backoff)
                                │
        packages/crm-infra  (registry → adapter)
            CRM shape:    hubspot | salesforce | gohighlevel  (contact + deal)
            notify shape: slack | monday                      (message / item)
```

One `CrmConnector` interface over a normalized `ClosedDeal` payload. CRM adapters
create a contact + deal; notify adapters post a message / board item. The
pipeline has a single push path; the two shapes are two *implementations*, not
two interfaces.

## Components

### 1. `packages/crm-infra` (new package; framework rule 13)

- `types.ts` — `CrmConnector` interface; normalized `ClosedDeal`; `TokenSet`;
  `FieldMapping`; `FieldDescriptor`; `ConnectorResult`; `CrmProvider` +
  `ConnectorKind` ('crm' | 'notify'); `ConnectorMeta`.
- `index.ts` — registry mapping `provider → adapter` + metadata
  (label, kind, default mapping, OAuth scopes/endpoints). Single import surface.
- `in-memory.ts` + `in-memory.test.ts` — fake connector for pipeline/UI tests.
- Adapters (one file + colocated test each):
  - `hubspot.ts`, `salesforce.ts`, `gohighlevel.ts` — CRM shape: upsert contact
    by email, create deal with value + Vantera source; honor configured
    pipeline/stage.
  - `slack.ts` — post a formatted "deal closed" message to the configured
    channel.
  - `monday.ts` — create an item on the configured board with deal columns.

`CrmConnector` interface:

```ts
interface CrmConnector {
  provider: CrmProvider;
  kind: ConnectorKind;                 // 'crm' | 'notify'
  defaultMapping: FieldMapping;
  // OAuth
  getAuthorizeUrl(state: string): string;
  exchangeCode(code: string): Promise<TokenSet>;
  refreshToken(refreshToken: string): Promise<TokenSet>;
  // health
  testConnection(ctx: ConnectorCtx): Promise<ConnectorResult<{ detail?: string }>>;
  // the one push entrypoint — adapter decides contact+deal vs message/item
  pushClosedDeal(ctx: ConnectorCtx, deal: ClosedDeal): Promise<ConnectorResult<{ externalRef?: string }>>;
  // optional: live target fields for the mapping UI
  describeFields?(ctx: ConnectorCtx): Promise<FieldDescriptor[]>;
}
```

`ClosedDeal` (normalized, provider-agnostic): contact (first/last/email/phone/
title/company/domain), dealValueCents, closedAt, source label, leadId, and the
resolved `config` (mapping overrides + target). No DB or vendor types leak into
it.

Purity: no Trigger.dev / drizzle / DB imports in `crm-infra` — it is a provider
package, same constraints as `email-infra` / `linkedin-infra`.

### 2. Token encryption util (new)

First feature that stores third-party tokens ourselves (LinkedIn/email keep auth
at the vendor). Add a small AES-256-GCM helper (`encrypt`/`decrypt`) keyed by a
new `CRM_TOKEN_KEY` env var (added to `.env.example`). Location: a focused
`packages/db` crypto module (or `packages/crm-infra` if it stays free of DB
deps — decide in plan; tokens are encrypted *before* they reach the DB layer).
Tokens are never logged and never returned to the client.

### 3. Data model (one migration; RLS in the same migration — rule 02)

- **`leads`** (extend): `dealValueCents` bigint (nullable), `closedAt` timestamptz
  (nullable). `status='converted'` is reused as closed-won (no new status).
- **`crm_connections`**: `id`, `accountId` (FK cascade), `provider`,
  `kind`, `status` ('connecting' | 'active' | 'error' | 'disconnected'),
  `accessTokenEnc`, `refreshTokenEnc`, `tokenExpiresAt`, `externalAccountRef`,
  `config` jsonb (field-mapping overrides, target = Slack channel id / Monday
  board id / pipeline+stage, `autoPush` bool), `lastError`, `lastSyncAt`,
  timestamps. Unique (accountId, provider) in v1. RLS account-scoped.
- **`crm_push_events`** (audit + retry queue): `id`, `accountId`, `connectionId`
  (FK), `leadId` (FK, set null), `status` ('pending' | 'success' | 'failed'),
  `attempts`, `lastAttemptAt`, `nextRetryAt`, `payload` jsonb, `externalRef`,
  `error`, timestamps. RLS account-scoped. Doubles as the connection-health and
  push-status surface.

Retention: `crm_push_events` is operational/audit data tied to the account; it
cascades on account deletion (RLS-scoped). No prospect-data retention window
needed (these are won customers, not unqualified prospects).

### 4. Pipeline (framework rule 13)

- `packages/jobs/src/pipeline/crm-push.ts` — **pure core**, deps injected via
  interfaces in `types.ts` (store + connector registry + clock). Steps:
  load push event + connection → if token expired, refresh + persist → build
  `ClosedDeal` from the lead + mapping → `connector.pushClosedDeal()` → on
  success record `externalRef`; on failure record error + set `nextRetryAt`
  (exponential backoff, capped attempts → terminal `failed`).
- `packages/jobs/src/trigger/crm-push.ts` — thin wrapper, task id `crm-push`,
  wires real deps + logs only.
- Retry cron — scans `crm_push_events` where `status` retryable and
  `nextRetryAt` due; re-invokes the core. (Same crons-in-jobs pattern as the
  scheduler.)
- Guardrail: the trigger file imports its core from `../pipeline/` (structure
  test). No suppression call (documented above).

### 5. Web (`apps/web`)

- **`settings/integrations/`** (mirrors `settings/channels`): one card per
  destination — Connect (OAuth), live connection-health status + last error,
  field-mapping editor (defaults pre-filled, light overrides), target picker
  (Slack channel / Monday board / CRM pipeline+stage), auto-push toggle,
  Disconnect, "Test connection".
- **OAuth callback** `app/api/crm/[provider]/callback/route.ts` — exchanges code,
  encrypts + stores tokens, flips status to `active`. State param carries CSRF +
  account binding; `accountId` resolved from the session, never from params.
- **`settings/integrations/actions.ts` + `validation.ts`** — connect / disconnect
  / test / save-mapping. Pure validation fns with colocated tests; account from
  session via RLS-scoped select (never accepts accountId).
- **Leads surface** (`leads/`): "Mark as closed-won" (+ deal-value input) sets
  `status='converted'`, `closedAt`, `dealValueCents`, and enqueues a push event
  when an active connection has `autoPush`. A "Push to CRM" / "Re-push" button
  enqueues a push and shows the latest `crm_push_events` status for that lead.

### 6. Help + copilot (rule 09 — same PR)

- `packages/help-content/content/crm-push.md` (title/surface/routes frontmatter;
  no vendor names beyond the destination names the user already sees).
- Copilot tools: read-tier `crm_connection_status` and `crm_push_status` over the
  account's own data (typed DTOs, never raw rows); connecting is navigate-tier
  (deep link to the integrations page).

## Error handling

- **Token expiry** → refresh inline in the pipeline; on refresh failure, flip
  connection to `error` and surface on the health card.
- **Push failure** → record error on the event, backoff retry, terminal `failed`
  after the cap; visible on the lead's push button + the integrations health
  card.
- **Disconnected / revoked** at provider → `testConnection` flips status to
  `error`/`disconnected`; pushes for that connection short-circuit to `failed`
  with a clear message prompting reconnect.

## Testing (TDD; framework rule 13 guardrails)

- `crm-infra`: in-memory fake + per-adapter unit tests (mapping → provider
  payload, OAuth url/exchange shape, error normalization) using mocked HTTP.
- Pipeline core: success, token-refresh, retry/backoff, terminal-fail, and
  disconnected-connection paths against the in-memory connector + fake store.
- Encryption util: round-trip + tamper-detection tests.
- Web validation fns: colocated tests.
- Migration: RLS guardrail test for the two new tables (rule 02).

## Build order

1. Token encryption util + `CRM_TOKEN_KEY` in `.env.example`.
2. Migration: `leads` close columns + `crm_connections` + `crm_push_events` +
   RLS (rls-auditor pass, guardrail test).
3. `crm-infra`: `types.ts` → `in-memory.ts` → five adapters (TDD) → `index.ts`
   registry.
4. Pipeline core + thin trigger + retry cron (structure test passes).
5. Close-tracking action ("Mark as closed-won") + auto-push enqueue.
6. `settings/integrations` UI + OAuth connect/callback + mapping editor +
   health surface.
7. Manual "Push to CRM" / "Re-push" button + per-lead status.
8. Help article + copilot tools; whitelabel-auditor pass (destination names are
   the allowed exception); roadmap Phase 9 checkbox.
```
