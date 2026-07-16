# The Reveal + Freemium Tithe — growth design spec

**Status: GREEN-LIT v1.0 (2026-07-15, owner approval). Supersedes the DRAFT of the same
name/date — the draft's analysis is preserved below as rationale; everything here is now
buildable. Revisit by name: "reveal-freemium-growth".**

Method: YC-head-executive comparison/optimization (standing directive). Grounded in the live
codebase and prod state; every mechanism below names the real file/symbol it extends.

**The unifying insight:** all three parts are one idea at three scales — *the message is the
demo*. From the founder's account it's a sales methodology (Part 1); generalized it's a copy
philosophy the bandit can learn (Part 2); baked into freemium it's a growth loop where usage
itself is distribution (Part 3) — Loom-watermark / "Sent via Superhuman" mechanics, applied to
the one category where the recipient experiences the product in the act of reading the pitch.

**What it attacks (conversion audit 2026-07-13):** both provable drop-offs — traffic (every
freemium user is a distribution channel) and activation (no 7-day cliff; expired trials get a
landing pad instead of dying).

---

## Sequencing — three rounds, two gates (the spine)

| Round | Ships | Gate to ship |
|---|---|---|
| **F0 — Reveal pilot** | Vantera-account-only experiment: meta-reveal challenger vs. pain-first champion | None — ships immediately. Owner dependency: his booking link must exist first (the mirror close books meetings). |
| **F1 — Texture knobs** | De-robotization knobs join the Stage-1b recipe space + two new deterministic lints | None — independent of F0's outcome; can ship in parallel. |
| **F2 — Freemium** | Free plan tier + fork panel + tithe engine + upgrade arrows + pricing surfaces, as ONE round | **Gate 1:** F0's experiment concluded by `decideExperiment` with the reveal arm ≥ champion on reply/interested (the "real conversion number" — the tithe uses the same copy structure, so this number IS the tithe's forecast). Plus `free_seats_cap` set (economics bound). |

A one-door panel is pure friction — never ship the fork panel without the free door, and never
open the free door without Gate 1's number. The founder-account pilot IS the freemium pilot
(same copy structure, same disclosure, same conversion question, N=1 account): do things that
don't scale, then scale.

---

## Part 1 — The Proof-of-Work Reveal (F0: Vantera-account pilot)

**Problem:** Vantera has no borrowable proof (no case studies, ~zero external MRR). The
disclosure play converts that weakness into self-verifying proof: *"you read this far, and a
machine wrote it."* Confess before detection — pre-empts the smell-a-template objection.

**Why not "lead with the disclosure":** line one becomes the sender's agenda — still a pitch.
The reveal has force only AFTER the message has passed as human.

### The three beats (mapped onto the existing invite → first DM → conversation sequence)

1. **Earn** (invite / opening observation): one researched, specific, them-only observation.
   The most human play (`pain-first` / `trigger-opener` quality bar), zero product mention.
   This beat is what the reveal grades.
2. **Reveal** (first DM, inside the existing 180-char/28-word first-DM cap — compliant copy,
   ~145 chars): *"honest one — an AI read your post on X, decided you fit, and wrote this.
   it's my product (Vantera). you just sat through the demo. worth a look?"*
3. **Mirror** (conversation + interest check): the reply thread is demo #2; the close is the
   mirror — *"it just did for me what it'd do for you: found a qualified buyer and started a
   real conversation. want it pointed at your ICP?"* Booking link at interest rides the
   existing engine (`allowedConversationLinks` in `packages/agent-brains/src/reply/respond.ts`).

### Implementation shape (zero new product surface)

- **New `CopyStrategy` field** `disclosure: "none" | "meta_reveal"` (default `"none"`) in
  `packages/agent-brains/src/copy/shared.ts`, rendered into prompt directives by
  `strategyDirectives` for both the first-touch and conversation brains. It is a strategy
  knob like `openerAngle`, so it rides the entire existing attribution chain for free:
  `buildSendRecipe` → `scheduled_sends.recipe` (0049) → per-arm flags → `runOptimize`.
