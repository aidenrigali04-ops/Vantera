# LinkedIn (Unipile) production hardening — design spec

**Date:** 2026-06-15
**Status:** Scope approved; ready for implementation plan
**Branch:** `phase-linkedin-harden` (off `main`)
**Related rules:** 04 (LinkedIn infra + safety limits), 11 (compliance/suppression), 02 (RLS/grants)

## Decision

The Unipile LinkedIn integration is already built and tested end-to-end (Phase 5). This sub-project **hardens it to production** — it does NOT rebuild it. After merge, the only remaining steps are external: Unipile credentials (`UNIPILE_API_KEY`/`DSN`/`WEBHOOK_SECRET`), the hosted-auth custom domain configured vendor-side, and the user connecting their own LinkedIn account.

## What already exists (do NOT rebuild)
- `UnipileLinkedInInfra` (`packages/linkedin-infra`): hosted-auth link, invite, message, **timing-safe webhook verify** (SHA-256 digest compare), event parsing (reply / relationship_accepted / account_status). White-labeled behind `LinkedInInfra`.
- Webhook route `/api/webhooks/linkedin`: dedup via `webhook_events` + verify + enqueue `process-inbound`.
- Inbound (`pipeline/inbound.ts`): `account_status` → `upsertLinkedInAccountStatus`; `relationship_accepted` → `setLeadConnected` (server-only writer of `leads.linkedin_connected_at`); reply → suppression on not-interested/unsubscribe.
- Safety limits (`pipeline/safety-limits.ts`, rule 04): `LINKEDIN_WEEKLY_INVITE_CEILING=100`, new-account ramp (5/10/15/20), daily messages 25, `paceWithJitter` (±30%). Wired into `send-dispatch` for **daily** clamping + pacing.
- `send-dispatch` selects only `linkedin_accounts.status='active'` for sending — so a non-active account is automatically excluded.

## The five hardening items

### 1. Weekly invite ceiling — rolling 7-day enforcement (account-safety critical)
**Gap:** `send-dispatch` clamps invites by the *daily* allowance + `countLinkedInSentToday` only. `LINKEDIN_WEEKLY_INVITE_CEILING=100` is *approximated* by "20/day × 5 weekdays" but nothing enforces weekday-only, so steady 20/day × 7 = 140/week could exceed 100 → LinkedIn account restriction risk.
**Fix:** add store method `countLinkedInInvitesLast7Days(accountId, now)` (rolling 168h window over `outreach_sends` where channel='linkedin' AND linkedin_stage='invite'). In `send-dispatch`, the invite allowance becomes `min(dailyAllowance("linkedin", age) - sentToday, LINKEDIN_WEEKLY_INVITE_CEILING - sentLast7Days, 0-floored)`. Messages keep the daily cap only (the weekly ceiling is invite-specific per rule 04). Test: a backlog with 95 invites already sent in the last 7 days yields ≤5 dispatched.

### 2. Hosted-auth custom-domain rewrite (white-label, rule 04)
The hosted-auth page is a **user-facing surface**; a `unipile.com` URL would leak the vendor.
**Fix:** `UnipileConfig` gains optional `hostedAuthDomain`; the factory reads `process.env.HOSTED_AUTH_DOMAIN`. In `createHostedAuthLink`, after resolving `url`: if `hostedAuthDomain` is set, **rewrite the URL host** to it (Unipile returns the URL on its own domain and instructs callers to swap in their custom domain before redirecting — so rewrite, do NOT assert), preserving path + query; if unset → `console.warn` once and proceed unchanged. Configurable so we white-label once the domain is live. Tests cover rewrite, already-on-domain no-op, and unset (warn + unchanged).
> Corrected 2026-06-15 after build: the original spec/code *asserted* the host and threw on mismatch — which would break every connect call once the custom domain was set (the provider always returns its own host). Changed to rewrite.

### 3. Server-manage `leads.linkedin_connected_at` — migration `0022`
Only the inbound accept handler writes it (verified: `setLeadConnected`, service role). Block client writes as defense-in-depth.
**Fix:** `0022_linkedin_connected_at_grant.sql`: `REVOKE UPDATE (linkedin_connected_at) ON leads FROM authenticated, anon;` + grant guardrail test (same pattern as `0013`/`0021`).

### 4. `scheduled_sends` stage/channel integrity — migration `0023`
**Fix:** `0023_scheduled_sends_stage_check.sql`: `ALTER TABLE scheduled_sends ADD CONSTRAINT scheduled_sends_linkedin_stage_channel CHECK (linkedin_stage IS NULL OR channel = 'linkedin');` + guardrail test asserting the constraint text.

### 5. Account-restriction mapping (reconnect signal)
**Gap:** `parseEventWebhook` maps only `OK`/`CREATION_SUCCESS`→active and `DISCONNECTED`→disconnected; every other Unipile account status (`CREDENTIALS`, `CHECKPOINT`, `PERMISSIONS`, `ERROR`, `STOPPED`, `SYNC_ERROR`) returns `null` and is silently dropped — the account looks healthy while it can't send.
**Fix:** extend `LinkedInEvent` `account_status.status` union to `"active" | "restricted" | "disconnected"`; map the credential/checkpoint/permission/error/stopped states → `"restricted"`. Widen `upsertLinkedInAccountStatus`'s `status` param to accept `"restricted"`. `linkedin_accounts.status` already has `'restricted'` in its enum, and `send-dispatch` already excludes non-active accounts, so a restricted account **auto-stops sending** and surfaces the existing "Restricted" badge in `/settings/channels`. (User reconnect notification = documented follow-up, out of scope here.)

## Live smoke plan (needs Unipile creds; not CI)
Hosted-auth link returns a URL (+ domain assertion if `HOSTED_AUTH_DOMAIN` set) → connect a test LinkedIn account → `account_status` active round-trip → send one invite + one message → forged `x-unipile-secret` returns 401, valid returns 200 → simulate a checkpoint status → account flips to `restricted` and the scheduler skips it.

## Definition of done (rules 04/11/12)
Full gate green; `0022`/`0023` with guardrail tests + `rls-auditor`; suppression test intact; `whitelabel-auditor` (no "Unipile" on user surfaces); `.env.example` adds `HOSTED_AUTH_DOMAIN`; help content unchanged (no user-facing behavior change) or a one-line connection-health note.

## Out of scope (separate work)
Reconnect-notification email; iMessage send wiring; Caller hardening. Migration numbers `0022`/`0023` deliberately skip `0021` (reserved for the unmerged Maildoso branch) to avoid a merge collision.
