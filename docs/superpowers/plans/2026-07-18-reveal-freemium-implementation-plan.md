# Reveal → Micro-demo → Freemium — implementation plan (2026-07-18)

**Design authority:** `docs/superpowers/specs/2026-07-15-reveal-freemium-growth-design.md` (GREEN-LIT v1.0).
This plan does not redesign it. It (a) records what has changed since the spec was written, (b) adds
the conversation-stage reveal sequence + an optional in-thread micro-demo, and (c) lays out the
buildable phases for F0 and the **full F2 freemium feature**.

---

## 0. Deltas since the spec (these change the build)

| # | Change | Impact |
|---|---|---|
| 1 | **Booking link is now SET** (`calendly.com/aiden-vanterasystem/30min` on the Vantera Copy agent) | Clears owner-dependency #1. **F0 is unblocked.** |
| 2 | Migrations `0058` + `0059` applied since the spec | Spec says "next free number 0058". **F2's migration is now `0060`.** |
| 3 | **`decideExperimentV2` supersedes `decideExperiment`** (enterprise-grade-brain) | ⚠️ **Gate 1 must be judged by V2.** The old gate's measured false-adoption under the null was **30.6%**; V2 is **0.6%**. Gate 1 exists to produce a trustworthy number that F2's economics rest on — judging it with the old gate would mean a ~1-in-3 chance of opening freemium on noise. |
| 4 | **`adoption_mode='auto'` is now live** (WS-3.2) | The F0 experiment can auto-adopt after the 24h grace + fresh re-verify. Decision + reason are recorded in `optimization_experiments.decision_reason`, so the Gate-1 number stays quotable either way. |
| 5 | **The Vantera account's one live experiment slot is occupied** by the A/A canary (`fdc2e044`, running clean) | ⚠️ **Owner decision required** (see §4). F0 replaces it; the spec already says F0 "replaces, not stacks on". |

---

## 1. Phase F0 — the Proof-of-Work Reveal pilot

Ships as designed in spec Part 1. No new product surface.

**F0.1 — the `disclosure` strategy knob**
- Add `disclosure: "none" | "meta_reveal"` to `CopyStrategy` (`packages/agent-brains/src/copy/shared.ts`), default `"none"`.
- Render into prompt directives via `strategyDirectives` for the first-touch and conversation brains.
- Rides the existing attribution chain unchanged: `buildSendRecipe` → `scheduled_sends.recipe` → per-arm flags → `runOptimize`.

**F0.2 — account pinning (hard boundary)**
- Honor `disclosure` ONLY when the sending account matches `app_settings.reveal_pilot_account_id`
  (admin-pin pattern, cf. `LIFECYCLE_ADMIN_EMAIL` in `lifecycle-outreach.ts`).
- Strip the knob at draft time for every other account. Paying customers' outreach must read as *them*.
- Fence the Stage-1b generator: `optimize/generate.ts` never proposes `disclosure` for non-pinned accounts.
- **Test:** a non-pinned account with `disclosure` set in its strategy produces byte-identical copy to `"none"`.

**F0.3 — linter reconciliation (required, easy to miss)**
The reveal names the product and asks a soft question inside the first DM. Today
`validateLinkedInDraft` (`copy/linkedin.ts`) raises `no-product-pitch` when the followup contains the
seller name, and `no-meeting-ask` on call/demo/15-min patterns.
- Make both checks **disclosure-aware**: exempt when `disclosure === "meta_reveal"` — and ONLY then.
- Keep every other humanizer rule in force (zero dashes, banned phrases, length caps).
- **Test:** the beat-2 reveal copy passes the full lint pass with the knob on, and still fails
  `no-product-pitch` with the knob off (proves the exemption is scoped, not a hole).

**F0.4 — the experiment**
- One `optimization_experiments` row on the Vantera account: champion = current pain-first strategy,
  challenger = same + `disclosure: "meta_reveal"`, `stage_key: "reply"` (interested-rate graded;
  booked reported alongside). Allocation via `assignVariant`, conclusion via **`decideExperimentV2`**.
