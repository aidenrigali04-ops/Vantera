# Activation UX — closing the gap the Gojiberry teardown exposed

- **Date:** 2026-10-21
- **Owner:** Aiden
- **Status:** DRAFT — pending owner approval (brainstorm output; no product code written)
- **Inputs:** owner's live Gojiberry teardown (2026-10-21, Rankbox trial workspace); read-only recon of the Vantera working tree (four surface maps, file:line cited below); the competitor section of `2026-10-21-learning-gate-ml-roadmap.md` (ML mechanism — complementary, not duplicated here)
- **Relation to the roadmap:** this is the UX counterpart to the ML track. It reshapes Phases 16b/16c/17/18/20 rather than adding a new product area. Where it conflicts with a locked phase decision the conflict is named in §7 as the owner's call.

---

## 0. Retention Brief (the contract for every surface in this spec)

1. **User state:** new — pre-activation. Last audit: 11 accounts, 1 finished onboarding, 0 logins. Nothing downstream matters until this changes.
2. **Motivation lever:** **time-to-value.** Everything before a user sees *real qualified leads from their own ICP* is overhead. Fogg B=MAP is the secondary lever: cut steps, not just copy.
3. **One desired action:** *look at your first five leads and say which ones are right.* (Not "connect LinkedIn", not "add a card" — those come after the user has seen the product work.)
4. **Value proof:** 5–15 real prospects matching the ICP drafted from the user's own website, each with a why-now signal and a score, and exactly one fully readable draft message. Grounded: `fast-pass.ts` already produces ≤15 matches + 1 readable draft; `capacity.ts` already allows a 25-lead sourcing preview with no channel connected.
5. **Churn risk addressed:** the drop-off at the LinkedIn-connect + card gate, which today comes *before* any lead is visible (`lib/auth/onboarding-gate.ts:29-35`). Ten of eleven accounts never got past it.

---

## 1. Diagnosis — where the activation cliff actually is

The teardown's headline ("Gojiberry shows 300 scored leads before you connect LinkedIn or send anything") lands on a specific defect in Vantera, not a vague one:

| Step | Gojiberry | Vantera today (working tree) |
|---|---|---|
| 1 | Name agent, pick source; signals pre-filled from site scan | Details: name · brand · website (`onboarding/details-form.tsx:48-110`) |
| 2 | AI builds ICP, shown as editable accordions + Regenerate | Site scanned and ICP drafted **silently** into `icps.criteria` — never shown (`onboarding/actions.ts:82-142`) |
| 3 | **Preview first 5 leads; reject → replaced** | — |
| 4 | Outreach settings; trust banner | **Connect LinkedIn — required, no skip** (`linkedin-step.tsx`) |
| 5 | Review → Launch; sourcing starts; 300 leads appear | **Card required** (`actions.ts:253-257`) |
| — | LinkedIn connect is a dashboard banner/CTA, gates sending only | Dashboard opens only after both gates |

Three compounding facts from the recon:

- **The engine does not need LinkedIn to source.** `packages/jobs/src/pipeline/capacity.ts:24` defines `NO_CHANNEL_PREVIEW_CAP = 25`; Scout runs a bounded preview when no channel exists. Sourcing and sending are *already* separable in the pipeline. Only the onboarding gate and the UI pretend otherwise.
- **The pre-payment Reveal already exists as dormant code.** `packages/jobs/src/pipeline/fast-pass.ts` (≤50 evaluated, top-5 drafted, ≤15 surfaced, exactly one readable draft, suppression-tested) + `lib/reveal/*` + `reveal_runs` (migration 0062, renumbered from 0038). Phase 16b retired its routes; the pipeline stayed.
- **Activation is unmeasured.** `onboarding_completed` is wired to `?onboarded=1` (`components/analytics/route-events.tsx:35-38`) but `finishOnboarding` redirects to `/dashboard` with no flag, so it never fires. No per-step events exist. The audit numbers had to be pulled by hand.

Secondary structural findings that make the *post*-activation product read worse than it is:

