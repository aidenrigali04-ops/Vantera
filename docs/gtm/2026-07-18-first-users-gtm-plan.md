# Vantera — First-Users GTM Plan + Copy Library (2026-07-18)

Constraints this plan is built for (owner-confirmed): **$0 budget · founder-led sales · established LinkedIn audience · goal = first paying customers in 30–60 days.**

All outreach copy below is verified against Vantera's own brain — it passes `validateLinkedInDraft` + `validateHumanity` from `packages/agent-brains/src/copy/` with **0 violations**.

---

## 1. Thesis — "Vantera sells Vantera"

The product prospects, qualifies, and drafts LinkedIn outreach. The buyers *are* people who do LinkedIn outreach — exactly who the founder is connected to. So the engine is a closed loop: **run Vantera on the founder's LinkedIn to prospect Vantera's buyers, and every meeting it books is the proof it works.** Cold open writes itself: *"An AI running my LinkedIn found you and started this. Want it running yours?"*

**The real bottleneck is not acquisition — it's activation.** The funnel leaks at *interested → booked meeting* (past data: ~10 interested → 0 meetings; activation stalls at the review queue). So the motion is deliberately **low-volume, high-touch**: a few design partners the founder personally drags to a real outcome. Three customers with a booked meeting + testimonial beat ten stalled signups.

## 2. The three stacked motions (one substrate: the founder's LinkedIn, $0, founder-led)

- **A. Dogfood + founder-led concierge (engine).** Product prospects the ICP within LinkedIn safety limits (~14/day); founder personally demos, closes, and hand-holds each first customer to their first booked meeting. Highest conversion; self-proving.
- **B. Content flywheel (amplifier).** 3–5 posts/week to the existing audience — the ban angle, qualify-not-spray, build-in-public, teardowns, the meta-story ("I built an AI that booked its own demos"). Inbound DMs feed the same demo motion. Repurpose the 4 Remotion ad spots.
- **C. Competitor-switcher / ban-rescue (wedge).** Target frustrated Waalaxy/Dripify/Expandi/Goji Berry users + people whose LinkedIn got restricted; the safety-limits are the answer. Sharpens who A and B target. (Intent agent already watches these competitors + intent keywords — leave it.)

## 3. Account config applied to `aiden@vanterasystem.com` (2026-07-18)

- `sender_name` = **Aiden Rigali** (was null).
- Copy CTA (the conversation goal the brain steers toward; booking link stays whitelisted for later touches):
  > "Get them on a quick 15-minute live look where they watch it find and qualify buyers on their own ICP and draft a real message, so they see it work before deciding."
- Booking link (already set): `https://calendly.com/aiden-vanterasystem/30min`
- Scout ICPs (3 slots, sharpened toward "small B2B, does its own outreach, buys self-serve"):
  1. **Agencies & Lead-Gen** — agency/lead-gen owners who run outreach for clients (multi-seat, do the most outreach). Sizes 1-10, 11-50.
  2. **Founders & Solopreneurs** — founders/solopreneurs at small B2B doing their own outreach. Sizes 1-10, 11-50.
  3. **Small-Team Sales Leaders** — sales leaders at small B2B, guarded by industry + size (`11-50/51-200`) so it excludes enterprise. *(This fixed the old "VP of Sales" ICP that had no guards and was pulling enterprise VPs who never buy self-serve.)*

## 4. Methodology — why the copy looks the way it does

Vantera's copy brain enforces a **de-pitched first touch** + a strict humanizer. Any new copy must follow these or it gets flagged into the review queue:

- **Connection note** (< 200 chars): reference a genuine commonality/trigger only. **No pitch, no CTA, no links.**
- **First message** (after accept, < 180 chars / < 28 words): brief thanks + ONE sharp observation about *them* + ONE curious question. **No product name, no link, no meeting ask** — the question *is* the CTA. Pitch + booking link come in *later* touches.
- **Humanizer (zero tolerance):** no dashes of any kind as punctuation (use commas / new sentences), no semicolons, no bullet/numbered lists, ≤1 exclamation, minimal hedging, everyday words (never: leverage, streamline, elevate, seamless, game-changer, "reach out," "excited to connect," "feel free to," "quick question," etc.), contractions, one thought per sentence.
- **Grounding:** never state a %, $, or Nx figure that isn't in the prospect's own data; never claim an action the agent can't take.

## 5. Copy library (all humanizer-verified, 0 violations)

### Cold sequence (this is what the product also auto-drafts)
**Connection note** *(160/200 chars)*
> Hi [First], your post on [topic] really landed, especially the bit about [specific point]. Keen to connect and follow your stuff.

