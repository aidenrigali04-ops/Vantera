# The Reveal + Freemium Tithe — growth design (DRAFT, not green-lit)

**Status: DRAFT — owner is still working out details. Nothing here is approved for build.
Revisit by name: "reveal-freemium-growth".**

Date: 2026-07-15. Method: YC-head-executive comparison/optimization (standing directive).
Source: owner's three proposals (Vantera-account outreach methodology, platform-wide
de-robotization, freemium with self-marketing tithe + trial fork panel), analyzed against
the live codebase and prod state — no changes made.

**The unifying insight:** all three are one idea at three scales — *the message is the demo*.
From the founder's account it's a sales methodology; generalized it's a copy philosophy;
baked into freemium it's a growth loop where usage itself is distribution (Loom-watermark /
"Sent via Superhuman" mechanics, applied to the one category where the recipient experiences
the product in the act of reading the pitch).

---

## Part 1 — The Proof-of-Work Reveal (Vantera/Aiden account methodology)

**Problem it solves:** Vantera has no borrowable proof (no case studies, ~zero external MRR).
The disclosure play converts that weakness into self-verifying proof: *"you read this far,
and a machine wrote it."* Pre-empts the smell-a-template objection by confessing before
detection.

**Why the naive version ("lead with: this message was sent with Vantera…") underperforms:**
line one becomes the sender's agenda — still a pitch. A magic trick announced before it's
performed isn't magic. The reveal has force only AFTER the message has passed as human.

**The methodology — three beats mapped onto the existing sequence (invite → first DM →
conversation), never crammed into one message:**

1. **Earn** (invite / opening observation): one researched, specific, them-only observation.
   The most human Vera play, zero product mention. This beat is what the reveal grades.
2. **Reveal** (first DM, inside the 180-char cap): the confession that reframes beat 1 —
   *"honest one — an AI researched your post about X, decided you fit, and wrote this. it's
   my product: Vantera, LinkedIn lead gen. you just sat through the demo. worth a look?"*
3. **Mirror** (conversation + interest check): the reply thread is demo #2; the close is the
   mirror — *"it just did for me what it'd do for you: found a qualified buyer and started a
   real conversation. want it pointed at your ICP?"* Booking link at interest (existing
   engine behavior).

**How to prove it's #1:** run meta-reveal as a **challenger vs. the pain-first champion** on
the Vantera account only. Stage-1 recipe stamps give send→outcome attribution per arm; the
experiment engine (decideExperiment) concludes on evidence. Instrument, don't argue.
Implementation shape when green-lit: a Vantera-account-only play/recipe (openerAngle-style
knob or dedicated play), zero new product surface.

---

## Part 2 — Generalizing to platform copy (de-robotization)

**Boundary (hard rule):** the disclosure does NOT generalize to paying customers — their
outreach must read as *them*. The disclosure belongs to exactly two senders: the Vantera
account, and the freemium tithe sends (Part 3).

**The robotic tells** (still present despite humanizer/length caps/avoid-phrases):
- Any sentence that could live on a landing page ("we help X do Y without Z").
- Completing the whole sale in one message (pitch + credibility + CTA = cold-call script).
- Perfection itself: balanced clauses, complete sentences, the "X, Y, and Z" tricolon.
- Symmetric courtesy ("Hope you're doing well" + formal sign-off).

**Generalizable principles (priority order):**
1. **Message-as-proof** — every sentence must be recipient-verifiable ("saw your post
   about…"); delete anything merely assertable.
2. **One thought per message** — first touch = observation + light question; interest-check
   vocabulary IS the CTA ("worth a look?", "off base?").
3. **Texture budget** — fragments, contractions, uneven rhythm; ban tricolons.
4. **Them-to-you ratio** — count prospect-references vs. sender/product-references; first
   touches lopsidedly *them*. Lintable, learnable metric.

**Strategic point:** these should become recipe knobs the Stage-1b bandit explores (texture
knobs joining openerAngle), so the platform *learns* toward human instead of being prompted
toward it.

---

## Part 3 — Freemium tithe + trial fork panel

**The proposal (owner):** post-onboarding fork — (a) Free plan: 80 of 100 weekly prospects
are the user's, 20 run Vantera's own marketing from the user's account; (b) regular 7-day
trial. Internal marketing structure = the Part-1 methodology.

**What's great:** attacks BOTH provable drop-offs from the conversion audit — traffic (every
freemium user is a distribution channel) and activation (no 7-day cliff; expired trials get
a landing pad instead of dying). The currency is elegant: users pay with LinkedIn send
capacity — the one asset they have and Vantera lacks. Nobody in the category does
capacity-tithe freemium.

