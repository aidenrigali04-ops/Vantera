# Self-Evolving Brain — Positioning + Product Design

**Date:** 2026-07-14
**Status:** Approved — owner decisions locked 2026-07-14; gap-pass applied (honesty-label fix, trial sweep, pricing reconciliation, conditional substantiation)
**Type:** Positioning shift + product capability (spans marketing, onboarding, dashboard, and the outreach intelligence layer)
**Builds on:** `2026-06-29-self-optimizing-outreach-design.md` (the champion/challenger engine this expands), relates to `2026-07-13-vantera-scaling-plan-design.md` (the in-flight growth plan, which turns on existing engines and does **not** yet include this).

---

## TL;DR

Reposition Vantera from **"turn LinkedIn intent into booked meetings"** (a results-promise every competitor can make) to **"self-evolving lead gen on LinkedIn — it already knows what works, proves it, and gets sharper every week"** (a category claim built on compounding quality).

The main value prop is no longer *promising results* — it is *promising quality that compounds*. This only survives if the product genuinely delivers it and **shows** it. The good news, confirmed by a full code map: the self-improving machine mostly already exists (the champion/challenger engine, migration 0040) — it is narrow, invisible, and under-sold. This is largely a **promotion + reframe + honest-substantiation** job, plus one genuinely new surface (the "it already knows what works" proof), not a from-scratch rebuild.

**Governing principle:** add an **intelligence** pillar on top of the existing *quality + safety + control* narrative. The winning sentence is **"it already knows what works, it keeps getting sharper, and you still approve every send and stay account-safe."** Intelligence *and* control *and* safety — never intelligence replacing control.

---

## Why this positioning (honest assessment)

**Strong because:**
- It is a **category claim, not a volume claim** — it exits the crowded "more meetings / AI SDR" axis.
- It is a **real moat if it's real** — a system that compounds learning means the longer you use it the better it gets, and switching resets you to zero. That makes churn structurally harder (the current disease: ~0 activation, $0 real MRR).
- It **flips the credibility problem** — "gets better over time" is falsifiable in the customer's favor, lowering the upfront-proof burden instead of forcing another unbacked claim. (Vantera has a documented fabricated-proof history; this positioning is a chance to close that, not deepen it.)

**Risks that must be designed around:**
1. **You're selling a derivative (improvement), not a level (results).** A skeptic hears "self-evolving" as "not good yet — fund our learning curve." Survives **only** if the day-1 floor is already credibly good **and** the improvement is visible/attributable. Lead with **competence in the present tense**, not "watch it learn."
2. **Cold-start / small-N is a math problem.** One account's ~100 touches/week is too little signal to learn fast inside a trial. Answered by the **collective brain** (below).
3. **"Evolving" can read as "unsafe."** Messages ship under the customer's real LinkedIn identity. Answered by the **safety envelope** (below).

---

## Locked strategic decisions

1. **Collective brain (cross-account learning).** The brain learns from **aggregate patterns and statistics across all accounts** — never raw messages, leads, or PII crossing a tenant boundary. A new account inherits the network's proven patterns on day 1 (strong floor, no cold-start); its own results then pull its policy toward what works for *it* (Bayesian shrinkage). This respects the RLS-from-day-one tenancy model: raw data stays locked per-account; only distilled, k-anonymized pattern weights are shared. It is both the cold-start fix and the strongest moat (a cross-customer data network effect).

2. **Full autonomy — inside a hard safety envelope.** The brain freely invents, tests, and adopts strategies on its own (no human click to adopt). **But** every candidate, regardless of how it was generated, must (a) pass the deterministic content lints (proof-grounding, avoid-phrases, length caps, claim-check) **before** it can go live, and (b) win on statistics with automatic rollback on harm. Autonomy decides *what to try and what to keep*. The envelope decides *what is categorically never sent*, and the brain cannot tune the envelope. This is non-negotiable: a single off-brand autonomous message that gets a customer's LinkedIn account restricted, or screenshotted, is a company-killer for a trust-positioned product.

> Note: "full autonomy" governs the **brain's learning/adoption** of *what* to send. It is compatible with the existing per-send control ("you approve every send" / review-vs-auto send mode) — the user still controls individual sends. Both narratives coexist: autonomy in learning, control in sending.

---

## Section 1 — Architecture (the shape)

