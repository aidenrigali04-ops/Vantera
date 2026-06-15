# LinkedIn connect: existing-first + return redirect (2026-06-15)

## Goal

Make connecting LinkedIn in the dashboard a clean, single-flow experience: the user
leaves to the hosted-auth page, signs in on LinkedIn, and is **redirected back into
the app**. Frame **connecting an existing account** as the primary action, with
**connecting additional existing accounts** as a clearly secondary one. No onboarding
step and no managed/provisioned-account capability — both explicitly out of scope.

This closes the Phase 5 LinkedIn connect-UX gap (no return path; new-tab flow) flagged
in the roadmap.

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

## Explicitly out of scope (separate Phase 5 follow-ups)

- Hosted-auth **custom-domain assertion** (audit follow-up 2b) — keeps the hosted page
  itself white-labeled; depends on vendor-side domain config.
- **`scheduled_sends` `linkedin_stage` CHECK** migration (audit follow-up 2a).
- Onboarding connect step (decided: dashboard scope only).

## Testing

- `buildConnectRedirects` unit tests — TDD (trailing slash, param shape, missing env).
- `linkedin-infra` adapter test: `createHostedAuthLink` includes the redirect URLs in
  the request body when provided, omits them when not; fake-interface test updated.
- No send path touched → no new suppression test required; no new table → no migration,
  no RLS change.
- whitelabel-auditor on the changed channels surface + help article.
- Manual: at localhost, click Connect → land on hosted auth → complete/cancel → verify
  redirect back to `/settings/channels?connected=1|failed` and the banner. Full
  end-to-end account-row creation rides the existing Phase 5 live webhook smoke test
  (real Unipile credentials).

## Definition of done

Full gate green (`pnpm lint && pnpm type-check && pnpm test && pnpm build`); help
article shipped in the same change (rule 09); whitelabel-auditor pass; no vendor names
on the surface.
