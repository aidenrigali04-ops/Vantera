# UI/UX Completion — Design Spec (Round-2 Comparison Audit → Implementation)

**Date:** 2026-07-15
**Source:** Round-2 YC-exec comparison simulation (UI/UX focus): 5 parallel code audits (first-run · core surfaces · settings · cross-cutting systems · marketing seam), prod SQL snapshots, 53-screenshot authenticated walk of the live product at 1440px/390px. Artifact: "Vantera UI/UX Comparison Audit — July 15, 2026".
**Verdict being fixed:** *"The hard 30% is an A, the easy 70% is a C — users only feel the C."* The product is a set of excellent first drafts with no acknowledgment layer and no second layer behind the first click.

---

## Operating rules (apply to every round)

1. **Full gate before any push:** `pnpm lint && pnpm type-check && pnpm test && pnpm build`. Ship = push to main → CI green → Trigger deploy advances → Vercel promote if pinned → **live-site proof** (curl or screenshot).
2. **Knowledge-sync (rule 09):** any round that changes user-facing behavior updates the matching `packages/help-content` article in the same push.
3. **Honesty rules:** no invented numbers anywhere; empty ≠ error (an outage must never render as "0 leads"); voice = "gets smarter", never she/her for Vera.
4. **Do-not-regress list (audit strengths):** dashboard three-state machine, honesty layer, channels-page craft (reconnect-in-place, pacing), suppression/GDPR correctness, humane lapse, leads-table responsive craft, legal pages.
5. **Migrations:** committed in `packages/db/migrations/` first, applied to prod via Supabase MCP, RLS in the same migration for new tables.
6. Each round ends **shippable on its own**. Owner gates each round with "go".

---

## R0 — Quick wins (copy/config only, one push, ~1 hour total)

**Goal:** kill the pure-embarrassment items before anything structural.

| Fix | File(s) |
|---|---|
| /ai-info: "HubSpot or Pipedrive natively" → actual provider list (HubSpot, Salesforce, GoHighLevel + Slack/Monday notify); align all three fact rows | `apps/web/src/app/ai-info/page.tsx:344-345,364-365` |
| Trial-length contradiction: lifecycle DM copy says "3 days", product says 7-day → derive from `TRIAL_DAYS` or fix strings | `packages/jobs/src/pipeline/lifecycle-copy.ts:62,66` |
| Duplicate Enterprise on pricing: in-grid `<EnterpriseCard/>` AND full-width enterpriseCta panel both always render → keep ONE (the in-grid card; delete the panel) | `apps/web/src/components/pricing/pricing-grid.tsx:150-162` |
| `?portal=unavailable` silent dead-end → render an explanatory line on billing page | `apps/web/src/app/(app)/settings/billing/page.tsx` |
| Team-action errors surfaced via `title` tooltip only → inline error text (same idiom as other forms) | `apps/web/src/components/ui/share-card.tsx:170,189` |
| `focus-visible` missing on raw `<select>`s (role select, invite role) | `share-card.tsx:98,208` |

**Acceptance:** all six visible in prod; no behavior change beyond copy/render.

---

## R1 — The acknowledgment layer (the #1 "feels incomplete" fix)

**Goal:** every navigation, action, and failure produces immediate, branded feedback. This is ONE coherent pass, not three features.