Four layers wrapped around the existing brains (`packages/agent-brains/src/*`), plus the collective prior and the safety envelope. Nothing is thrown away; the existing engine is widened.

1. **Signal layer (the senses).** Every attempt becomes a clean `(features → outcome)` pair. Outcomes are already persisted (`leads.linkedin_connected_at`, `meeting_booked_at`, `closed_at`, `deal_value_cents`; `replies.classification`). **Gap:** message-level performance is never stored — it's re-derived at read time, with no record of which angle/proof/variant produced which outcome. Stamping every send with its generative "recipe" and joining it to the outcome is the foundational build. No clean pairs → nothing learns.

2. **Learning core (the brain).** Turns accumulated pairs into decisions. Mechanism in Section 2. Reuses the statistical spine that already exists: `optimize/funnel.ts` (Wilson CIs), `optimize/experiment.ts`, `optimize/decide.ts` (circuit breaker). Widened from 3 enum knobs to open-ended variants, and from copy-only to all four axes.

3. **Autonomous actuation (the hands).** The learned policy changes what's sent/targeted next — automatically, gated only by the safety envelope. Flips `optimization_playbook` from owner-clicks-adopt to brain-adopts-within-bounds.

4. **Visible brain (the face).** A surface that *shows* the evolution and the current competence. For this positioning this layer **is the product** — silent evolution does not exist to the buyer.

**Collective prior.** The global brain learns aggregate pattern weights per ICP slice ("specific-ask openers win for fintech-CFO at N=… across the network"). New accounts inherit it day 1; own results shrink the policy toward personalization over time. Raw data never crosses tenants.

**Safety envelope.** The deterministic lint + statistical-gate + auto-rollback fence around all four layers. Not tunable by the brain.

---

## Section 2 — The mechanism (how it produces results)

One closed loop, running continuously. Every pass, the floor rises.

**generate → gate → allocate → measure → decide → remember → re-generate**

1. **GENERATE (LLM invents recipes, not toggles).** A "recipe" is a structured object: opening angle, which pain/trigger to lead with, which proof point to cite, CTA style, length, tone, **plus targeting facets** (seniority / industry / company-size band / intent signal). Candidates come from three sources: (a) the **collective prior** (network best for this slice), (b) **LLM hypothesis generation** — a scheduled pass reads this account's recent winners *and* losers with outcomes and proposes genuinely new variants, (c) **cross-pollination** — a recipe winning for a similar account/slice imported as a challenger.

2. **GATE (safety envelope).** Every candidate passes the deterministic lints (`copy/humanizer.ts` + proof-grounding + avoid-phrases + length) before going live. Fail → discarded, never sent.

3. **ALLOCATE (Thompson-sampling bandit).** Each recipe is an arm; traffic is allocated proportional to the probability the arm is best. Explores broadly when uncertain, exploits winners as evidence lands, never stops probing. Beats A/B (no wasted sends on a pre-committed loser) and works at low N. **The bandit's arms are seeded with the collective prior** — a new account samples from "what the network knows," not randomly. This is the entire cold-start answer.

4. **MEASURE (message-level attribution).** Every send stamped with its recipe (arm ID); outcome joins back. **Layered reward, laddered to money:** fast proxies (accept → reply → positive-reply) drive early bandit updates; the slow high-value truth (meeting booked, closed-won, deal value) periodically re-weights everything so the brain optimizes revenue, not vanity replies.

5. **DECIDE (adopt/kill within the envelope, no human click).** Challenger beating champion at statistical confidence (Wilson lower bound, `decide.ts`) → promoted automatically. Losers retire. Harm to negative-reply rate → circuit breaker + auto-rollback.

6. **REMEMBER (positive content memory — absent today).** Winning recipes + their actual texts embedded (the Voyage embedder in `packages/ai/src/embeddings.ts` — today used only for the help copilot) and stored indexed by ICP slice + outcome. Generation retrieves nearest high-performing exemplars for *that kind of lead* and conditions on them. Today the only message memory is **negative** (`recentSendOpeners` → `avoidPhrases`, "don't reuse"). This adds the **positive** ("here's what booked meetings for leads like this").

7. **RE-GENERATE.** Winners feed the memory and the collective prior; the LLM invents the next generation; the network prior updates for every account in the slice. The loop never stops tightening.