- Conversation posture: threads whose recipe carries `meta_reveal` get the mirror-close directive in
  `reply/respond.ts` (existing caps, booking link at interest unchanged).
- Attribution: Vantera account `websiteUrl` gains `?utm_source=vera_reveal`.

**F0.5 — reveal timing: two thresholds, one decision**
The spec reveals in **DM 1** (after the invite is accepted). The sequence drafted in this session
reveals **after the prospect replies**. Both are "earned"; they differ only in threshold.
- **Recommendation: ship the spec's version (accept-threshold).** More volume flows through the
  reveal, so the experiment reaches a decision faster and cleaner, and it is the bolder test of the
  spec's actual thesis ("confess before detection").
- Hold the reply-threshold copy (below, already humanizer-verified) as the **fallback arm** if the
  DM-1 reveal underperforms. Do not run both at once — one live experiment per account.

---

## 2. Phase F0.5 (optional) — the in-thread micro-demo

**What it is:** upgrades the spec's mirror close from a *claim* ("it'd do this for you") to a
*demonstration* — the product runs its own loop on the prospect's ICP, in the thread.

**Build only after F0 shows the reveal earns the ask.** It is the expensive part; there is no point
paying for it until the reveal proves people say yes to the offer.

**~80% is reuse:**

| Step | Build or reuse |
|---|---|
| Parse "my ideal customer is…" → criteria | **Reuse** `prospect/derive-criteria.ts` |
| Find candidates (bounded, ~12–25, not 150) | **Reuse** prospect-data discovery |
| Qualify + produce the "why" | **Reuse** rules gate + `prospect/rank.ts` |
| Pick top 3, format for a DM | **New**, small formatter in `copy/` |
| Reveal + demo messages | **New**, small `reveal.ts` brain, humanizer-checked |

**State machine on the conversation:** `reveal_sent → demo_requested → demo_delivered` so it cannot
repeat or fire out of order.

**Non-negotiable guardrails**
- **Demo leads must be real, pulled live.** A fabricated demo lead is a fabricated-metric-class
  trust kill, and worse — they will open the profile.
- Reveal + demo messages ride the **review queue + humanizer**. Never silent-send a reveal.
- **Cost cap + rate limit:** one micro-demo per lead, capped per day. Otherwise it is a free-compute
  faucet for tire-kickers.
- Suppression checked before any demo output.

**The sequence copy** (verified: 0 violations across `validateHumanity` + `findRestartPhrases` +
`findActionClaims` + `findUnapprovedLinks`):

1. *Reveal:* "Okay, full transparency before we go further. The way I found you, qualified you, and wrote that first message? That was a system I built called Vantera. You just watched it work, on you. I approve everything before it sends, so you were always talking to a real person. The finding and the drafting were the product doing its job."
2. *Offer:* "Want to see it on your world? Tell me who your ideal customer is, one line is enough, and I'll have it surface 3 real people it would message for you, with why each one fits. Right here, no call needed."
3. *Delivery:* "Okay, it pulled three for that ICP. / [Name], [Title] at [Company], because [signal]. ×3 / Each is scored on fit and timing, and it already drafted the opener for each, waiting for a yes. That is the whole loop, running on your list."
4. *Step:* "That is Vantera. It finds them, qualifies them, drafts the message, and stays inside safe limits so your account is never at risk. If you want it running your LinkedIn, I set founding users up myself and you only stay if it is booking you real conversations. Want me to set you up, or grab 15 minutes here first: [booking]"
5. *Branches:* skeptical / not-interested / price handles as drafted.

---

## 3. Phase F2 — the full freemium feature (behind Gate 1)

Ships as ONE round per the spec. Design is spec §3; this is the build order.

