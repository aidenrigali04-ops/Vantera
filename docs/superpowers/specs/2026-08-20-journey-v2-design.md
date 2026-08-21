# Journey v2 — value-before-payment funnel (master design + Phase 16)

> **Superseded 2026-08-20 (same day).** The owner replaced this journey with the frictionless onboarding (Details → LinkedIn → Subscription → dashboard; card required, trial after; ICP auto-derived from the website scan). The `/start/*` and `/reveal` routes were removed; the `fast-pass` pipeline, `reveal_runs`, `resolveStartStep`, and `lib/reveal/*` remain in the tree for reuse. Roadmap: Phase 16b.


**Status:** Phase 16 built 2026-08-20 · Phases 17–23 sequenced below
**Source:** owner's "Vantera Redesign Blueprint v2" (2026-08), adapted to locked repo rules.
**Prime directive:** the marketing landing page is FROZEN — the journey change never touches
`components/landing/` or `app/page.tsx`; the eventual `/signup → /start` cutover is a
next.config redirect (Phase 17).

## The inversion

Old: signup (password + email-confirm) → onboarding → agents auto-deploy → dashboard → connect
LinkedIn in settings. New: **claim (email → instant session) → business → buyers (real ICP
criteria) → LinkedIn connect → the Reveal (live pre-payment scan of the user's real pipeline)
→ open the queue.** The aha is engineered: `reveal_runs` stamps `first_match_at` /
`full_draft_at` (SLO targets: ≤60s / ≤3min once live discovery latency is measured).

## Owner decisions (locked this cycle)

1. Master plan + Phase 16 build now; later phases via the normal rule-12 cycle.
2. **White-label stands** — custody copy describes the mechanism ("your password never
   touches Vantera"), never a vendor name. Blueprint's Unipile-naming rejected.
3. **Pricing v2 adopted in Phase 17** — $99/mo single plan + $49/sender, 14-day money-back,
   trial retired. Phase 16 runs on the existing trial (the wall is Phase 17's job).

## Blueprint-vs-repo adaptations (repo truth wins)

- Safety numbers: ~100 invites/week (rules 04/11), never the blueprint's 80/day.
- Scores: real `ai_score` + rationale + insights; no fabricated fit/intent/reachability
  decomposition until the rank brain emits one.
- Agents architecture (rule 13) stays; "Engine/Playbook" are v2 vocabulary on new surfaces.
- Legacy `/signup` + `/onboarding` untouched during the strangler window; `resolveGate`
  byte-identical (the /start chain has its own pure sibling `resolveStartStep`).

## Phase 16 — what shipped

**Claim (`/start`):** `admin.createUser({email_confirm:true})` → `admin.generateLink(magiclink)`
→ server-side `verifyOtp` on the SSR client (mints cookies) → `create_account` (name guessed
from the email domain; the DB-default trial starts here, which is what makes pre-payment
drafting legal). Existing email → NO session; sign-in link + the §4.1 notice (`/start?sent=1`).
Rate limits `startClaim` 5/10m/IP + `startClaimEmail` 3/1h. Resume email via
`transactional-email/start-link` (product notification).

**Gate:** `lib/auth/start-gate.ts` — pure `resolveStartStep`/`resolveStartGate` + tests;
context from `lib/auth/start-context.ts` (businessConfirmed = website_url OR described-offer
scan; icpConfirmed = icps row source='onboarding'; linkedinConnected includes 'connecting').

**Buyers (`/start/buyers`):** chip card (who/where/why-now/never) writes REAL
`icps.criteria` (first structured targeting — the rules gate consumes it) and provisions the
internal campaign (**send_mode:'review' pinned** — the invariant that makes pre-payment
drafting safe) + the LIVE copy agent. The scout is deliberately NOT provisioned (no cron
discovery pre-queue).

**Connect (`/start/linkedin`):** promise block → hosted-auth link (settings action minus the
plan gate, capped at ONE pre-payment sender) → `?connected=1` runs `reconcileLinkedInAccounts`
+ `maybeStartFastPass` → `/reveal`.

**Fast pass (`packages/jobs/pipeline/fast-pass.ts` + trigger task `fast-pass`):** agent-less
capped scan (≤50 evaluated · trial-headroom clamp · minScore 70) reusing the Scout's stages
and the EXISTING `runCopyDraft` inline for the top-5 (suppression-tested path; idempotent
retries). Stage-by-stage patches to `reveal_runs` (migration 0038; UNIQUE(account_id) is the
enqueue-once guard; failed runs reset in place).

**Reveal (`/reveal` + `/api/reveal/status`):** 2s poll; `buildRevealStatus` (pure, tested)
enforces ≤15 surfaced matches and exactly ONE draft body (top-scored invite). Identities,
scores, and evidence fully shown — the lock is on depth, never truth. CTA `Open my queue` →
`openQueue` action: scout-only provisioning (reuses the ICP/campaign/copy rows — running the
legacy goLive would violate `agents_account_kind_unique`) + `onboarding_completed_at` →
`/review`.

## Phases 17–23 (sequenced; each gets its own rule-12 cycle)

| Phase | Content |
|---|---|
| 17 | The wall: $99/$49 single-plan billing restructure, trial retirement, subscription gate on `/app`, unlock transition, deep-pass on payment, `/signup`→`/start` redirect, day-7 held-pipeline lifecycle + pre-payment cost caps |
| 18 | Approvals rebuild: keyboard-first A/E/G/R, undo toast, regenerate with steer, reject reasons |
| 19 | Reply-halt on ANY reply (today only hard-negatives cancel sends) + the Inbox (threads, classification, suggested replies) |
| 20 | Today dashboard + six-item nav + engine strip |
| 21 | Prospects stages + Playbook (Profile / Sequence / Message rules; ICP editing on real criteria) |
| 22 | Lifecycle email (template layer in transactional-email; renegotiate its product-notifications-only scope) |
| 23 | Billing completeness (in-app sender add, dunning, pause) + states/polish gate |

## Known Phase 16 seams (deliberate)

- The Reveal CTA opens the queue on the TRIAL (no payment) — the wall replaces this in 17.
- ICP chips are manually entered; auto-drafting them from the website scan needs an
  icp-drafter brain (rule-13 skeleton) — fast-follow.
- `tasks.trigger` requires the Trigger.dev dev server locally; without it the Reveal sits at
  "queued" (maybeStartFastPass fails soft).
- Dev discovery uses the seeded 40-candidate pool (no APIFY env) — the walkthrough works
  end-to-end without credentials.