**Results path (honest):**
- **Day 1:** inherit the network's current-best for your slice → start ahead of a fresh competitor account (which starts at zero).
- **Weeks 1–2:** bandit starves losers + content memory feeds winners → accept/positive-reply rates climb. *Honest caveat:* early "felt" improvement is mostly the collective prior + memory; personalized learning compounds over the following weeks.
- **Ongoing:** targeting axis engages — the brain sees which slices actually **book** (not just reply) and tilts sourcing toward them. The lead list itself improves. Compounding flywheel: better targeting → better replies → more meetings → richer signal → better targeting.
- The compounding claim becomes **measurable** — week-over-week the account's own funnel rates trend up, attributable to the brain.

---

## The value angle (why it stops being "another LinkedIn tool")

Every competitor (Waalaxy, Expandi, HeyReach, Dripify, Lemlist) is a **sequencer** — you write the messages, set the steps, it sends on a schedule; the intelligence is *yours*. Vantera's category is **an operator that improves**: from *"automation you configure"* to *"an intelligence that compounds."* Four things a sequencer structurally cannot show:

1. **It gets better without you touching it.** Competitors are frozen the day you buy them.
2. **It arrives already smart.** Collective brain → a new Vantera account outperforms a new competitor account on day 1.
3. **It shows its reasoning.** "I learned X, changed Y, here's the result" — vs. a dashboard of what *you* did.
4. **Its quality is measured, not claimed.** "This message is statistically the best-performing version we've ever run for your buyer" — no competitor can say that sentence.

### Plain-language wording (user-facing — no jargon, ever)

- **Category line:** "Every other LinkedIn tool waits for you to tell it what to do. Vantera already knows — and it gets sharper every week."
- **Gut-feel one-liner:** "It's not a tool you set up. It's a rep who's already good — and gets better every week."
- **The four strengths, de-jargoned:**
  - "It runs itself and improves itself. You don't tweak settings — it finds what's working and does more of it."
  - "It's good on day one. It starts with what already works for buyers like yours — not a blank page."
  - "It shows its work. You see why it's saying what it's saying, and the proof it works."
  - "It only sends what's proven. Every message earned its spot by working on real people."

Internal machinery (bandits, priors, shrinkage) is **never** shown to users.

### Hero framing (the felt experience)

The hero is **not** "watch it learn" (leads with the past, implies it used to be worse). The hero is **"watch how good it already is — with the receipts."** Competence in the present tense; improvement is a supporting feeling, never the headline.

Chosen hero = **an expert operator running your proven plays, live, with receipts:**
- The **proven playbook** (the current best plays for your buyers, each with proof + network backing) is the substance — it guarantees "already strong + proof," and because it opens with the network's proven plays there is **no empty/weak first-run state.**
- The **live operator** framing makes it feel alive, not like a report.
- A thin glanceable **brain-state** header sits on top.
- The **"what it learned"** timeline drops *inside* as supporting evidence of momentum — not the hero.
- The intelligence should be **personified** — a named entity the user *has*, not a settings page.

---

## Section 3 — Incorporating the positioning across all surfaces

Every change points at a proven behavior-data leak: **① the 0% LinkedIn-connect cliff, ② the silent-wait cliff (5-day trial < 7–14-day time-to-first-reply), ③ the trust/honesty deficit.** (Traffic stays last, per owner call.)

### Retention Briefs (the psychology contract per surface)

**Landing** — cold visitor · lever: competence-first framing (not results-promise) · action: start signup believing it's a different category · proof: the intelligence + proof concept on the page (not a fake "booked meeting") · defuses: the "just another LinkedIn tool" bounce.

**Auth** — decided-but-fragile · lever: Fogg B=MAP (strip friction) · action: finish account creation · proof: one line carrying the promise forward so it doesn't die on a bare form · defuses: friction drop-off (no SSO today) + promise going silent.

**Onboarding** — new, pre-activation · lever: time-to-value + endowed progress + **value-before-friction** · action: connect LinkedIn, but only after seeing the brain's proven plays for their buyer · proof: "here's what already works for people selling to {icp}" **before** the connect ask · defuses: **the 0%-connect cliff** (a scary permission asked before showing any value — flip the order).

**Dashboard** — activated → habitual · lever: hook model + peak-end (wins celebrated, never silent rows) · action: come back and trust the brain through the waiting period · proof: the live "what it's doing + proof it works" hero, so there's value to see **before** the first reply lands · defuses: **the silent-wait cliff.**