**Four failure modes + the fixes that preserve the loop:**
1. **Endorsement problem (fatal if ignored):** a message from a user's account promoting
   Vantera reads as their endorsement — and they haven't gotten value yet. **Fix: the
   disclosure IS the feature** — tithe sends use the Reveal structure honestly adapted:
   *"this conversation was started by Vantera, an AI lead-gen system — I'm on its free plan,
   and part of the deal is it gets to introduce itself."* Only version that survives a
   screenshot on X.
2. **Risk asymmetry:** the ~100-invite/week ceiling is the USER's safety budget. Tithe comes
   OUT of quota (20 of 100, never on top), identical pacing/ramp envelope, explicit consent
   checkbox at the fork (timestamp + copy version stored — the legal consent record).
3. **Targeting collision:** tithe targets are NEVER drawn from the user's prospect pool —
   Vantera's ICP, sourced on Vantera's own discovery spend; the user's account is the
   sending channel only. Their 80 stay 100% theirs.
4. **Economics unknowable at N=0:** every freemium user carries real per-seat vendor cost
   (LinkedIn connection) + discovery/AI spend. Whether 20 disclosed sends/week cover it is
   unmeasurable with zero external users → see sequencing.

### The fork panel — "two doors, one default" (choose-then-connect)

**Why before connect, not after:** trial-on-connect quietly created hesitation — "connecting
spends my 7 days, I'll wait." The free door removes that exact fear, so the fork REMOVES
friction only if shown before the commitment. Choose-then-connect wins.

**Display:** one panel, interposed ONCE when a not-yet-connected trialing account clicks any
Connect-LinkedIn CTA (banner, task card, channels). Never shown again after a choice.
- Header: "Connect LinkedIn to put Vera to work." Subline: "Pick how you start — you can
  switch anytime." (Gain-framing replaces clock-framing.)
- **Door 1 (pre-selected, primary): 7-day All-Access trial** — "Everything unlocked. All 100
  weekly prospects are yours. $79/mo after — cancel anytime, your data stays."
- **Door 2: Free plan** — "Free forever. 80 of your 100 weekly prospects are yours; Vera
  introduces Vantera to the other 20 — honestly disclosed, from your account, inside the
  same safety limits." + consent checkbox ("I'm OK with 20 disclosed intros/week from my
  LinkedIn").
- One primary button: "Connect LinkedIn →" (executes the selected door). Default path = one
  tap, zero extra decisions.
- Trust line: "Nothing sends without your approval either way."

**Semantics:** trial door → existing idempotent clock-stamp at connect, untouched. Free door
→ no clock, account flagged free, tithe activates only behind the consent flag. Grandfather
all existing accounts; skip for invited team members; never on reconnect-in-place.

### Upgrade at any time — four arrows, not one
- **Free → Paid:** one click, placed at desire peaks: the capacity meter ("80 of 100 yours —
  unlock all 100") + win moments (first interested reply, first booking). Peak-end rule.
- **Free → Trial:** yes, ONCE per account, startable anytime (warmed-up trials convert);
  trial consumed → straight to paid.
- **Trial → Free:** at expiry, the dead-end becomes the downgrade offer (resurrection path).
- **Paid → Free on cancel:** cancellation flow offers the free plan instead of the exit.

**Paid must beat free by more than 20 prospects:** paid = all 100 + NO tithe + premium
surfaces (Intent, team seats, CRM push). The tithe is the free plan's price; exclusivity is
part of what $79 buys.

---

## Sequencing (the spine of the whole design)

1. **Reveal pilot on the Vantera account** — challenger vs. pain-first champion, existing
   experiment machinery, zero new product surface. THE prerequisite number.
2. **Texture knobs into the recipe space** — platform copy learns toward human.
3. **Fork panel + freemium tithe ship together as one round** — only after the reveal has a
   real conversion number. A one-door panel is pure friction; don't build it without the
   free door, and don't open the free door without the number.

**The founder-account pilot IS the freemium pilot** (same copy structure, same disclosure,
same conversion question, N=1 account) — "do things that don't scale," then scale.

## Open questions the owner is still working out
- Freemium feature set beyond the 80/20 split (which premium surfaces stay paid-only).
- Tithe target sourcing budget (Vantera's own discovery spend per freemium user).
- Whether tithe replies route to the Vantera account's inbox or a dedicated ops surface.
- Free→Trial one-shot policy details; Paid→Free cancel-flow copy.
- Panel timing vs. TRIAL_LEAD_CAP pre-connect economics.