- **Two review surfaces.** The Today work card + `DraftPeek` (A/E/G/R, 5s undo, reject reasons, why-now evidence) is the Copilot-grade queue; `/approvals` is the older single-column list without any of that (`approvals/page.tsx:168`, `draft-card.tsx:131-176`). Nav shows both.
- **Two homes.** Onboarding and login land on `/dashboard` (Results) while `/today` calls itself the home and forwards the first session to `/approvals?first=1` (`today/page.tsx:37`).
- **Reasons exist but aren't shown.** `lead_signals.level/source`, `intent_observations.post_ref/headline/watch_target/agent_id` are populated and read by no UI (recon: no hits in `apps/web/src`).
- **Run state is buried.** "Next run in ~25 min" exists on the Playbook showcase and in Today's engine line, but nothing in the chrome says the engine is working; the workspace pill shows only a paused dot (`workspace-pill.tsx:100-130`).

---

## 2. Intent, goals, non-goals

**Intent.** Move the aha moment (real leads with reasons) in front of every gate, then make every later surface read as *a prioritized list of reasons* rather than a list of records. Steal Gojiberry's five patterns; keep Vantera's edge (the gate actually learns — ML-1..7).

**Goals**
- G1. A new user sees ≥5 real, scored, why-now-annotated leads from their own ICP **before** connecting LinkedIn and **before** entering a card.
- G2. The user corrects the AI's ICP draft (edit chips, regenerate) and rejects preview leads; both feed the real rank context (`icps.criteria`, `lead_feedback`).
- G3. One queue, one home, one always-visible run state.
- G4. Every lead row and every approval card leads with the reason (signal + date + link, tiered score).
- G5. Activation is instrumented end to end (step events, first-lead-seen, first-approve).

**Non-goals**
- Copying Gojiberry's visual system (coral, icon rail, purple AI sparkles). The light-first Geist/blue/ink system in rule 07 stands.
- Email/multi-channel anything (rule 01). "Multi-channel recommended" in their wizard is not a pattern to steal.
- Credits, affiliate program, webinar cards, Intercom-style bubble.
- New ML mechanisms — those are the ML track. This spec only *shows* what ML-2/3/4/5/7 already compute.

**Anti-goals (would make this a failure even if it works)**
- A toast or chat bubble covering the top-right action zone (teardown weak spot).
- An announcement modal on a working page.
- A blank 5–10 s wait while a draft generates — every generation gets a skeleton or streamed text.
- Any send cap hardcoded in a component (rule 07: caps on screen are `safety-limits.ts`); any vendor name on a surface.
- A fourth "home" or a third review surface.

**Constraints carried from the rules**
- One agent per kind per account (rule 13); no bespoke agent architecture.
- Suppression before anything that reaches a prospect; the preview is read-only (fast-pass already enforces).
- RLS in the same migration for any new table; retention note on prospect data.
- Help article per user-visible change (rule 09).
- Wizard scope rule (rule 08): wizards collect identity, goal, context only — ICP confirmation and lead preview are *context*, tone/goal/sequencing are not wizard inputs.

---

## 3. The five patterns, mapped onto Vantera

### 3.1 Sourcing runs before sending — reorder the gates (activation)

**New onboarding order** (replaces `resolveOnboardingStep`, `onboarding-gate.ts:29-35`):

```
Details (name · brand · website)
  → Your buyers   (the drafted ICP, visible + editable; "Regenerate"; exclusions)
  → First prospects (fast-pass preview: 5 shown, reject → replaced, up to 15 evaluated)
  → Plan (card, 7-day trial — unchanged)
  → Today
```

