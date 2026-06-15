# Maildoso single-provider email — design spec

**Date:** 2026-06-15
**Status:** Design approved; ready for implementation plan
**Branch:** `phase-maildoso-email` (off `main`)
**Supersedes:** the multi-vendor `phase-owned-email-infra` branch (Name.com + Cloudflare + Google + Maildoso), which is 74 commits behind `main` and too diverged to merge. Salvage only its zero-regret pieces (below).
**Related rules:** 03 (email infra), 02 (RLS / server-managed grants), 11 (compliance, deprovision), 10 (deploy/env)

---

## Decision

The email outreach provider is **Maildoso** (maildoso.ai), used as a **single all-in-one provider**: domains + DNS (SPF/DKIM/DMARC) + mailboxes + warmup, via its REST API (key from Settings → API). **Smartlead is deleted entirely** — no env switch, no fallback. Everything stays behind the existing Vantera-owned `EmailInfra` interface (rule 03), so product code (pipeline, jobs, UI) does not change shape; only the adapter behind the interface changes.

**Why Maildoso over the earlier owned-infra plan:** one subscription replaces the four-vendor stack (registrar + DNS + Google Workspace + separate warmup), eliminating Google org-policy friction (service-account JSON keys disabled) and cutting COGS. Pricing is all-in (~$2.50/mailbox at 30, down to ~$0.50 at 1,000), warmup included. **Sending cap: 15 cold emails/day/mailbox** — capacity planning sizes mailboxes-per-customer to demand, never raises the cap (rule: scale mailboxes, not caps).

**End-state after this ships:** every line of code is built and tested behind `EmailInfra`. The only remaining steps are external and mechanical:
1. Subscribe to Maildoso; set `MAILDOSO_API_KEY` (Vercel + Trigger.dev).
2. Generate `OWNED_EMAIL_SECRET_KEY` (32-byte hex) for SMTP-secret encryption at rest.
3. ~30-min pass to confirm the 8 endpoint shapes in `api-client.ts` against the now-unlocked docs.
4. Live smoke test (provision → send → warmupStatus → webhook).

That is the full meaning of "the only step needed is the Maildoso subscription."

---

## What already exists on `main` (do NOT rebuild)

- `EmailInfra` interface (`packages/email-infra/src/types.ts`): `provision` / `send` / `warmupStatus` / `verifyWebhook` / `parseEventWebhook`, plus the vendor-neutral `EmailEvent` union (reply/bounce/complaint/unsubscribe/warmup_update). **Unchanged.**
- `InMemoryEmailInfra` fake — stays as the test double.
- `mailboxes` table (`0004`): `id, account_id, email_address, domain, provider_ref, status (provisioning|warming|active|paused|error), warmup_started_at, health, daily_send_limit`. RLS account-scoped.
- `/settings/channels` provisioning UI: sender-name, sender-address (CAN-SPAM), `ProvisionEmailForm`, mailbox-status table — **already the front door**.
- Send pipeline with **warmup gating at the send boundary** (a `warming` mailbox is never selected), **kill switch**, **account pause**, **safety limits**, and **suppression-at-boundary tests** (rule 11).
- `email-footer.ts` (physical address + `List-Unsubscribe`, rule 11) and the email webhook + one-click-unsubscribe routes.
- `process-inbound` pipeline + reply brain.

## Salvage from `phase-owned-email-infra` (cherry-pick, do not merge the branch)

Provider-independent, already tested:
- `packages/email-infra/src/maildoso/smtp-sender.ts` — `SmtpSender` + `SmtpTransport` seam (nodemailer in prod, fake in tests).
- `packages/email-infra/src/maildoso/secret-crypto.ts` — AES-256-GCM encrypt/decrypt for SMTP passwords at rest (mirrors CRM token crypto). Key = `OWNED_EMAIL_SECRET_KEY`.

---

## Architecture

### Module layout — `packages/email-infra/src/maildoso/`
- `index.ts` — `MaildosoEmailInfra implements EmailInfra`. Composes the api-client + SmtpSender + an injected `getSmtpCreds` callback. No DB, no Trigger (package stays product-pure).
- `api-client.ts` — `MaildosoApiClient`: **the single place** holding every endpoint path + request/response shape. Injectable `fetch`. Each uncertain path carries a `// CONFIRM ON ACTIVATION (open-Q#n)` marker. This is the one file that may change during the 30-min activation pass.
- `smtp-sender.ts`, `secret-crypto.ts` — salvaged.
- Factory `createEmailInfraFromEnv()` (in `index.ts`, replacing the smartlead factory) → `new MaildosoEmailInfra({ apiKey: MAILDOSO_API_KEY, webhookSecret: OWNED_EMAIL_WEBHOOK_SECRET, getSmtpCreds })`.
- **Delete** `smartlead.ts` + `smartlead.test.ts`; repoint `index.ts` exports.

### The send-credential wrinkle (Option 1 — confirmed by research)
Maildoso mailboxes are **per-mailbox SMTP accounts**. `EmailInfra.send(OutboundEmail)` carries only `mailboxId`, and email-infra is DB-free by design. Resolution:
1. `provision()` returns each mailbox's SMTP creds in its result.
2. The **jobs layer** (pg-store) encrypts (`secret-crypto`) and persists them on `mailboxes`.
3. `MaildosoEmailInfra` is constructed with an injected `getSmtpCreds(mailboxId) => Promise<SmtpCredentials>` (wired to pg-store decrypt); `send()` calls it, then `SmtpSender`.