### A. Landing page (all-light system, `.landing`; currently zero learning narrative)

- **Hero** (`components/landing/hero.tsx`): headline "Turn LinkedIn into booked sales calls" → **"The LinkedIn outreach that already knows what works."** + smaller "And gets sharper every week." Subhead adds intelligence while keeping control+safety. Calendar mock (`hero-calendar.tsx` + `hero-connector.tsx`): keep, optionally add a proven-play chip feeding the conduit so the visual says "intelligence fills the calendar."
- **TrustStrip** (`trust-strip.tsx`): add/swap a signal → **"Gets sharper every week / learns what works, on its own."**
- **Showcase "The system"** (`showcase.tsx`): reframe the Prospect loop's "Repeat every day" rail → "…and gets sharper each cycle," or add a 5th "Learn — keeps what works, drops what doesn't" beat.
- **FeaturesGrid** (`features-grid.tsx`): add a 6th "Learns & improves" pillar with co-"Vantera only" differentiator status alongside Safety. Safety + Learning = the pair no sequencer can claim.
- **FinalCta** (`final-cta.tsx`): the first-party proof card ("our own account, real numbers") is where "gets sharper" gets honestly substantiated — add a real reply-rate-climbed line from Vantera's own account **only after verifying the numbers exist** (see honesty rule).
- **Footer** (`footer.tsx`): tagline "The AI SDR team for LinkedIn" (old AI-SDR positioning) → **"LinkedIn outreach that learns what works."**
- **/ai-info AEO page** (`app/ai-info/page.tsx`): critical + cheap — add a self-improving capabilities row and a "learns vs. static sequencers" line to the "How Vantera compares" table (vs Waalaxy/Expandi/Dripify); update the "Corrections" table. Otherwise LLMs keep citing the old positioning.
- **Cleanups the map exposed (now mandatory pre-launch, per gap-pass):**
  - **Pricing reconciliation.** Homepage teaser says "two plans" (Starter + Custom); /pricing + billing source of truth say three (Starter $45 / Growth $79 / Scale $349 + Enterprise); /ai-info describes the Intent Agent as generally shipped while billing gates it to Growth+. **Default: billing is the source of truth** — fix the homepage subtitle and /ai-info to match /pricing (owner can override).
  - **7-day trial sweep.** Trial moves 5 → 7 days (owner decision). This is a **billing-engine change + full copy sweep**, not a wording tweak: locate and change the trial-duration constant in the billing layer, then sweep every "5-day" mention — hero reassurance line (`hero.tsx:114-116`), HowItWorks, /ai-info fact table, FAQ, in-app trial banner — and verify end-to-end that a new signup actually receives 7 days. Marketing saying 7 while billing grants 5 is a false claim at the moment of highest scrutiny.
  - Honesty bar is already strict (fabricated logo cloud deliberately removed) — "gets sharper" must be first-party-substantiated to survive here.

#### Deeper information pages (new — owner-approved 2026-07-14)

The homepage makes the promise; deeper pages let a motivated evaluator verify it (**progressive disclosure**; claims-with-a-mechanism beat bare claims — the "reason-why" effect). Hub-and-spoke: homepage = hub, each page expands one homepage section and funnels back to signup. All hand-crafted in the existing `.landing` system (`MarketingShell`/`MarketingHeader`), written **name-agnostic** until the brain's name is chosen.

Three flagships first, then two supporting:
1. **/how-it-learns — the mechanism page (most important).** The loop in plain language + clean visual: starts with what works → tries new ideas → keeps winners, drops losers → remembers what wins → gets sharper. Psychology: cognitive fluency + labor-illusion + reason-why. Includes "what it will never do" (the safety envelope in user words) and "you stay in control."
2. **/proven-plays — the proof + day-one page.** Kills the "weak start" fear: real, honestly-labeled example plays (launch label: first-party, per honesty rule). Competence-first, present tense. Psychology: concreteness + social proof + "already good" framing.
3. **/why-vantera — the category page.** Not another LinkedIn tool: direct contrast with static sequencers (Waalaxy/Expandi/Dripify — already named on /ai-info, reinforces AEO). Psychology: categorization + contrast + naming the old way as the enemy.
4. **/safety (supporting).** Deepens the existing "Vantera only" safety differentiator into its own page. Risk-reversal / loss-aversion — the account-ban fear grows once "autonomous AI" enters the story.
5. **/how-we-prove-it (supporting).** Radical-transparency page: names skepticism and disarms it — real numbers, no fake claims, what we will never show you. Turns the historical weakness into a stated principle.