- **Account pinning (hard):** `disclosure` is only honored when the sending account matches
  the `reveal_pilot_account_id` key in `app_settings` (same admin-pin pattern as
  `LIFECYCLE_ADMIN_EMAIL` in `packages/jobs/src/pipeline/lifecycle-outreach.ts`). For every
  other account the knob is stripped at draft time — paying customers' outreach must read as
  *them*, never as Vantera. This boundary also fences the Stage-1b generator: `generate.ts`
  never proposes `disclosure` for non-pinned accounts.
- **The experiment:** one `optimization_experiments` row on the Vantera account —
  `champion_strategy` = current pain-first champion, `challenger_strategy` = same + 
  `disclosure: "meta_reveal"`, `stage_key: "reply"` (interested-rate is the graded outcome;
  booked is recorded and reported alongside). Allocation via the existing deterministic
  `assignVariant` (`packages/agent-brains/src/optimize/allocate.ts`); conclusion via
  `decideExperiment` (`optimize/decide.ts`) inside `runOptimize` — instrument, don't argue.
  Respect the one-live-experiment-per-account constraint: this replaces, not stacks on,
  whatever experiment the Vantera account is currently running.
- **Conversation posture:** when the thread's recipe carries `disclosure: "meta_reveal"`,
  `respond.ts` gets a mirror-close directive (demo-#2 framing, existing 320-char/60-word
  caps, booking link at interest unchanged).
- **Lint interplay:** the humanizer's avoid-phrases and `validateRecipeAngle` must not flag
  the confession — the reveal directive is a strategy field, not an angle string; add an
  explicit test that the beat-2 copy survives the lint pass.
- **Attribution:** the Vantera account's `websiteUrl` context link gains
  `?utm_source=vera_reveal` so GA4/Meta can tie signups to the pilot.

---

## Part 2 — Generalizing to platform copy (F1: de-robotization)

**Boundary (hard rule, restated):** the disclosure does NOT generalize to paying customers.
It belongs to exactly two senders: the pinned Vantera account (Part 1) and the freemium tithe
sends (Part 3). Everything else in Part 2 applies to all accounts.

**The robotic tells** (still present despite humanizer/length caps/avoid-phrases):
- Any sentence that could live on a landing page ("we help X do Y without Z").
- Completing the whole sale in one message (pitch + credibility + CTA = cold-call script).
- Perfection itself: balanced clauses, complete sentences, the "X, Y, and Z" tricolon.
- Symmetric courtesy ("Hope you're doing well" + formal sign-off).

### What ships

Two new **recipe knobs** (in `CopyStrategy`, generated by `optimize/generate.ts`, gated by
`angle.ts`-style validators, explored by the Stage-1b bandit — extend `strategySignature` in
`bandit.ts` so aggregation sees them):

1. `texture: "polished" | "fragmented"` — fragmented permits sentence fragments,
   contractions, uneven rhythm; bans the tricolon in the directive.
2. `openerShape: "observation_question" | "freeform"` — observation_question enforces
   one-thought-per-message: first touch = observation + light question; interest-check
   vocabulary IS the CTA ("worth a look?", "off base?").

Two new **deterministic lints** (join the humanizer lint set that already routes flagged
drafts to review):

3. **Them-to-you ratio** — count prospect-references vs. sender/product-references; a first
   touch must be lopsidedly *them* (launch threshold: sender/product refs ≤ 1 in beat-1
   copy). Lintable, and its pass/fail lands in `styleFlags` so it's learnable.
4. **Tricolon ban** — flag "X, Y, and Z" three-item lists in first touches.

**Message-as-proof** (every sentence recipient-verifiable, delete anything merely assertable)
stays a prompt-level principle in the copy brains' system directives — it is not
deterministically lintable, so it does not pretend to be a lint.

The strategic point stands: the platform *learns* toward human via the bandit instead of
being prompted toward it once.

---

## Part 3 — Freemium tithe + fork panel (F2, one round, behind Gate 1)