**First message** *(after accept · 151c / 25w · question = CTA)*
> Thanks for connecting [First]! How are you handling LinkedIn prospecting these days, all by hand or with a tool? Curious what's actually working for you.

**Touch 2** *(after they reply — soft reveal)*
> Yeah I hear that a lot. I got tired of the spray tools that put your account at risk, so I built one that qualifies people first and drafts the outreach for me to approve. Funny thing, it's actually how I found you.

**Touch 3** *(booking — link allowed now)*
> If you're up for it, easiest is a quick 15 minute live look. I'll run it on your own ICP and you'll see the buyers it surfaces in the first couple minutes. Grab a time here if useful: https://calendly.com/aiden-vanterasystem/30min

### Cold first-message openers, per ICP (swap in place of the generic first message)
- **Agencies** *(163c/25w)* → Thanks for connecting [First]! How's your team handling prospecting across clients right now, mostly manual or with tools? Curious what's holding up at your scale.
- **Founders** *(161c/25w)* → Thanks for connecting [First]! How are you finding time for LinkedIn prospecting on top of everything else? Curious if you've found anything that actually works.
- **Sales leaders** *(160c/25w)* → Thanks for connecting [First]! How are your reps sourcing LinkedIn conversations these days, by hand or with a tool? Curious what's actually converting for you.

### Warm DMs, per ICP (founder-to-known-contact — more direct is fine here)
**Agencies & Lead-Gen**
> Hey [First], random one. I spent the last few months building Vantera, it runs LinkedIn outreach the way agencies actually need. It finds and qualifies the right people for each client, drafts the messages for you to approve, and stays inside safe limits so no client account gets flagged. I'm taking 5 founding agencies before I open it up and I'd rather they be people I trust. I'll set it up with you myself, and we don't call it a win until it's booking your clients real conversations. Founding rate, and if it's not pulling its weight you walk. You run this across a bunch of clients, so you'd feel the difference fast. Want me to run it live on one of your client ICPs? [calendly]

**Founders & Solopreneurs**
> Hey [First], random one. I spent the last few months building Vantera, it does the LinkedIn prospecting I never have time for. It finds and qualifies the right buyers, drafts the outreach for me to approve, and stays inside safe limits so my account never gets flagged. I'm taking 5 founding users before I open it up and I'd rather they be people I trust. I'll set it up with you myself, and we don't call it a win until it's booking you real conversations. Founding rate, and if it's not pulling its weight you walk. You're wearing every hat right now, so getting pipeline off your plate would help. Want me to run it live on your own ICP? [calendly]

**Small-Team Sales Leaders**
> Hey [First], random one. I spent the last few months building Vantera, it keeps a LinkedIn pipeline full without the busywork. It finds and qualifies the right buyers, drafts the outreach for your team to approve, and stays inside safe limits so nobody's account gets flagged. I'm taking 5 founding teams before I open it up and I'd rather they be people I trust. I'll set it up with you myself, and we don't call it a win until it's booking your team real conversations. Founding rate, and if it's not pulling its weight you walk. Your reps should be talking to qualified people, not digging for them. Want me to run it live on your team's ICP? [calendly]

### Objection handles
- **Price** → Founding users lock a founding rate for life. But I only want you paying once it's booking you conversations, so I'll prove it first.
- **Bans** → Opposite, that's the whole reason I built it. Hard safety limits, human pacing, and you approve every send. It protects your account.
- **Already use Waalaxy/Expandi** → Then you know the pain. Volume with no qualifying, plus the account risk. Mine qualifies first so you're not spraying, and stays safe. I'll move you over free, want 15 minutes?
- **Send info** → Easiest is 15 minutes live on your own ICP, you'll get it in the first two minutes. Or I'll send a 60 second Loom first if you'd rather.

## 6. Targets (30–60 days)

- **Week 1:** booking link live (done) · ICPs dialed (done) · 20+ warm DMs sent · product prospecting live · first posts up.
- **Weeks 2–4:** 3–5 paying design partners · each concierge'd to a first booked meeting · 2 written case studies.
- **Ongoing:** content-driven inbound rising · cold dogfood funnel maturing into the switcher wedge.

## 7. Next best action

Send the **warm DM** to the 10 warmest connections who actually do outreach (pick the matching per-ICP variant), and let the product's cold sequence run in parallel. Steps only the founder can do; everything else is copy-paste ready above.

## Open dependency / watch-items
- Activation gap (interested → booked meeting) is the true risk — the concierge motion is what covers it until the product closes it natively.
- Prod AI runs on the same Anthropic workspace as CI evals — keep it funded (a dry balance silently stalls prospecting). A low-balance alert is still unbuilt.