**F2.1 — migration `0060`**
- `accounts.plan` check constraint extended with `'free'`.
- `accounts`: `tithe_consent_at timestamptz`, `tithe_consent_version text`, `tithe_consent_user_id uuid`
  (server-action-written → **no client column grants**; run the column-grant audit per the 0038→0039 lesson).
- `campaigns.is_tithe boolean not null default false`.
- `tithe_assignments`: id, `lead_id`, `linkedin_url_normalized`, `sender_account_id`, `status`
  ∈ `assigned|drafted|sent|replied|interested|booked|suppressed|expired`, timestamps.
  **Global unique index on `linkedin_url_normalized`** (one Vantera intro per human, ever, across all senders).
  RLS in the same migration + guardrail test in `packages/db/src/schema.test.ts`. Retention: prune
  unconverted after 12 months.
- **Prod trigger note:** `plan` is display-worthy → add to the auth-metadata sync trigger's `UPDATE OF`
  list (the 2026-07-09 MCP-applied trigger, not in repo migrations). Consent columns are not display-worthy.
- `app_settings` keys (no schema change): `tithe_enabled`, `tithe_source_account_id`, `free_seats_cap`, `reveal_pilot_account_id`.

**F2.2 — plan model + entitlements**
- New `"free"` tier in `PlanTier` (`packages/billing/src/plans.ts`): 1 seat, 1 LinkedIn sender,
  2 campaigns, `features.intent: false`, no Stripe price ids.
- `isEntitled(snapshot) = isActive(status) || plan === 'free'` in `packages/billing/src/entitlements.ts`;
  `resolveEntitlements` returns free limits for `plan==='free'` instead of `EMPTY`.
- **Audit every `hasActivePlan` call site** (`apps/web/src/lib/billing/entitlement.ts` + consumers)
  to route through the new predicate. This is the highest-risk refactor in F2 — a missed call site
  either locks free users out or opens paid features to them.
- COGS bounds in `packages/jobs/src/pipeline/types.ts`: `FREE_DISCOVERY_WEEKLY = 100`, and pause
  sourcing while the account's unworked qualified pool ≥ 40.

**F2.3 — the fork panel ("two doors, one default")**
- Shared client gate wrapping every first-connect CTA (consumers of `createLinkedInConnectLink`:
  `channels-forms.tsx`, `dashboard-view.tsx`, the app-shell nudge, onboarding connect step).
- Shown ONCE, iff ALL: `subscription_status='trialing'` AND `trial_ends_at IS NULL` AND no door chosen
  AND member is owner/admin. **Never** on reconnect, never for invited members, never after a choice.
- Door 1 (pre-selected): 7-day All-Access trial → **no writes** (existing idempotent clock-stamp fires untouched).
- Door 2: Free → server action sets `plan='free'`, `subscription_status='none'`, `tithe_consent_*`;
  the trial writers' guard then fails naturally so no clock starts.
- Trust line must read **"Your own outreach never sends without your approval."** (Door 2's auto-send
  nature is disclosed in its own copy + checkbox, never hidden.)
- Grandfathering is automatic — existing accounts never match the condition.

**F2.4 — the tithe engine**
- Source pool: ops account pinned via `tithe_source_account_id`; its Scout sources Vantera-ICP leads
  on Vantera's spend. Sizing: 20 × consenting free accounts, 2× buffer.
- Distributor: `packages/jobs/src/pipeline/tithe-distribute.ts` + thin trigger wrapper, weekly.
  Assign ≤ `TITHE_WEEKLY_SHARE = 20`/account, excluding prior assignments (unique index), BOTH
  suppression lists, anyone in the sender's own `leads`, and any connected Vantera user.
  **⚠️ Do NOT add a new `schedules.task`** — Trigger is at 10/10 quota; piggyback the scheduler tick
  with an idempotence stamp (established pattern).
- Sending: one hidden system campaign per free account (`is_tithe`, `send_mode='automatic'`),
  excluded from campaign counts/limits and the user's review queue. Drafts via `copy-draft.ts` with
  `disclosure: "tithe_reveal"`.
