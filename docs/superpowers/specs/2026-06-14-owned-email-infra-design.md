# Owned Email Infrastructure — design

**Date:** 2026-06-14
**Status:** Approved for planning
**Phase:** Owned Email Infrastructure (new phase; see roadmap)
**Related rules:** 03 (email infra), 02 (RLS/tenancy), 10 (deployment), 11 (compliance), 13 (SDR agent framework)

## Problem & motivation

Vantera provisions sending domains + mailboxes per customer for cold outreach. Today that runs on
Smartlead's SmartSenders (managed domains + mailboxes + warmup network + inbox rotation), white-labeled
behind the `email-infra` interface (rule 03).

The owner wants to move off SmartSenders to **own the domains, DNS, mailbox configuration, and reply
data directly** — the driver is **control / data ownership**, not cost. Rule 03 anticipated exactly this:
the `email-infra` interface exists *"so the provider is swappable later (e.g. to owned raw infra) without
touching product code."* This phase exercises that escape hatch.

## What this is NOT

- **Not a full self-built deliverability stack.** Building a warmup network from scratch is a multi-month
  effort with a cold-start problem (you need a large existing inbox network to warm new inboxes) and ongoing
  deliverability ops. Rule 03 deliberately deferred it. We outsource **only** warmup.
- **Not self-hosted mail servers (v1).** For cold outreach, unknown sending IPs are distrusted by Gmail/Outlook
  regardless of perfect SPF/DKIM/DMARC, and shared-IP reputation across tenants is a real blast-radius risk.
  Mailboxes live on Google Workspace, which we own and control, for best inbox placement.
- **Not a new billing model (v1).** Existing plan-tier mailbox limits + entitlement gates (Phase 6) govern
  how many domains/mailboxes a customer can provision.

## Chosen approach — Path B (self-built hybrid)

Own the registrar, DNS, mailbox config, and reply data; outsource only the warmup network.

| Layer | Choice | Ownership |
|---|---|---|
| Registrar | Cloudflare Registrar (at-cost) | Vantera owns the domains |
| DNS | Cloudflare DNS API | Vantera writes SPF/DKIM/DMARC/MX |
| Mailbox | Google Workspace via Admin SDK Directory API | Vantera owns tenant + config + data |
| Warmup | Third-party warmup-network API (e.g. Mailreach/Warmy) | **Outsourced** (the one hard piece) |
| Send | Gmail API `users.messages.send` | Vantera |
| Replies/bounces | Gmail push via Pub/Sub watch (fallback: history poll) | Vantera owns reply data |

**Tenancy model (v1): lightweight, reseller later.** Add each purchased domain as a secondary domain on
Google Workspace accounts Vantera owns, create users via the Admin SDK — no reseller approval needed, ships
now. Tradeoff: domains share a tenant's reputation and there are domain-per-account caps, so we rotate across
a pool of owned tenants. The reseller-grade path (Google Workspace Reseller API, per-customer isolated tenants)
is filed in parallel and swapped in later behind the **same** `EmailInfra` interface — no product-code change.

## Architecture — code layout

Product code does not change. We add one adapter and the orchestration behind it. The pipeline, scheduler,
`mailboxes` table, billing gates, suppression boundary, and webhook handlers all stay as they are.

```
packages/email-infra/
  src/
    types.ts            UNCHANGED — EmailInfra interface, EmailEvent
    in-memory.ts        UNCHANGED — fake for pipeline tests
    smartlead.ts        retained — fallback / comparison adapter
    owned/              NEW
      index.ts          OwnedEmailInfra implements EmailInfra (orchestrates the layers)
      registrar.ts      Cloudflare Registrar — buy domain (interface + fake + adapter)
      dns.ts            Cloudflare DNS — SPF/DKIM/DMARC/MX records (interface + fake + adapter)
      mailbox.ts        Google Admin SDK — create/verify domain + create users (interface + fake + adapter)
      warmup.ts         warmup-network API client (interface + fake + adapter)
      send.ts           Gmail API send
      replies.ts        Gmail Pub/Sub / history → existing EmailEvent types
```