- **LinkedIn connect leaves onboarding.** It becomes the top item of the Get Started checklist (§3.5) and an Actions card on Today/Playbook. Sending is gated on it; sourcing is not. Engine mapping: Scout + Intent run under `NO_CHANNEL_PREVIEW_CAP` until a sender exists — no pipeline change.
- **Card stays before Today** (honors 16b/17's "card before dashboard" decision). **Pre-card spend is exactly one fast-pass run.** The fast-pass only drafts when a live Outreach agent + campaign exist (`fast-pass.ts:260`, `pg-store.ts` campaign lookup), so the campaign, Outreach agent and Scout are provisioned at **Buyers → Continue** (pre-card — the retired `/start/buyers` did the same). To keep abandoners from costing anything, the scheduler treats an account with no `stripe_subscription_id` as **held**: scout/intent/copy crons skip it (derived state, no new column; `TRIAL_LEAD_CAP` stays as the second fence). First scheduled run starts when the card is in. *My call — loosen if you'd rather sourcing keep running for never-payers.*
- **Endowed progress:** segments become Account ✓ · Details · Buyers · Prospects · Plan (20% endowed, 5 segments).
- **After the card:** `finishOnboarding` only stamps `onboarding_completed_at` and releases the hold; Today's first view shows "Finding prospects · first batch in ~N min" (state `working_empty`), never an empty state.
- **Fast-pass wiring:** `lib/reveal/start-fast-pass.ts` drops its LinkedIn precondition (keeps the ICP one); an ICP **Regenerate** resets the account's `reveal_runs` row so the preview re-runs. Intent keeps skipping with `no_connection` pre-connect (it needs a LinkedIn read path).
- **Trial length is 7 days** (`packages/billing/src/trial.ts:12`); copy says so. Which event *starts* the DB trial clock is the owner's call (§7.6).
- **Builder-decided:** exact copy; whether the fast-pass runs on the Buyers step's "Continue" (recommended — it takes 30–90 s and the Prospects step shows a skeleton + narration meanwhile: "Reading your site → Building your buyer profile → Scoring the first matches").

### 3.2 AI pre-fills every form — make the invisible draft visible

**"Your buyers" step.** Renders `icps.criteria` (titles, industries, sizes, geos, signals — already written by `draftIcp`) as editable chip groups with counts in the headers (JOB TITLES 4 · INDUSTRIES 3 · …), a **Regenerate** button (re-runs `draftIcp` with the current website scan), and an **Exclusions** group pre-filled from the scan (competitors + "service providers / agencies / freelancers" on by default) that writes `agents.config.targeting` (ML-5 shape, no migration). "Who to prioritize or avoid" free text sits under a disclosure.

**Playbook → Targeting** becomes the same component in edit mode (today it is a separate form, `scout/targeting/targeting-form.tsx`). One component, two placements.

**Company brain.** Workspace, Positioning, Proof and the website scan stay where they are (seller-positioning spec marks structured ICP out of scope), but the Buyers step and Playbook each link "Where this came from → Settings › Positioning". No schema change.

### 3.3 Every lead has a reason — the row and the card lead with it

**Prospects table** (`prospects/leads-table.tsx`):
- Why-now cell becomes `label · relative date` with the post title linked when `intent_observations.post_ref` exists for the lead, plus a `+N` overflow chip that opens the peek on the Signals section. Level drives the icon weight. Data: join `lead_signals` (count, newest) and newest `intent_observations` per lead in the existing one-round-trip loader.
- Score: keep the 0–100 number (the ML track measures it) but **prefix it with the existing tier** (`scoreVerdict`: hot ≥85 / strong ≥70 / look) as a 3-step glyph so the column scans like Gojiberry's flames. No new scoring.
- Tabs get counts (`All 312 · In-market 40 · Qualified 120 · …`) from a single grouped count query. Add **Scheduled** (sequence_runs with `next_action_at`) between Qualified and In outreach.
- Filters popover grouped by signal kind with counts.
- Prospect cell gets the LinkedIn glyph link (`leads.linkedin_url` is already loaded). No avatar column exists and none is added (no photo source; out of scope).

**Side peek** (`components/lead-profile.tsx`): add ←/→ prev/next across the current table page; collapsible sections in this order — Signals timeline (all `lead_signals` + intent observations with links) · Why this rank (ML-2) · Why this prospect · Company · **Message** (the queued `scheduled_sends` draft, read + edit + Regenerate-with-steer, §3.4) · Fit (ML-4; now also captures `lead_feedback.reason`) · CRM · Notes. Footer: **Not a fit** + "Open full brief".

**Approval card / DraftPeek:** already shows why-now evidence with source links (`draft-peek.tsx:255-273`); add the relative date and the tier glyph next to the score chip.

### 3.4 One queue with an inline AI edit loop

- `/approvals` is rebuilt as the Today work card + `DraftPeek` in a two-pane shell (list 380px · peek fills). The old `prospect-review-card.tsx` / `draft-card.tsx` / `review-hotkeys.tsx` are deleted. Today keeps the *same* work card (shared component), so there is one implementation. This is Phase 18 as already planned, now with the shape pinned.
- **Regenerate with steer:** a free-text box under the draft ("make it shorter, lead with the hiring signal") → `regenerateDraft(sendId, steer)` runs the copy brain with the steer appended to the per-lead context, humanizer lint unchanged, result replaces the body in place with a streamed/skeleton state (anti-goal: no blank wait). `G` key = regenerate (today it is "fix"); **Fix** stays as a button for style flags only.
- **Preview** = the draft rendered as a LinkedIn invite note (≤300 chars, counter already exists) or message bubble. Read-only visual, no send.
- **Autopilot | Review** switch sits at the top of the queue and maps to the copy agent's existing `send_mode` (`playbook/agent-card.tsx:186-205`, confirm dialog on automatic). Playbook keeps its toggle too — same action.
- **Blocked states on the queue:** the Actions stack (§3.6) renders above the list when sending is blocked (no sender / sender held / weekly ceiling) with the same copy Today uses, so the queue never looks dead without saying why.
- `/campaigns` → `/approvals` redirect stays.

### 3.5 Attribution down to the signal (proof it works)

Insights lives on `/dashboard?view=analytics` (Results). Changes:
- **Unhide the funnel.** Today it is hidden until deal value AND a paid plan AND spend exist (`(app)/analytics/analytics-view.tsx:56-62`, `!roi.hasSpend`). Show the count funnel always; hide only the $ tiles behind deal value. Stages: Found → Qualified → Contacted → Accepted → Replied (rate) → Interested (% of replies) → Meetings → Closed. Count from `outreach_sends` / `replies` / `leads.linkedin_connected_at`, not from `leads.status`.
- **Lead-source performance table:** rows = `lead_signals.kind` and intent `watch_target` (keywords / competitors / creators / hashtags) — columns Found · Contacted · Replied · Interested. Join path: `intent_observations(agent_id, watch_target, lead_id)` for intent; `lead_signals(kind, lead_id)` for everything else; outcomes from `replies.classification`. **Multi-signal leads count once per source** (state this on the surface). No schema change needed for v1.
- **Agent performance rows** (Scout · Intent · Outreach): use `leads.source` (`discovery` ≈ Scout, `intent` ≈ Intent). Adding `leads.agent_id` is deferred to the ML track (noted in §8).
- "Where your wins come from" (closed only) folds into the same table as the Closed column.

### 3.6 Always-visible run state + Actions stack

- **Chrome status chip** in the top band, right of the nav pill, on every app page: `● Finding prospects · next run in 25 min` / `● Sending · 12 of 20 invites today` / `◌ Paused by you · Resume` / `! LinkedIn not connected · Connect`. Source: the existing pure `engine-line.ts` + `metrics.ts` (which already import `safety-limits.ts`). Click opens a popover with the two toggles: **Sourcing** (Scout + Intent status) and **Outreach** (Outreach agent status), plus "Pause everything" (`accounts.paused_at`). This is the Gojiberry status-pill popover, mapped onto Vantera's existing three-agent model — no new state, two actions that flip existing statuses together.
- **Next-run copy unified:** the Playbook card uses the relative form the showcase already uses ("in ~25 min"; absolute time on hover).
- **Actions stack:** `agentAttention` (`playbook/agent-health.ts:25-79`) returns `{ reason, cta: {label, href} }` instead of a sentence; Today's tile engine already does this (`lib/today/tiles.ts`). Playbook cards and the Approvals header render the stack. New tile: **"No LinkedIn connected yet"** (today's `stopped_senders` requires `senders.length > 0`, so the never-connected case has no tile — `lib/today/state.ts:30`).
- **Activity feed** on the Playbook agent page: narrate from data that already exists — `agent_runs` (scout/intent, 90-day retention), `lead_signals`, `intent_observations`, `agents.deployed_at`, `accounts.website_scan` ("Site read", "Buyer profile drafted", "Prospect agent live", "23 prospects found · 5 qualified"). No events table; builder may add one later if the join gets heavy.