**The deal:** Free plan = 80 of the ~100 weekly LinkedIn sends are the user's; up to 20 run
Vantera's own disclosed introductions from the user's account. The currency is elegant:
users pay with LinkedIn send capacity — the one asset they have and Vantera lacks. Nobody in
the category does capacity-tithe freemium.

### 3.1 The four failure modes and their fixes (design invariants)

1. **Endorsement problem (fatal if ignored):** an undisclosed promo from a user's account
   reads as their endorsement. **Fix: the disclosure IS the feature.** Tithe sends use the
   Part-1 structure honestly adapted: *"this conversation was started by Vantera, an AI
   lead-gen system — I'm on its free plan, and part of the deal is it gets to introduce
   itself."* The only version that survives a screenshot on X.
2. **Risk asymmetry:** the weekly ceiling is the USER's safety budget. Tithe comes OUT of
   quota (20 of 100, never on top), identical pacing/ramp envelope, explicit consent at the
   fork (timestamp + copy version stored — the legal consent record).
3. **Targeting collision:** tithe targets are NEVER drawn from the user's prospect pool —
   Vantera's ICP, sourced on Vantera's own discovery spend; the user's account is the
   sending channel only. Their 80 stay 100% theirs.
4. **Economics unknowable at N=0:** every free seat carries real per-seat vendor cost
   (LinkedIn connection) + discovery/AI spend. **Fix: `free_seats_cap`** (launch value 25,
   `app_settings` key) bounds exposure until the unit economics are measured; at cap, the
   free door shows waitlist copy instead.

### 3.2 Plan model

- **New tier `"free"`** added to `PlanTier` (`packages/billing/src/plans.ts`) and to the
  `accounts.plan` check constraint (extends the 0013 set `none/starter/growth/scale`; new
  migration). Free config: 1 seat, 1 LinkedIn sender, 2 campaigns, `features.intent: false`,
  no Stripe price ids.
- **Entitlement rule:** a free account has NO Stripe subscription — `subscription_status`
  is `'none'`. Introduce `isEntitled(snapshot) = isActive(status) || plan === 'free'` in
  `packages/billing/src/entitlements.ts`; `resolveEntitlements` returns free limits for
  `plan === 'free'` instead of `EMPTY`. Audit every `hasActivePlan` call site
  (`apps/web/src/lib/billing/entitlement.ts` + consumers) to route through the new predicate.
- **New `accounts` columns:** `tithe_consent_at timestamptz`, `tithe_consent_version text`,
  `tithe_consent_user_id uuid` (the consent record). No `trial_used` column needed —
  `trial_ends_at IS NULL` already encodes "trial never started" (see 3.5).
- **Free-plan COGS bounds** (siblings of `TRIAL_LEAD_CAP = 100` / `TRIAL_SEND_CAP = 50` in
  `packages/jobs/src/pipeline/types.ts`): `FREE_DISCOVERY_WEEKLY = 100` (Scout sourcing pace)
  and a buffer stop — pause sourcing while the account's unworked qualified pool ≥ 40.
  Launch values; tunable constants, not DB config.

### 3.3 The fork panel — "two doors, one default" (choose-then-connect)

**Why before connect:** trial-on-connect quietly created hesitation — "connecting spends my
7 days, I'll wait." The free door removes that exact fear, so the fork must be shown before
the commitment.

**Placement:** a shared client gate wrapping every first-connect CTA (the consumers of
`createLinkedInConnectLink` in `apps/web/src/app/(app)/settings/channels/actions.ts`:
`channels-forms.tsx`, `dashboard-view.tsx`, the app-shell nudge in `(app)/layout.tsx`, and
the onboarding wizard connect step). Shown ONCE, iff ALL of: `subscription_status =
'trialing'` AND `trial_ends_at IS NULL` (i.e. pre-first-connect, not grandfathered) AND no
door chosen yet AND the member is owner/admin. **Never** on `createLinkedInReconnectLink`
(reconnect-in-place), never for invited members, never again after a choice.