**Internal-link model:** each homepage section gets a "See how →" deep link into its matching page (Showcase → how-it-learns; proof/Features → proven-plays; Consolidation → why-vantera; Safety card → safety). Each page cross-links two siblings in-content + persistent signup CTA. New "Learn" footer column + "How it works" entry in the nav Products dropdown. All content mirrored into /ai-info so the AEO story matches. Builds topical authority for the (later) traffic phase.

**Deploy sequencing (gap-pass finding):** these pages are built on the branch now but **deploy with Stage 0** — their copy must match what the product truthfully does at deploy time (e.g. auto-adopt is only claimable once Stage 0's auto-adopt is live; today's truth is test-and-keep-winners with owner approval).

### B. Auth (light split-screen; email/password only, no SSO)

- **Signup** (`(auth)/signup/signup-form.tsx`): keep the 3 fields. Headline "Turn LinkedIn intent into booked revenue" → **"Start with outreach that already knows what works."** Extend the `?site=` continuity callout → "…to map your ICP and show you what already works for buyers like yours."
- **Auth right panel** (`public/auth-panel.html`): reframe the closing beat of the cinematic loop from "Turn intent into revenue" → end on **"…and it keeps getting sharper."**
- **SSO gap (leak ①):** add **Google sign-in** as a fast follow — a straight B=MAP win at the most fragile moment. Not blocking.

### C. Onboarding (already well-built — upgrade, don't rebuild)

3-step wizard (`app/onboarding/wizard.tsx`): Personalize → Connect LinkedIn → Confirm targeting, with an endowed-progress rail (starts at "Account created ✓"), a website-scan interstitial that "learns your business," and a cost-stating opt-out.

- **Step 0 "Personalize":** nudge scan sub-copy "then we read your site and learn the rest" → "…then we read your site and match you to what already works."
- **Scan interstitial "What we learned"** (`wizard.tsx:637`): **highest-leverage add in the flow.** Today shows headline + "Best-fit buyer: {icp}". Add a proven-play preview: **"Here's an opening that already works for people selling to {icp}"** — one real, lint-passed starter-library play. Proves the "already knows" claim **before** asking for anything.
- **Step 1 "Connect LinkedIn" (the 0% cliff, leak ①):** show value, then ask. Put the proven playbook for their buyer **above** the Connect button: "Your brain is ready. Here are the 3 proven plays it'll run for {icp} — connect LinkedIn to turn them on." Reframe explainer "This is the step that turns your agents on" → **"This turns your brain loose — it runs the proven plays you just saw."** Keep the cost-stating opt-out.
- **Step 2 "Here's what we got" + deploy:** keep required fields (industry/ICP/revenue goal/deal value — deal value is a good commitment device). Reframe CTA "Find my first leads" / "Deploying your agents…" → **"Put my brain to work" / "Your brain is going to work…"**; explainer → "…it starts with proven plays and gets sharper from your results."
- **Progress rail:** consider payoff card "Your first leads land" → "Your brain goes to work" (keep the entity personified end-to-end).
- **Structural flag (business decision, not copy):** the 5-day trial < 7–14-day time-to-first-reply is the deepest cause of leak ②. The "already knows / proven plays" story partially fixes it by delivering day-1 value; still consider a longer trial or a "first reply or extended" mechanic. Owner's call.

### D. Dashboard (currently "results-first" — nav = "Results" + "System"; everyone lands in empty states)

- **Navigation** (`components/dock-nav.tsx`): rename **"System" → "Brain"** (personify the intelligence). Keep Results / Leads / Review / Settings.
- **Headline move — promote the buried engine.** The Analytics **"Optimization"** panel (`app/(app)/analytics/outreach-diagnosis.tsx`) IS the "gets sharper every week" machine ("Testing now," "A proven change is ready," "Adopt as default"). (1) Rename "Optimization" → **"What's working"** (plain, felt). (2) Surface a live summary of it on the **Overview**, not just a sub-tab. Cheapest way to make the positioning real — the machinery already exists.
- **Overview states** (`app/(app)/dashboard/dashboard-view.tsx`):
  - **`FirstRunInProgress`** (first post-onboarding screen, `:964`): today "Finding your first prospects" = silence during the churn window (leak ②). Body → **"While it sources your first buyers, here's what it already knows works for {icp}"** + render the **proven-play cards** here.
  - **`ActivationRamp`** (`isNew`, `:882`): keep the endowed-progress checklist; add the proven-plays block beneath.
  - **`WorkingDashboard`** (has leads, `:161`): add a **"What your brain learned / is testing this week"** strip near the top (the promoted engine summary), above/beside the KpiStrip. Keep Closed/Pipeline/Replies/Review tiles — results stay as proof.