### 3.7 Persistent Get Started checklist (Today)

Four steps, order fixed: **Confirm your buyers ✓ · Review first prospects ✓ · Connect LinkedIn · Approve your first message** — optional fifth, skippable: Connect calendar or CRM. Lives in the Today right rail, collapses to a progress pill after 2/4, dismissable only at 4/4 (stored in `user_profiles.dismissed_asks`, existing jsonb). The first two are endowed by onboarding. Replaces `ActivationRamp` and the `FirstRunInProgress` mini-list (`dashboard-view.tsx:1170-1356`).

### 3.8 Smaller steals

- **Deal size tile** on Today when `accounts.avg_deal_value_cents` is null and ≥1 reply exists: "Set your average deal size to see pipeline in dollars" → inline input → unlocks $ on Results. Never in onboarding.
- **Safety caps in the sequence UI:** sequence builder shows the real caps from `safety-limits.ts` ("20 invites/day steady, 25 messages/day, ramps 5→10→15 over 4 weeks") as a trust line, and the Senders page imports the constants instead of hardcoding 100/25 (`settings/senders/page.tsx:54-75` — drift bug).
- **Auto-withdraw stale invites** needs a pipeline + provider feature (the `linkedin-infra` interface has no withdraw). Out of this spec; recorded in §8.
- **One home:** login and `finishOnboarding` land on `/today`; `/today` stops forwarding the first session to Approvals (the checklist is the first-session content). `/dashboard` stays as Results.
- **Analytics events:** `onboarding_step_completed {step}`, `icp_confirmed`, `first_prospects_seen {count}`, `preview_lead_rejected`, `linkedin_connected`, `first_draft_approved`, and the existing `onboarding_completed` actually fired (append `?onboarded=1`).