**Display:**
- Header: "Connect LinkedIn to put Vera to work." Subline: "Pick how you start — you can
  switch anytime." (Gain-framing replaces clock-framing.)
- **Door 1 (pre-selected, primary): 7-day All-Access trial** — "Everything unlocked. All
  100 weekly prospects are yours. $79/mo after — cancel anytime, your data stays."
- **Door 2: Free plan** — "Free forever. 80 of your 100 weekly prospects are yours; Vera
  introduces Vantera to the other 20 — honestly disclosed, sent from your account inside the
  same safety limits, and handled by Vera end-to-end." + consent checkbox ("I'm OK with up
  to 20 disclosed intros per week from my LinkedIn — they send automatically; that's the
  free plan's price").
- One primary button: "Connect LinkedIn →" (executes the selected door, then proceeds to
  the existing hosted-auth link). Default path = one tap, zero extra decisions.
- Trust line (**honesty fix** — the draft's "Nothing sends without your approval either
  way" was false for door 2): **"Your own outreach never sends without your approval."**
  Door 2's auto-send nature is disclosed in its own copy + checkbox, not hidden.

**Semantics:**
- **Door 1 (trial):** no writes — the existing idempotent clock-stamp at first active
  connect (`upsertLinkedInAccountStatus` in `packages/jobs/src/pipeline/pg-store.ts` +
  `reconcileLinkedInAccounts` in `apps/web/src/lib/linkedin/sync.ts`, both guarded on
  `subscription_status='trialing' AND trial_ends_at IS NULL`) fires untouched.
- **Door 2 (free):** server action sets `plan='free'`, `subscription_status='none'`,
  `tithe_consent_at=now()`, `tithe_consent_version=TITHE_CONSENT_V1`,
  `tithe_consent_user_id=auth.uid()` — the trial writers' guard then fails naturally (status
  no longer `trialing`), so no clock ever starts. Then proceeds to hosted auth.
- **Grandfathering is automatic:** every existing account has `trial_ends_at` set or an
  active/canceled sub, so the panel condition never matches them.

### 3.4 The tithe engine (the new machinery)

- **Source pool:** the Vantera ops account (pinned via `app_settings` key
  `tithe_source_account_id`). Its own Scout sources and qualifies Vantera-ICP leads on
  Vantera's discovery spend through the existing pipeline — no new sourcing code. Sizing:
  distributor demand (20 × consenting free accounts per week) with a 2× sourcing buffer.
- **New table `tithe_assignments`:** id, `lead_id` (FK → the ops account's `leads` row),
  `linkedin_url_normalized` (denormalized), `sender_account_id` (the free workspace),
  `status` ∈ `assigned | drafted | sent | replied | interested | booked | suppressed |
  expired`, timestamps. **Global unique index on `linkedin_url_normalized`** — one Vantera
  intro per human, EVER, across all senders (cross-account dedupe). RLS: service-role
  writes; members of `sender_account_id` get SELECT on their own rows (the transparency
  surface). Retention: prune unconverted assignments after 12 months (rule 11).
- **Distributor** (new pipeline, rule-13 skeleton: core in
  `packages/jobs/src/pipeline/tithe-distribute.ts`, thin trigger wrapper, weekly cron):
  per consenting free account with an active sender, assign up to `TITHE_WEEKLY_SHARE = 20`
  targets from the ops pool, excluding: any prior assignment (the unique index), ops-account
  AND sender-account suppression (`isSuppressed`, checked again at draft + dispatch),
  anyone already present in the SENDER's own `leads` (collision rule 3.1.3), and any
  connected Vantera user (by `linkedin_accounts` profile URL — never pitch existing users).
- **Sending rides the existing machinery unchanged:** each free account gets one hidden
  system campaign (`campaigns` row, new column `is_tithe boolean default false`,
  `send_mode='automatic'`, `copywriting_mode='agent'`) — excluded from campaign counts,
  campaign limits, and the user's review queue. Drafts flow through `copy-draft.ts` (which
  already checks suppression before every draft) with strategy `disclosure:
  "tithe_reveal"` — same beats as Part 1, first person adapted to the free-plan framing;
  recipe stamps give tithe sends full send→outcome attribution for free.
