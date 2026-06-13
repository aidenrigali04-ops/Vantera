# Onboarding: company details + inline website scan (2026-06-12)

## Goal

Capture **Company Name**, **Website URL** (optional), and **Target Audience** in the
onboarding wizard, and — when a website is given — crawl and analyze it at finish,
show the user a summary of what we learned, and store that intelligence per account
so the Scout agent uses it when finding leads.

## What already exists (reused, not rebuilt)

- `accounts.website_url` / `website_scan` / `website_scanned_at` (migration 0007),
  RLS-scoped per account — tenant isolation ("each user has its own logs") is already
  enforced by the `accounts_select`/`accounts_update` member policies.
- `scanWebsite()` in `packages/agent-brains/src/prospect/website-scan.ts` — fetches the
  homepage, extracts `{ summary, offerings, value_props, scope_of_industry }` via the
  single AI entry (`@vantera/ai`). The web app already depends on `@vantera/agent-brains`.
- The Scout pipeline already reads `website_scan` for ranking and refreshes it when
  stale (30-day cache, `isScanStale`). A scan written at onboarding is picked up as-is;
  the pipeline skips re-scanning until it goes stale.

## Wizard changes (3 steps → 4)

1. **NEW — "Tell us about your company"**: Company Name (required, prefilled from the
   signup `company_name` metadata) + Website URL (optional; hint: "Leave blank if you
   don't have one").
2. Industry (unchanged).
3. **Target audience** — the existing ICP step retitled "Who is your target audience?";
   still stored in `accounts.onboarding_icp` (it is the same concept; no duplicate field).
4. Revenue goal (unchanged).

Progress bar becomes 5 segments (1 endowed "account created" + 4 steps).

## Finish flow

1. Validate; create the account if missing via `create_account(companyName)`; update
   `name`, onboarding fields, and `website_url` on the account (all client-granted columns).
2. If a website URL was provided: the server action calls `scanWebsite(url)` inline
   (~10s; "Scanning your website…" pending state), writes
   `website_scan = { ...scan, url }` + `website_scanned_at` (same shape as the pipeline's
   `pg-store`), and **returns the scan** instead of redirecting. The wizard renders a
   summary screen — what the company does, offerings, value props — with a
   "Go to dashboard" button.
3. No URL, or fetch/AI failure → redirect straight to the dashboard exactly as today.
   A failed scan never blocks onboarding; the Scout run retries via the staleness check.

Decision (owner-approved): scan runs **inline in the server action**, not as a
Trigger.dev task — the user sees the summary during onboarding and local testing
doesn't require the trigger dev server.

## Migration 0010

0007 deliberately left `website_scan`/`website_scanned_at` service-role-only because
only the pipeline wrote them. Onboarding now legitimately writes them too:

```sql
grant update (website_scan, website_scanned_at) on public.accounts to authenticated;
```

RLS still restricts writes to the member's own account; the data is the seller's own
context (same trust level as the industry/ICP fields they type). rls-auditor reviews
the diff before commit.

## Validation

`validateOnboarding` gains `companyName` (required) and `websiteUrl` (optional):
trim; empty → `null`; prepend `https://` when no scheme; reject strings that don't
parse as http(s) URLs with a hostname containing a dot. Pure function, colocated tests.

## Knowledge-sync

`packages/help-content/content/getting-started.md` updated to describe the four
questions and the website scan ("Vantera reads your website to learn your offerings —
your Prospect Agent uses this to find leads that fit"). No vendor names anywhere.

## Testing

- Validation unit tests (new fields, URL normalization edge cases) — TDD.
- Existing wizard/action behavior covered by the full gate
  (`pnpm lint && pnpm type-check && pnpm test && pnpm build`).
- Manual: run onboarding at localhost with a real URL; verify summary screen and
  `accounts.website_scan` row.