**Explicitly not copied:** toast over the header, chat bubble over actions, announcement modal, blank draft wait, wizard leave-blocking confirm, "Search 800M+ profiles" manual search, credits UI.

---

## 4. Surfaces, before → after (one line each)

| Surface | Today | After |
|---|---|---|
| Onboarding | Details → LinkedIn (hard) → Card | Details → Buyers (editable AI draft) → First prospects (5, reject-and-replace) → Card |
| Today | status sentence, tiles, work card; first session → Approvals | + Get Started checklist (right rail), + deal-size tile, + "no LinkedIn yet" tile; is the home |
| Chrome | paused dot in workspace pill | run-state chip with Sourcing/Outreach popover, every page |
| Approvals | single column, no undo/reasons/steer | two-pane Today work card + DraftPeek; Regenerate-with-steer; Preview; Autopilot/Review switch; Actions stack |
| Prospects | why-now line, 0–100 chip, tabs w/o counts | why-now + date + post link + `+N`; tier glyph + score; tab counts; signal-grouped filters; LinkedIn glyph |
| Side peek | long scroll, no draft | prev/next; collapsible; Signals timeline; Message w/ steer; fit reason; Not a fit footer |
| Playbook | 3 cards, raw counts, amber sentence | funnel per card (Found → Contacted/cap → Accepted % → Replied % → Interested); Actions stack with CTAs; activity feed; intent config editable |
| Results | funnel hidden behind $ + plan | count funnel always; $ behind deal size; source table (Found/Contacted/Replied/Interested per signal + watch target) |
| Settings › Senders | hardcoded caps | imports `safety-limits.ts` |

---

## 5. Sequencing (three PRs, each its own phase + help article)

**UX-1 — Activation (do first; everything else is noise until this ships).** §3.1, §3.2, §3.7, §3.8 one-home + events, the "no LinkedIn yet" tile. Touches: `onboarding/*`, `lib/auth/onboarding-gate.ts` (+tests), `today/*`, `lib/today/state|tiles` (+tests), fast-pass trigger wiring (`packages/jobs/src/trigger/fast-pass.ts` exists), `lead_feedback` writes from the preview, `getting-started.md`. No migration expected (`reveal_runs` 0062 exists — verify applied in prod; see Supabase memory).
Gate: a new user with a real website reaches the card step having seen ≥5 leads with signals; `onboarding_completed` fires; full CI gate.