email-infra never imports the DB; secrets never reach the browser.

### Schema — migration `0021_mailbox_smtp_secret.sql`
Add to `mailboxes`: `smtp_secret` (text, AES-GCM blob `iv:tag:ct`), `smtp_host` (text), `smtp_port` (integer), `smtp_username` (text). **Server-managed**: no client UPDATE/INSERT grant on these columns; a guardrail test asserts the grant boundary (mirrors `0013`). RLS unchanged. `rls-auditor` pass on the diff.

### Provisioning flow
`/settings/channels` → existing `ProvisionEmailForm` → server action → `provision-email` Trigger task (thin wrapper) → `MaildosoEmailInfra.provision({ domainCount, mailboxesPerDomain })`:
- register/connect domain on Maildoso, create N mailboxes, collect SMTP creds → return `Mailbox[]` (+ creds).
- pg-store upserts `mailboxes` rows (encrypted secret), status `provisioning`.
- Gates retained: **plan gate**, **daily domain spend cap** (`MAX_DOMAINS_PER_ACCOUNT_PER_DAY`), and **provision only on an active paid subscription**.
- Status lifecycle `provisioning → warming → active` driven by `warmupStatus()` / `warmup_update` events.

### Sending
`outreach-send` → `MaildosoEmailInfra.send()` → `getSmtpCreds` (decrypt) → `SmtpSender` (nodemailer) → message carries `List-Unsubscribe` (RFC 8058) + the physical-address footer (`email-footer.ts`, rule 11). Warmup gating, kill switch, account pause, safety limits, and the suppression check are **already at the boundary and unchanged**.

### Inbound (replies / bounces / complaints)
Primary: Maildoso inbound webhook → existing email webhook route → `MaildosoEmailInfra.verifyWebhook` (timing-safe, `OWNED_EMAIL_WEBHOOK_SECRET`) → `parseEventWebhook` → `EmailEvent` → `process-inbound` → reply brain + suppression (bounce/complaint → suppression + mailbox pause). **Open-Q#7:** if Maildoso has no inbound webhook, this rolls into an **IMAP-poll fast-follow** task (one Trigger cron reading each mailbox's IMAP, mapped to the same `EmailEvent` union) — flagged here, not silently dropped.

### Compliance / COGS — deprovision-on-cancel (in scope, before charging)
On subscription **cancel or downgrade**, call Maildoso to **delete the mailboxes + release the domains** and **purge the stored SMTP secrets**. Implemented by extending the existing account-deletion deprovision path to the billing lifecycle. Without this, churned accounts bleed mailbox COGS. Suppression-at-boundary is untouched.

---

## OPEN QUESTIONS — confirm against developers.maildoso.com on activation
Best-effort answers from public sources are pre-filled; the live docs (login-gated behind an active plan) confirm exact shapes. Only `api-client.ts` changes.

1. **Auth + base URL** — key from Settings; header format (`Authorization: Bearer` vs `x-api-key`) **TBC**.
2. **Domains** — API registers/connects domains (public sources confirm "connect your own domains via API"); method/path/fields **TBC**.
3. **Create mailbox** — method/path/request fields + response shape **TBC**.
4. **Sending model** — per-mailbox SMTP creds confirmed (Option 1). Where creds are returned (create response vs separate GET) **TBC**.
5. **Warmup** — automatic/included (SMTP: 15 cold + 80 warmup/day, no slow ramp); status-read endpoint **TBC**.
6. **Delete mailbox / release domain** — endpoints for the deprovision path **TBC**.
7. **Inbound** — webhook vs IMAP-only **TBC** (drives the inbound path above).
8. **Domain ownership/transferability** — **TBC** (affects churn/portability messaging, not the build).

---

## Testing (TDD)
- `api-client` — against an injected `fetch` fake (request shape + response parsing per endpoint).
- `MaildosoEmailInfra` — against a fake api-client + fake `SmtpTransport`: provision returns `Mailbox[]`, send sets `List-Unsubscribe`, webhook verify rejects forged payloads (timing-safe), event parse maps to `EmailEvent`.
- `secret-crypto` — roundtrip + malformed-blob (salvaged tests).
- Pipeline — provision + send paths against `InMemoryEmailInfra`; **suppression test stays green**; grant guardrail test for the new `smtp_secret` columns.
- **Live smoke (needs `MAILDOSO_API_KEY`, not CI):** provision 1 mailbox → send to a seed inbox → `warmupStatus` → webhook 200/401.

## Definition of done (rules 11/12)
Full gate green (`lint + type-check + test + build`); `0021` with grants + guardrail test + `rls-auditor`; suppression test intact; `whitelabel-auditor` on `/settings/channels` (no "Maildoso" on any user surface — rule 03); help-content article updated for owned-email provisioning (knowledge-sync, rule 09); `.env.example` swaps Smartlead vars for `MAILDOSO_API_KEY`, `OWNED_EMAIL_SECRET_KEY`, `OWNED_EMAIL_WEBHOOK_SECRET`.

## Out of scope (separate sub-projects)
iMessage send wiring, LinkedIn (Unipile) hardening, Caller (Retell) hardening, and the operational production-readiness checklist (Sentry, backups, DPAs) — each tracked separately per the email-first sequencing.