- **AgentsPanel + agent detail** (`agent-showcase-data.ts`): add the learning beat to the static summaries — Scout "…learning which buyers actually convert, tilting toward them"; Outreach "…keeping the messages that work, dropping the ones that don't." The rotating orb already implies "alive"; the words should say "learning."
- **Analytics tab** (`analytics-view.tsx`): keep ROI framing (Return on spend, 2× bar = "proves it"). "What's working" panel becomes this tab's hero; the `AttributionCard` ("Where your wins come from") = the brain showing its reasoning.
- **Pipeline tab** (`live-pipeline.tsx`): add a subtle "learning" annotation on the Sourcing/Drafting nodes ("choosing proven plays").
- **Success moments** (`ReplyCelebration`, `ConversionCelebration`): tie wins back to the brain — "{lead} is interested — from a play your brain proved works." Every win becomes evidence the intelligence works.
- **Notifications** (`app/(app)/layout.tsx`): add an occasional **variable-reward** notification — "Your brain got sharper — it found a better opener for {icp} this week." The hook that pulls people back during the silent wait (leak ②).
- **Settings → Proof & pricing** (`settings/proof/page.tsx`): frame as "what your brain is allowed to prove" — ties the honesty model to the intelligence.

---

## The honesty rule (leak ③ — the whole ballgame)

Every number on every surface is real or clearly labeled as a starter/network benchmark — never invented. The site already enforces this (fabricated logos removed; "our own account, real numbers"; /ai-info "zero invented numbers"). The "gets sharper" claim inherits that bar: substantiate from Vantera's own real improvement curve, and never label day-1 plays as personalized results not yet earned. One invented stat detonates the repositioning.

**Launch-time label correction (gap-pass finding):** at launch the network is effectively N=1 (prod: 3 signups ever, ~0 external activations) — so **"proven across accounts like yours" would itself be a fabricated claim on day one.** The only honest launch labels are first-party and research-grounded: **"proven on our own real outbound"** (same model as the FinalCta card) and "grounded in what works for {industry} buyers" (SDR market report). The label graduates to "proven across accounts like yours" only once multiple accounts' real data backs it. This applies everywhere day-1 plays appear: onboarding scan payoff, Step 1 playbook, dashboard empty states, and the marketing pages.

**Conditional substantiation (gap-pass finding):** the FinalCta "our reply rate climbed from X% → Y% as the system learned" line is **conditional on the data actually existing** — verify Vantera's own account shows a real learning curve before writing it; if the curve isn't measurable yet, omit the line entirely. Never write the sentence first and find the numbers later.

---

## Phased build

Positioning goes live **only when Stage 0 is live** — never the promise ahead of the proof. The new deep pages follow the same rule (built on-branch, deployed with Stage 0).

**Verification mandate (owner directive, 2026-07-14, tied to the 7-day trial):** a longer trial only helps if the product delivers inside it — otherwise it's more time to be disappointed. Therefore every build in every stage is **built → verified end-to-end → re-verified against the promise it makes to the user** before it's called done. Nothing ships on "it should work." A build that can't yet deliver the promise it carries does not go live carrying that promise.

