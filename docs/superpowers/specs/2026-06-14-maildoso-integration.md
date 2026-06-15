# Maildoso managed-mailbox integration — spec

**Date:** 2026-06-14
**Status:** Foundation built; HTTP adapter + wiring blocked on the live API docs (login-gated; needs the activated Maildoso plan)
**Branch:** phase-owned-email-infra
**Related rules:** 03 (email infra), 02 (RLS), 11 (compliance/deprovision)

## Decision

The owned email provider runs on **Maildoso** (maildoso.ai) — one provider for **domains + DNS + mailboxes + warmup**, via its REST API (API + MCP access included on every plan; key from Settings → API). This replaces the earlier multi-vendor stack (Name.com registrar + Cloudflare/Name.com DNS + Google Workspace mailboxes + separate warmup). Driver: Google org-policy friction (service-account JSON keys disabled) + far lower COGS.

- **Pricing:** 30 mailboxes $75/mo ($2.50 ea) → 1,000 $499/mo ($0.50 ea). All-in (domain + DNS + warmup included). 30-day money-back. Sending cap **15 emails/day/mailbox** (~450/mo). Size customer capacity accordingly.
- Everything stays behind the existing `EmailInfra` interface — no product-code change. Provider is swappable (we've already done Cloudflare→Name.com→Maildoso).

## Already built (this commit)

Provider-independent, zero-regret, fully tested:
- `packages/email-infra/src/maildoso/smtp-sender.ts` — `SmtpSender` + `SmtpTransport` seam (nodemailer wraps it in prod; tests inject a fake). Maildoso mailboxes are per-mailbox SMTP accounts, so sending is SMTP, not the Gmail API.
- `packages/email-infra/src/maildoso/secret-crypto.ts` — AES-256-GCM encrypt/decrypt for SMTP passwords at rest (mirrors CRM token crypto). Key = 32-byte hex env var (`OWNED_EMAIL_SECRET_KEY`).

## Architecture of the remaining build

`MaildosoEmailInfra implements EmailInfra` in `packages/email-infra/src/maildoso/index.ts`:

- **provision(req)** → for each domain: ensure the domain on Maildoso, create N mailboxes; collect each mailbox's **SMTP credentials**; return `Mailbox[]`.
- **send(email)** → look up the mailbox's SMTP creds, send via `SmtpSender` (sets `List-Unsubscribe`, rule 11).
- **warmupStatus(id)** → read Maildoso warmup state → `WarmupStatus`.
- **verifyWebhook / parseEventWebhook** → Maildoso inbound events → existing `EmailEvent` union (reply/bounce). (If Maildoso has no inbound webhook, this rolls into the separate reply-ingestion fast-follow via IMAP.)

### The one interface wrinkle (decide with the docs)
SMTP send needs the per-mailbox secret, but `EmailInfra.send(OutboundEmail)` carries only `mailboxId`, and the email-infra package is DB-free by design. Two clean options:
1. **Provision returns creds → jobs persists (encrypted) → send fetches via injected callback.** Extend the provision result to carry `{ smtp }` per mailbox; the jobs layer encrypts + stores it (`mailboxes.smtp_secret`); `MaildosoEmailInfra` is constructed with a `getSmtpCreds(mailboxId)` callback (wired to pg-store decrypt) used by `send()`. Keeps email-infra DB-free. **Recommended.**
2. If Maildoso offers an **API-send or single SMTP relay** (specify from-address, one account credential): `send()` needs no per-mailbox secret and the interface is untouched. Simpler — prefer if available.

Which one we take depends on the docs (open question #4 below).

### Persistence + schema
- Migration: add `mailboxes.smtp_secret` (text, AES-GCM blob via `secret-crypto`) — only if option 1 (per-mailbox creds). Store host/port/username alongside (non-secret) or inside the blob.
- pg-store: store creds on provision; fetch+decrypt for send; **delete on deprovision**.

### Compliance / profitability (rule 11)
- **Deprovision-on-cancel/downgrade (must-build before charging):** on subscription cancel/downgrade, call Maildoso to delete the mailboxes + release domains, and purge the stored secrets — else churned accounts bleed COGS. Extend the existing account-deletion deprovision path to the billing lifecycle.
- Daily domain spend cap already shipped (`MAX_DOMAINS_PER_ACCOUNT_PER_DAY`).
- Provision only for an **active paid subscription**.

### Factory + env
- `createEmailInfraFromEnv()`: `EMAIL_PROVIDER=owned` → `MaildosoEmailInfra({ apiKey: MAILDOSO_API_KEY, ... })`.
- `.env.example`: replace the Name.com/Google/warmup vars with `MAILDOSO_API_KEY`, `OWNED_EMAIL_SECRET_KEY`, `OWNED_EMAIL_WEBHOOK_SECRET`.
- Remove the now-dead adapters (`registrar.ts`/`dns.ts`/`mailbox.ts`/`gmail-send.ts`/`warmup.ts`/`google-auth.ts`) once Maildoso is wired — **unless** open question #2 shows Maildoso only *connects* existing domains (then keep a registrar).

## OPEN QUESTIONS — confirm from developers.maildoso.com (needs the activated plan)

1. **Auth + base URL** — header format (`Authorization: Bearer` vs `x-api-key`) + base URL.
2. **Domains** — does the API **register new** domains or only **connect existing** ones? Method + path + fields. (If connect-only, a registrar like Name.com stays.)
3. **Create mailbox** — method + path + request fields + response shape.
4. **Sending model** — does each mailbox return **per-mailbox SMTP creds** (option 1), or is there an **API-send / single relay** (option 2)? Where are creds returned (create response vs separate GET)?
5. **Warmup** — auto-on per mailbox, or a toggle/endpoint?
6. **Delete mailbox / release domain** — endpoints (for the deprovision-on-cancel path).
7. **Inbound** — any reply/bounce webhook, or is reply-reading via IMAP (→ folds into the reply-ingestion fast-follow)?
8. **Ownership** — are Maildoso-bought domains registered to the customer (transferable out)?

Once these are answered, the remaining build is mechanical: drop the real calls into `MaildosoEmailInfra`, add the migration + persistence, wire the factory, smoke-test.