`createEmailInfraFromEnv()` gains a switch on `EMAIL_PROVIDER=owned|smartlead` so the provider can be flipped
(or A/B'd) without touching product code. Each sub-layer sits behind its own small interface with an in-memory
fake (the rule-13 provider pattern), so `OwnedEmailInfra.provision()` is pure orchestration and unit-testable
with fakes.

## Provisioning flow

`provision({ accountId, domainCount, mailboxesPerDomain })` runs as a **durable Trigger.dev workflow** (DNS and
domain verification involve async waits — fits the existing jobs pattern; thin trigger wrapper over a pure core
per rule 13):

```
1. Buy domain(s)        Cloudflare Registrar API
2. Point + write DNS    Cloudflare DNS: MX (Google), SPF (include _spf.google.com),
                        DKIM key (generated in Workspace, published), DMARC (p=quarantine), tracking CNAME
3. Add + verify domain  Google Admin SDK adds the domain to an owned tenant; verify TXT/CNAME (poll until verified)
4. Create N mailboxes   Admin SDK Directory: create users on the verified domain
5. Enroll in warmup     warmup-network API, one enrollment per mailbox
6. Persist              sending_domains + mailboxes rows; status provisioning -> warming
```

Mailboxes follow the existing `mailboxes.status` lifecycle (`provisioning -> warming -> active -> paused/error`).
`warmupStatus()` reads from the warmup API; a mailbox joins the send rotation only at `active` (warmup-gated sends
already enforced in the pipeline). Plan to provision 2–4 weeks before any launch date (warmup is time-gated).

### Domain-name selection
Auto-suggest brand-adjacent lookalike domains (`get-`, `try-`, `-hq`, `.com/.io`) derived from the account's
website/company name, check availability via Cloudflare, user confirms. (Customer owns the names since Vantera
owns the registration — this differs from the SmartSenders managed model where names were opaque.)

## Data model

New tables get RLS in the same migration (rule 02) with a guardrail test; run `/vantera-db-migrations`.

- **`sending_domains`** (new, RLS tenant-scoped):
  `id, account_id, domain, registrar_ref, workspace_tenant_ref, dns_state, verified_at, expires_at, status`.
- **`mailboxes`** (existing) gains: `domain_id` (FK -> `sending_domains`), `provider_ref` (Workspace user id),
  `warmup_ref`, `daily_cap`.
- **`infra_workspace_tenants`** (new, internal — NOT tenant-scoped; Vantera-owned infra config):
  the pool of owned Workspace accounts domains are rotated across. Admin-only; never exposed to customer RLS.

## Send + replies

- **Send:** Gmail API `users.messages.send` (OAuth2 / service account with domain-wide delegation). Sets the
  `List-Unsubscribe` / `List-Unsubscribe-Post` headers already carried on `OutboundEmail.unsubscribeUrl`.
  Returns `{ messageId, sentAt }` — same `SendResult`.
- **Replies / bounces:** Gmail push notifications via Pub/Sub `watch` (fallback: history poll), normalized into
  the existing `EmailEvent` union (`reply | bounce | complaint | unsubscribe | warmup_update`) so the shared
  reply-classifier and suppression writes are untouched. `verifyWebhook` validates the Pub/Sub JWT;
  `parseEventWebhook` maps to `EmailEvent`.
- **Known gap (accepted):** spam *complaints* are not cleanly observable per-message via the Gmail API. We lean
  on Google Postmaster Tools for reputation signals and treat **hard bounces** as the reliable auto-suppression
  trigger — the same posture Phase 5 already took (bounce/complaint -> suppression + mailbox pause).

## Billing

No new billing mechanics in v1. Existing plan-tier mailbox limits + entitlement gates (Phase 6) govern how many
domains/mailboxes a customer may provision; "buying" = provisioning within plan. Real per-domain registration,
Workspace seat, and warmup costs are Vantera COGS. A `sending_domains_purchased` Stripe **add-on** (mirroring the
existing `linkedin_accounts_purchased` pattern in `@vantera/billing`) is a clean later upgrade, explicitly out of
v1 scope.

## Compliance, white-label, testing, secrets

- **White-label (rules 03–05):** Cloudflare, Google, and the warmup vendor never appear on any user-facing
  surface. The Channels UI continues to say only "sending domains."
- **Compliance (rule 11):** suppression check stays at the scheduler boundary (unchanged); unsubscribe headers +
  physical sender address already in the send path. New send path ships with the mandatory suppression test.
- **Retention (rule 11):** `sending_domains` carries no prospect data; standard tenant-cascade on account deletion
  plus deprovision calls (release domain / delete Workspace users / drop warmup enrollment) on the deletion path.
- **Testing:** each layer (`registrar / dns / mailbox / warmup`) gets its own interface + in-memory fake + colocated
  tests; the existing `email-infra` in-memory fake continues to cover the pipeline. Live smoke test (real Cloudflare
  + Google + warmup creds) is deferred to ship, like Phase 5's per-adapter smoke test.
- **Secrets -> `.env.example` + Vercel/Trigger dashboards (rule 10):** `CLOUDFLARE_API_TOKEN`, Google service-account
  JSON w/ domain-wide delegation, `WARMUP_API_KEY`, `EMAIL_PROVIDER` (`owned|smartlead`).

## Definition of done (this phase)

1. `OwnedEmailInfra` implements `EmailInfra` fully; `EMAIL_PROVIDER` switch in `createEmailInfraFromEnv()`.
2. Migration: `sending_domains` (+ `mailboxes` columns) with RLS + guardrail test; `infra_workspace_tenants`
   internal table; rls-auditor pass.
3. Provisioning Trigger.dev workflow (pure core + thin wrapper, rule 13) with layer fakes in tests.
4. Send + reply/bounce path normalized to `EmailEvent`; suppression test on the new send path (rule 11).
5. Channels UI wired to real provisioning (domain suggest -> confirm -> provision -> warmup status), white-label clean.
6. Help-content article(s) updated for the provisioning UX (knowledge-sync, rule 09); whitelabel-auditor pass.
7. Full CI gate green; roadmap entry flipped.

## Open follow-ups (not v1 blockers)

- Google Workspace **Reseller** application (parallel track) → swap `mailbox.ts` to the Reseller API later.
- `sending_domains_purchased` Stripe add-on when per-domain billing is wanted.
- Microsoft 365 mailbox adapter (same interface) as a second provider option.
- Domain expiry / auto-renew monitoring surface.