- **Pacing (risk asymmetry, enforced):** `send-dispatch.ts` allocates tithe sends inside
  the sender's existing `inviteBudget` (`sender-assignment.ts` — `min(dailyAllowance,
  LINKEDIN_WEEKLY_INVITE_CEILING − last7d)`), capped at `TITHE_WEEKLY_SHARE`; during ramp,
  tithe takes at most 20% of that week's allowance. **User sends always dequeue first** —
  tithe fills remaining allowance, never crowds the user's 80.
- **Replies:** physically land on the user's LinkedIn (existing Unipile webhook →
  `inbound.ts`). A thread whose campaign `is_tithe` is handled by Vera in auto mode with
  the reveal posture, **Vantera's** proof points and **Vantera's** booking link (context
  loaded from the ops account, not the sender's `proof_points`), link carrying
  `?utm_source=vera_intro`. `needs_human` on a tithe thread routes to the Vantera ops admin
  (email via the existing `notifyLeadEvent` machinery), never into the user's queue.
  `not_interested`/`unsubscribe` writes BOTH the sender-account suppression (existing
  `STOPS_SEQUENCE` behavior) and marks the assignment `suppressed` globally.
- **Transparency surface:** a read-only "Vantera intros" tab (on `/inbox` or the channels
  page) listing the account's tithe threads + a weekly meter ("14 of 20 intros sent this
  week"). Users see everything sent in their name; they just don't have to work it.
- **Kill switches:** global `tithe_enabled` in `app_settings` (sibling of
  `outreach_kill_switch`); upgrading to any paid plan stops tithe instantly (assignments
  `expired`, campaign paused). There is no "keep free, pause intros" state — the tithe is
  the free plan's price.

### 3.5 Upgrade at any time — four arrows, not one

- **Free → Paid:** one click into the existing checkout (`settings/billing/pricing-plans.tsx`),
  surfaced at desire peaks: the capacity meter ("80 of 100 yours — unlock all 100") and win
  moments (first interested reply, first booking — the existing celebration surfaces).
  Peak-end rule. Stripe webhook → `applySnapshot` flips the plan; tithe stops instantly.
- **Free → Trial:** ONCE per account, startable anytime — guard is simply
  `trial_ends_at IS NULL`. Starting it stamps the clock immediately (already connected):
  `plan='growth'`, `subscription_status='trialing'`, `trial_ends_at=now()+7d`. At expiry it
  falls back to free (consent already on record), not to a dead account.
- **Trial → Free:** at expiry, the dead-end becomes the downgrade offer — the trial-expiry
  path + billing page + lifecycle email offer the free door WITH the consent flow (they
  haven't consented yet; consent is required at conversion, never implied).
- **Paid → Free on cancel:** when the Stripe webhook lands `canceled`, the billing page's
  lapsed state offers "switch to Free" (with consent flow) instead of only the exit.

**Paid must beat free by more than 20 prospects:** paid = all 100 + NO tithe + Intent agent
+ team seats + CRM push + multi-sender. The tithe is the free plan's price; exclusivity is
part of what $79 buys.

### 3.6 Pricing surfaces

- Landing (`components/landing/pricing.tsx`) + `/pricing` (`marketing-pricing.tsx`) + in-app
  billing (`pricing-plans.tsx`): three doors — **Free** (tithe disclosed in plain language on
  the card), **All Access $79** (highlight, unchanged), **Enterprise** (unchanged). The free
  card is the traffic weapon — it must state the deal exactly ("Vera sends up to 20 disclosed
  Vantera intros a week from your account — that's the price").
- `PLAN_DISPLAY` gains the `free` entry with capacity bullets derived from `PLANS.free`
  (the existing no-drift rule in `display.ts`).

---

## Data model summary (one migration at F2 build time; next free number as of writing: 0058)

1. `accounts.plan` check constraint extended with `'free'`; columns `tithe_consent_at`,
   `tithe_consent_version`, `tithe_consent_user_id` (+ column-grant audit per the 0038→0039
   lesson — these are server-action-written, so no client grants).
2. `campaigns.is_tithe boolean not null default false`.
3. `tithe_assignments` (shape + RLS + retention note in 3.4) — RLS in the same migration,
   guardrail test in `packages/db/src/schema.test.ts`.
4. `app_settings` keys (no schema change): `tithe_enabled`, `tithe_source_account_id`,
   `free_seats_cap`, `reveal_pilot_account_id` (F0).
5. Prod trigger note: new display-worthy `accounts` columns must be added to the
   auth-metadata sync trigger's UPDATE OF list (2026-07-09 MCP-applied trigger) — plan
   choice is display-worthy; consent columns are not.

## Metrics & decision gates

- **Gate 1 (opens F2):** F0 experiment concluded; reveal arm ≥ champion on interested rate
  (`stage_key: "reply"`), booked-meeting count reported alongside. Recorded in
  `optimization_experiments.decision_reason` — the number is quotable.
- **Tithe health (per week, from recipe-stamped sends + `tithe_assignments`):** sent →
  replied → interested → booked → signup (utm-attributed). North star: signups per 100
  tithe sends.
- **Freemium funnel:** free activations, free→trial, free→paid, trial-expiry→free
  resurrection rate, cost per free seat (vendor + discovery + AI spend vs. attributed
  signups).
- **Harm circuit breaker (analog of `decideExperiment`'s):** if tithe interested rate is
  materially below the F0 reveal arm after 200 sends, halt via `tithe_enabled` and
  re-examine copy — the free users' account safety spend is real; don't burn it on a
  non-converting message.

## Compliance, honesty, safety

- **Suppression before every tithe draft AND at dispatch** (rule 11) — ships with the test
  proving a suppressed lead is never drafted or sent to (both sender-account and ops-account
  lists).
- **Consent is explicit, versioned, and stored** (checkbox + `tithe_consent_*` columns).
  Consent copy changes bump `TITHE_CONSENT_V1` → v2 and require re-consent.
- **Honesty contract:** the disclosure copy states only facts; the trust line never claims
  approval-gating for tithe sends; no fabricated numbers anywhere on the fork panel or
  pricing cards. Screenshot test: every tithe message must read fine posted publicly.
- **Safety envelope:** tithe sends live inside the same `safety-limits.ts` ceilings, ramp,
  and jitter as user sends — 20-of-100 out of quota, never on top (3.4 pacing).
- **Voice:** Vera "gets smarter"; no she/her in any new surface copy.

## Knowledge-sync & definition of done (per rule 09/12)

- F0/F1: no user-facing surface change → no article; experiment visibility rides the
  existing What's-working panel.
- F2: help articles in the same PR — billing/plans article updated for the free tier +
  fork panel; a new "The free plan and Vantera intros" article (what sends, when, the meter,
  how to stop it = upgrade); channels article updated for the intros tab. Copilot tools:
  read tool for tithe meter/assignment counts.
- Full gate (`pnpm lint && type-check && test && build`) per round; live-proof after
  promote (Vercel pin gotcha is ACTIVE — every ship ends with a promoted-domain proof).

## Owner dependencies (blocking, his)

1. **Booking link** — F0's mirror close and every tithe conversation book onto HIS calendar.
   Still null on all accounts; F0 cannot ship without it.
2. **RESEND creds in Trigger prod** — ops notifications (tithe `needs_human`, distributor
   alerts) are silent without them.
3. **Sign-off numbers:** `free_seats_cap` launch value (spec default 25) and the final read
   of the two consent-copy strings before they become `TITHE_CONSENT_V1`.

## Out of scope (named, deferred)

- Disclosure for paying customers (never — hard boundary).
- A dedicated tithe-ops inbox surface (ops volume at cap-25 fits the admin email +
  ops-account `/inbox`; build a surface when volume demands it).
- Per-user tithe scheduling preferences, tithe on additional senders (free = 1 sender).
- Annual/paid variants of free (there is exactly one free shape).