### R1a — Loading
- Shared skeleton primitives (`apps/web/src/components/ui/skeleton.tsx` shadcn-style + a `PageSkeleton` composition: header bar + card blocks matching each surface's shape).
- `loading.tsx` for every `(app)` route group that queries: dashboard, leads, leads/[id], inbox, meetings, review, agents (+showcase/edit), settings (one shared for the settings tree). Auth/onboarding excluded (already fast/focused).
- No nprogress dependency; Next streaming + loading.tsx is the mechanism.

### R1b — Feedback (toasts)
- **One** toast system: `sonner` via the shadcn wrapper, mounted once in `(app)/layout.tsx` (and auth layout). Design-token colors, top-right desktop / above MobileNav on mobile.
- Wire success/error toasts to: review approve/edit/decline/bulk-approve, composer Send / Draft-with-Vera / Let-Vera-handle, settings saves (replace the four divergent idioms progressively — keep inline "Saved" where it already works, add toasts where feedback is absent), channel connect/remove/refresh, team invite/remove/role, suppression add, proof add/remove, CRM controls (meeting booked / closed-won / push).
- **Checkout return communication:** billing page reads `checkout=success|cancel` → success banner ("You're on {plan} — agents unpaused") with a webhook-race fallback state ("Payment received — activating…"), cancel acknowledgment. `RouteEvents` keeps firing analytics.

### R1c — Errors
- `apps/web/src/app/global-error.tsx`, `(app)/error.tsx`, `not-found.tsx` (root + `(app)`): branded, plain-language, Retry + back-to-dashboard. Lead 404 gets the branded not-found.
- **Empty ≠ error sweep (scoped):** shared `must(data, error)` helper; the app shell + dashboard + leads + inbox + review destructure `error` and render an inline "couldn't load — retry" block instead of fake zeros. (Full-app sweep deferred; these are the surfaces where the lie is costly.)

### R1d — Inbox optimistic echo
- Composer/thread client wrapper appends the just-sent message optimistically (pending style: "sending…" → confirmed on server revalidate), so a sent reply appears in the thread instantly. Applies to /inbox and lead-detail conversation (shared component).

**Acceptance:** click every dock tile → skeleton within one frame; approve a draft → toast; send an inbox reply → message visibly in thread immediately; kill the DB URL locally → branded error surface, not zeros; pay/cancel checkout → explicit banner.
**Help-content:** dashboard-overview + inbox articles gain a "what you'll see" line where behavior changed.

---

## R2 — Mobile + trust finish pass

**Goal:** the details that broadcast "unfinished", including both visually-confirmed mobile defects.

- **Ask-AI pill / MobileNav overlap:** pill gets `bottom-20` below `lg` (clears the bottom bar) and the open panel becomes `w-[min(400px,calc(100vw-1.5rem))]` + `max-h-[70dvh]`; verify no overlap at 390px on every surface. (`components/copilot/morph-panel.tsx:146,156` vs `dock-nav.tsx:121`.)
- **Black-box logo in mobile top bar:** root-cause `VanteraLogo` fill/currentColor on light ground (`(app)/layout.tsx:244-246`); logo must render the actual mark at 390px. Screenshot-proof.
- **Browser titles:** root layout gains `title.template = "%s · Vantera"`; every `(app)` route exports `metadata` (Results, Leads, Review, Inbox, Meetings, Brain, Settings pages…); `leads/[id]` gets `generateMetadata` → lead name. Marketing pages keep their SEO titles.
- **Confirm layer:** one shared `ConfirmDialog` primitive (shadcn AlertDialog idiom). Wire: remove teammate, "Decline & never contact" (states permanence), revoke invite, revert adoption (+ pending & result feedback), and replace the `window.confirm` on LinkedIn-account removal for consistency. Type-to-confirm (workspace delete) and inline-reveal (GDPR erase) stay as-is — they're stronger.
- **Status-semantics conflict:** lead brief must not show "Hot lead" framing on archived leads (score chip stays; the hot label/why-now framing keys off status). (`leads/[id]` header chips.)
- **Early-days goal chart regime:** when closed = $0 and pipeline < 5% of goal, the revenue card leads with milestone framing (first send → first reply → first meeting → first close, real booleans from existing data) instead of a flat $0 line under a $45k dashed goal. No invented numbers — it's the same truth, staged. (`dashboard-view.tsx` RevenueCard branch.)

**Acceptance:** 390px screenshots of dashboard/inbox/meetings show no overlap + real logo; five open tabs readable; every irreversible action confirms; archived 96-score lead reads coherently.
**Help-content:** dashboard-overview milestone note.

---

## R3 — The invite chain (multi-seat is currently inoperative)

**Goal:** an invited teammate reaches the right workspace from any starting state.

- **`?next=` honored on login:** login form carries a hidden `next` field; the action validates it (relative path, same-origin only — no open redirect) and redirects there. (`(auth)/actions.ts:34`, `login-form.tsx`.)
- **Invite page context:** server-render workspace name, inviter email, invited-address hint, and expiry state BEFORE any click; expired invites say so and dead-end gracefully. (`invite/[token]/page.tsx` + token lookup.)
- **Brand-new invitee path:** invite page offers "Create your account" → `/signup?invite=<token>`; signup with a valid invite token skips workspace creation (no company field), creates the user, accepts the invite into the inviting account as the invited role, and lands on /dashboard (gate: member of an onboarded account ⇒ no onboarding wizard). Invalid/expired token ⇒ normal signup with a notice.
- **Resend invite:** action + button on pending rows (regenerates expiry, re-sends email); pending list distinguishes expired ("expired — resend?"); the success copy that already promises "resend it" becomes true. (`settings/team/actions.ts`, `share-card.tsx:149-159`.)

**Acceptance (E2E, real flows):** logged-out existing user → invite link → login → lands on invite → member of workspace. Brand-new email → invite link → create account → member (no orphan workspace). Expired invite → clear state → resend works.
**Help-content:** team article updated.

---

## R4 — Work-at-scale kit (prod is already at 504 leads)

**Goal:** daily work at real volume: Leads, Review, Inbox.

### Leads
- Page size selector (10/25/50, URL param, default 25) + page-jump on the pager. (`leads/page.tsx:13`.)
- **Selection + bulk actions:** row checkboxes + header select-all(page); bulk bar with **Suppress** and **Archive** (both existing single-lead semantics, suppression stays the master gate). Bulk bar states count; confirm via R2's ConfirmDialog.
- **Filters:** filter popover — industry (distinct values), min score, In-market only, date sourced — as URL params composing with tabs/search. Sortable headers for Company, Worth, Last activity (URL-driven like Score).
- Default "All" tab ordering stays Newest but Filtered-out rows rank after non-filtered on equal recency (stops the wall-of-rejects first screen).

### Review
- Keyboard flow: `j/k` move, `Enter`/`a` approve, `d` decline, `e` edit, `?` hint chip in header. Focused card auto-expands.
- Replace `.limit(50)` with load-more pagination; header count and visible list can no longer disagree. (`review/page.tsx:111`.)

### Inbox
- Search (name/company) + filter chips (All / Waiting / Not interested).
- Load-more instead of the silent 600/400 caps (`conversations.ts:98,104`).
- **Mobile master/detail:** below `lg`, list OR thread with a back affordance (URL-param driven, no client router state needed).
- Unread/waiting affordance: waiting pill stays; answered/read rows visually recede.

### Dashboard consistency
- "Warm replies (this week)" KPI and the waiting panel get one denominator story: KPI relabeled "Interested this week", panel stays "waiting on you" — or KPI switches to waiting count. Decide by which the owner reads as "the number I act on" (default: relabel).

**Acceptance:** work 504-lead prod list in <5 pages at 50/page; bulk-suppress 3 test rows (verify drafts flip suppressed); clear review queue keyboard-only; find a thread by name at 390px and reply from the thread view.
**Help-content:** leads + inbox + review articles updated.

---

## R5 — Lifecycle email trio + trial communication

**Goal:** the product speaks between sessions. (Blocked on RESEND_API_KEY/FROM verified in Trigger prod — owner item; build lands dark and no-ops silently until set, same as L3.)

- **Welcome email** (on signup, transactional): what happens next (connect LinkedIn → trial starts), one CTA. No fake promises.
- **Trial-ending email** (T-2 days, cron off `trial_ends_at`, only `trialing` + no sub): honest countdown + choose-plan CTA. Skips accounts that never connected (their clock never started — different email later, not now).
- **Payment-failed dunning** (Stripe `past_due` webhook → one email + the existing banner): fix-payment CTA via portal.
- All three respect a new `lifecycle_emails_enabled` account pref (default on) surfaced beside the existing two toggles; all templates in `packages/transactional-email/src/lifecycle.ts`; senders in jobs pipeline with injected store (rule 13).

**Acceptance:** manual-trigger each against a test account (real send to owner email); dead-week/no-op paths proven; prefs toggle kills sends.
**Help-content:** notifications article updated.

---

## R6 — User-agency primitives

**Goal:** data flows back from the user: correct, annotate, add, control.

- **Edit lead:** inline edit (name, title, company) on the lead brief; client-writable columns get explicit column grants (0038→0039 gotcha — new migration with `grant update (first_name,last_name,title,company_name)`); edited leads stamp `edited_by_user_at` so drafts can prefer corrected fields.
- **Notes:** `lead_notes` table (migration + RLS same file), add/list on the lead brief Journey column, plain text, author + timestamp.
- **Manual add lead:** "Add lead" on /leads (name + LinkedIn URL + company/title optional) → `source='manual'`, suppression-checked, enters the normal qualification path (never bypasses the gate — rule 06).
- **Booking link in Settings:** Settings index gains a "Booking link" card reading/writing the same Outreach-agent config value (one source of truth; agent wizard unchanged). Dashboard task card deep-links here.
- **Email change:** profile form gains new-email flow via `supabase.auth.updateUser({email})` + confirm-email link handling on `/auth/confirm` (type `email_change`); copy explains the confirmation step.
- **Send-window visibility (copy only):** channels pacing panel gains one line stating business-hours sending in the prospect's local time.

**Acceptance:** edit a lead title and see it in the next draft's grounding; note persists; manual lead flows to scoring; booking link set from Settings appears in agent config + kills the dashboard nag; email change round-trips.
**Migrations:** `lead_notes` + lead column grants (+ `edited_by_user_at`).
**Help-content:** leads article + settings article.

---

## Explicitly deferred (named so they're decisions, not omissions)

SSO (Google/Microsoft) · 2FA/sessions · command palette (⌘K) · /help center page · meetings actions (reschedule/calendar/join) · real status page · demo scheduler embed · per-member notification prefs · saved views · CRM provider OAuth creds (owner/env) · full empty≠error sweep beyond R1c scope · `/sequence` orphan-page removal (fold into a later cleanup with conversion-token dead code).

## Sequencing & sizing

| Round | Size | Ships alone? | Depends on |
|---|---|---|---|
| R0 quick wins | XS | yes | — |
| R1 acknowledgment layer | L | yes | — |
| R2 mobile + trust finish | M | yes | R1 (ConfirmDialog uses toast for results) — soft |
| R3 invite chain | M | yes | — |
| R4 scale kit | L | yes | R2 ConfirmDialog (bulk confirm) — soft |
| R5 lifecycle emails | M | yes (dark until RESEND set) | — |
| R6 agency primitives | L | yes | — |

Recommended order: **R0 → R1 → R2 → R3 → R4 → R5 → R6.** R1+R2 kill the "feels incomplete" texture; R3 unblocks the growth loop; R4 matches the product to its own prod scale; R5/R6 round out lifecycle and agency.

Each round gets its own plan doc (`docs/superpowers/plans/2026-07-XX-<round>.md`) at build time, TDD per rule 12, owner gates each round with "go".