**UX-2 — Reasons + one queue.** §3.3, §3.4, §3.6 chrome chip + Actions stack. Touches: `prospects/*`, `components/lead-profile.tsx`, `approvals/*` (rebuild on Today's work card), `components/chrome/top-chrome.tsx`, `playbook/agent-health.ts` (+tests), copy brain `regenerate` entry (brain purity holds — steer is a string param), help articles `approvals.md` (new) + `prospects.md`.
Gate: approvals keyboard model identical on Today and Approvals (shared component test); regenerate-with-steer passes the humanizer lint test + copy eval corpus; whitelabel-auditor pass.

**UX-3 — Proof.** §3.5, Playbook funnels + activity feed, deal-size tile, caps in sequence UI, Senders import fix, intent config edit route. Touches: `lib/analytics.ts` (+tests), `dashboard/analytics-*`, `playbook/*`, `sequence/*`, `settings/senders`. No migration for v1.
Gate: source table numbers reconcile to the funnel totals (test); counts computed from the account's own rows only (guardrail, same posture as ML-2).

Each phase: rls-auditor if any migration appears (none planned), whitelabel-auditor before ship, roadmap checkbox, help article. Help content: rename/rewrite the existing `review-queue.md` and `leads.md` rather than adding parallel articles.

---

## 6. What's left to the builder

- Exact copy on every new surface (voice: sentence case, plain, trust lines at risky steps — "Nothing is sent without your approval" at the Plan step and above the queue).
- Skeleton/streaming design for the fast-pass wait and regenerate wait.
- Component split for the shared work card (Today + Approvals) and the shared ICP chip editor (onboarding + Playbook).
- Query shape for tab counts and the source table (one round trip each; fine to add a Postgres view with `security_invoker` like `today_activity`).
- Whether the chrome chip polls (2 s like the old reveal status) or revalidates on navigation — recommend revalidate + a 60 s poll only while state is `working_empty`.
- Mobile placement of the chrome chip (recommend: in the mobile top bar, label collapsed to the dot + "25 min").

---

## 7. Decisions for the owner (answer changes what gets built)

1. **Card placement.** This spec keeps the card *after* the lead preview but *before* Today (honors 16b/17). Alternative: Gojiberry-style full trial with no card until day N. Recommendation: keep the card — the preview is the sell; the Phase 17 wall logic stays intact.
2. **LinkedIn out of onboarding entirely?** Spec says yes (checklist + Actions stack). Alternative: keep it as an optional last onboarding step with a visible Skip. Recommendation: remove it — every optional step still reads as a gate.
3. **Preview size and spend.** 5 shown / up to 15 evaluated / 1 readable draft (fast-pass defaults). Rejecting replaces from the evaluated pool; when the pool is exhausted the step says so and continues. Confirm the pre-payment spend cap is acceptable per website-scan account (it was in Phase 17's intent).
4. **Approvals rebuild = Today's work card (recommended) vs. keep both surfaces.** Spec deletes the old one.
5. **`/dashboard` (Results) stays in nav as the fifth item, or folds into Today?** Spec keeps it; Gojiberry has both Dashboard and Insights too.
6. **What starts the trial clock.** Migration 0053 (owner decision) stamps `trial_ends_at` on the first active LinkedIn connect (`lib/linkedin/sync.ts:158`); Stripe's `trial_period_days` runs from checkout and nothing writes `trial_ends_at` on checkout. With LinkedIn out of onboarding the DB clock (trial banner, trial-ending emails, expiry sweep) would not start until connect while Stripe bills on day 7 regardless. Recommendation: reverse 0053 — start the clock at checkout confirm — so the two clocks agree.
7. **Base branch and the concurrent session.** The ML-2/4/5 surfaces this spec renders exist only on `ops/prod-pipeline-run` (19 commits ahead of `main`; `main` lacks `0065_lead_feedback.sql`), and that branch carries a ~100-file uncommitted diff that is mid-edit on `onboarding/actions.ts`, `onboarding-context.ts` and `nav-items.ts` — the exact files UX-1 rewrites. Recommendation: land `ops/prod-pipeline-run` first, then branch `phase-ux1-activation` from it. Building from `main` would leave UX-2/UX-3 with nothing to show.
8. **Roadmap accounting.** Phases 16, 16b, 16c are built but unchecked; Phase 17 as written (trial retirement, $99 single plan, middleware subscription gate on `/app`) contradicts this spec's "card + 7-day trial, unchanged" and the current gate (`resolveGate("app")` checks only `onboarding_completed_at`). Recommendation: flip 16/16b/16c as shipped when UX-1 ships, re-scope 17 to "pre-payment cost caps" only (the held-account rule above delivers most of it) and drop the middleware gate unless you still want trial retirement.

Everything else in this document is either grounded in the teardown, the recon, or marked as my call.

---

## 8. Deferred / recorded, not built here

- `leads.agent_id` for exact per-agent attribution (ML track; needs migration + rls-auditor).
- Auto-withdraw stale invites (provider interface + scheduler feature; rule 04 safety semantics).
- Agent events table if the narrated activity feed's join gets heavy.
- Lookalike source as a *visible* source row (ML-7 feature exists; surfacing waits for ≥3 positives).
- Website-visitor identification, voice notes, profile-visit / like-post steps (channel features; not in rule 01 scope now).