- **Stage 0 — the first version that ships *with* the new marketing (minimum credible brain).**
  - Flip the existing message-testing engine to **adopt winners on its own** within the safety envelope (auto-adopt, auto-rollback) — machinery exists (`optimize/*`, `optimization_playbook`).
  - Load the **hand-built proven starter playbook** (from real testing / market research / real results) so day 1 is genuinely strong. (At launch the "network" is thin — the starter library IS the day-one brain; the collective brain grows as accounts accumulate. Say "proven plays to start, then it learns" — never "a huge AI network" you don't have yet.)
  - Build the **proven-play surface** ("here's what it's doing, and proof it works") — onboarding scan-payoff add + dashboard empty-state cards.
  - **Promote + rename** the buried Optimization panel → "What's working," surfaced on Overview.
  - Add **positive content memory** (retrieve winning exemplars) — reuses the Voyage embedder.
  - User-facing copy swaps across landing/auth/onboarding/dashboard per Section 3.
  - **The five deeper information pages** (Section 3A) + internal-link model + /ai-info mirror.
  - **7-day trial change** (billing + copy sweep + end-to-end verify) and **pricing reconciliation** (Section 3A cleanups).

- **Stage 1 — messages that fully prove and sharpen themselves.** Full generate→gate→bandit→measure→decide→remember loop on copy, plus the foundational plumbing: **stamp every send with its recipe** and join to outcome (message-level attribution).

- **Stage 2 — targeting that learns who actually buys.** Re-derive ICP emphasis from who accepts→replies→**books**; tilt sourcing. Biggest compounding payoff, slower signal.

- **Stage 3 — timing, follow-ups, and the collective brain maturing as accounts grow.** Send-time/cadence tuning; intent signals weighted by what actually predicted meetings; cross-account prior becomes the dominant day-1 source.

---

## What exists today vs. what's new (grounding)

**Exists (reuse):** champion/challenger engine (migration 0040, `optimize/*`, `optimization_experiments`, `optimization_playbook`), outcome capture on `leads`/`replies`, statistical spine (Wilson CIs, circuit breaker), the `outreach-diagnosis.tsx` UI, the Voyage embedder, a well-built onboarding, a strict honesty bar on marketing.

**New (build):** message-level attribution (send→recipe→outcome), open-ended LLM-generated recipes (beyond the 3 enum knobs `openWith`/`followupLength`/`askStyle`), Thompson-sampling bandit seeded by a collective prior, cross-account aggregate learning, positive content memory, targeting/timing adaptation, auto-adopt within the envelope, and the visible **proven-play / brain** surfaces.

---

## Success metrics

- **Activation:** LinkedIn-connect completion rate in onboarding (attacks leak ①); % of new accounts reaching first positive reply (attacks leak ②).
- **Quality/compounding (the proof of the promise):** per-account positive-reply rate trend week-over-week; % of live sends using an auto-adopted (brain-chosen) recipe; challenger win rate.
- **Trust:** zero fabricated numbers shipped (audit); day-1 plays correctly labeled as network/starter benchmarks.
- **Business:** trial→paid conversion; retention past the silent-wait window.

---

## Non-goals / YAGNI

- No from-scratch ML/RL — bandits + LLM-generated variants + statistical gates are sufficient at these volumes.
- No dedicated separate "Brain" microservice/store (Approach 2 rejected) — layer on the existing engine.
- No net-new autonomy *outside* the safety envelope, ever.
- Traffic/top-of-funnel work stays last (owner directive); this design assumes existing traffic levels and is measured on activation + quality, not acquisition.

---

## Owner decisions (locked 2026-07-14)

1. **Trial length → 7 days**, conditioned on the verification mandate above: the product must verifiably deliver inside the trial or the extension just grows churn. See the trial sweep item (billing change + copy sweep + end-to-end verify).
2. **The brain's name → LOCKED: Vera** (owner pick, 2026-07-14; from Vant*era* — warm, reads as a rep's name). Threading rule: Vera is **introduced once, properly, at the homepage hero/showcase level** ("Meet Vera") and then referenced consistently across marketing + product; deep pages built name-agnostic get the name threaded in the same pass. Never sprinkle the name on a surface before any surface has defined who Vera is.
3. **Google SSO → later** (still a known B=MAP friction leak at signup; revisit post-launch).
4. **Hero calendar proven-play overlay → idea explained, build as a polish pass after copy + pages land.** The idea: the hero currently tells a two-node story (LinkedIn → calendar) and skips the *why*. Insert the missing middle node — a small glass "play card" mid-conduit that each animated packet passes through, showing the play in use ("Proven opener · peer-reference angle · 9.4% reply ▲") with a periodic subtle upgrade-swap to a sharper play. Three-node story: **LinkedIn → the proven play (the intelligence) → booked calendar.** Built in the calendar's own design language (same glassmorphism, brand tint, motion system) so it reads as one piece. Any stat shown must be real or the chip ships label-only.