- **Pacing:** tithe allocates INSIDE the sender's existing `inviteBudget`, capped at 20, ≤20% of
  allowance during ramp. **User sends always dequeue first.**
- Replies land on the user's LinkedIn → `inbound.ts`; `is_tithe` threads handled in auto mode with
  Vantera's proof points + booking link (`?utm_source=vera_intro`). `needs_human` routes to the ops
  admin, never the user's queue. `not_interested`/`unsubscribe` writes the sender-account suppression
  AND marks the assignment `suppressed` globally.
- Transparency surface: read-only "Vantera intros" tab + weekly meter ("14 of 20 sent this week").
- Kill switches: `tithe_enabled` app-setting; upgrading to paid stops tithe instantly (assignments
  `expired`, campaign paused).

**F2.5 — upgrade arrows (four, not one)**
Free→Paid (checkout at desire peaks: capacity meter + win moments) · Free→Trial (once, guard
`trial_ends_at IS NULL`) · Trial→Free at expiry (with consent flow — consent required at conversion,
never implied) · Paid→Free on cancel (billing lapsed state offers the free door).

**F2.6 — pricing surfaces**
Landing `pricing.tsx` + `/pricing` + in-app `pricing-plans.tsx`: three doors (Free / All Access $79 /
Enterprise). Free card states the deal exactly. `PLAN_DISPLAY` gains `free`, derived from `PLANS.free`.

**F2.7 — knowledge-sync (rule 09, same PR)**
Billing/plans article updated for free tier + fork panel; NEW "The free plan and Vantera intros"
article; channels article updated for the intros tab; copilot read tool for tithe meter/counts.

---

## 4. Gates, sequencing, owner decisions

**Sequencing:** F0 → (read Gate 1) → F2. F1 (texture knobs) is independent and may ship in parallel.
F0.5 micro-demo is optional and gated on F0 showing the reveal earns the ask.

**Gate 1 (opens F2):** F0 experiment concluded by **`decideExperimentV2`** with the reveal arm ≥
champion on interested rate; booked count reported alongside; number recorded in `decision_reason`.
Plus `free_seats_cap` set.

**Harm circuit breaker:** if tithe interested rate is materially below the F0 reveal arm after 200
sends, halt via `tithe_enabled`. Free users' account-safety budget is real spend — do not burn it on
a non-converting message.

**Owner decisions / dependencies**
1. ⚠️ **The A/A canary vs F0 slot conflict.** The canary is currently the live proof that the stats
   engine does not hallucinate winners. Options: (a) let the canary conclude first, then start F0
   (safest, slower), or (b) replace it now (faster read, loses the running null-check). **Recommend (a)**
   unless speed matters more than the safety instrument — the canary is cheap to leave running and
   F2's economics hang on Gate 1 being trustworthy.
2. **RESEND creds in Trigger prod** — still required; ops notifications (tithe `needs_human`,
   distributor alerts) are silent without them.
3. **Sign-off numbers:** `free_seats_cap` launch value (spec default 25) and the final read of the two
   consent-copy strings before they freeze as `TITHE_CONSENT_V1`.

## 5. Risks

- **Entitlement refactor blast radius** (F2.2) is the most dangerous change in this plan — every
  `hasActivePlan` consumer must be audited, with tests for free/trial/paid/canceled.
- **Endorsement risk** is the fatal one if disclosure copy ever weakens: every tithe message must
  read fine screenshotted publicly. Keep the screenshot test.
- **Per-seat COGS at N=0 is unknown** — `free_seats_cap` is the only thing bounding exposure. Do not
  raise it before cost-per-free-seat is measured against attributed signups.
- **Prod AI runs on the same Anthropic workspace as CI** — a dry balance silently stalls the tithe
  engine exactly like it stalled Scout. The low-balance alert is still unbuilt.
