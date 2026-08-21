# Config-Aware Approach Selection — design (2026-07-21)

Extends `2026-07-20-message-shape-selector-design.md`. Grounded in the live copy brain.

## Goal

The brain should **read each user's configured platform and take the best course of action for that
config**, not apply one default and learn from zero. Config sets a smart prior; the per-account bandit
refines it from that user's real outcomes. Both together = "best output for each user's config."

Today the shape/approach is chosen from (a) the *lead's* signal and (b) what the bandit has learned.
It is NOT yet a function of the *user's configuration*. This layer closes that.

## What config the brain actually has (real fields, no new plumbing)

The full account context (`getCopyContext` → `CopyContext`, `copy/shared.ts:13`) already carries:
- `cta` — the user's configured goal ("book a 15-min intro", "start a free trial", "see the work").
- `bookingUrl` vs `websiteUrl` — a booking-first business vs a traffic-first / self-serve one.
- `accountIndustry` — the seller's vertical.
- `valueProp` — website-scan summary of what they sell.
- `contentLinks` / `assets` — whether the user has an artifact to give.
- `proofPoints` — the account's citable evidence.

(The trimmed first-touch `DraftInput.context` drops `bookingUrl`/`proofPoints` on purpose — first touch
is link-free — but the profile is derived in the JOBS layer from the FULL `ctx`, where they exist,
then passed into the pure brain selector.)

## The profile (pure, deterministic, explainable)

New pure fn in `packages/agent-brains/src/copy/` — `deriveAccountProfile(config)`:

```ts
type AccountConfigProfile = {
  conversionStyle: "booking" | "self_serve" | "traffic" | "reply";
  trust: "high" | "standard";
  hasArtifact: boolean;   // a real asset/content link exists → "gift" is viable
  proofDepth: "rich" | "some" | "none";
};
```

Derivation (from real fields, all deterministic):
- `conversionStyle`: `cta` keyword scan first (book/call/demo/meeting → booking; try/trial/free/start/sign up → self_serve; see/look/portfolio/site + `websiteUrl` and no `bookingUrl` → traffic; else reply). `bookingUrl` present reinforces booking; only `websiteUrl` reinforces traffic.
- `trust`: `accountIndustry` (+ `valueProp`) matched against a regulated/high-trust set (finance, banking, wealth, insurance, legal, law, health, medical, pharma, government) → `high`; else `standard`.
- `hasArtifact`: any non-empty `contentLinks`/asset.
- `proofDepth`: `proofPoints.length` → 0 none / 1 some / ≥2 rich.

Absent/empty config degrades to the safe profile (`reply`, `standard`, false, `none`) — identical to
today's behavior.

## The policy — profile biases APPROACH only (never facts)

Config-aware `selectMessageShape(leadSignal, profile)` — the champion default when the feature is on:

| Situation | Chosen default | Why |
|---|---|---|
| Real lead trigger present (any profile) | `trigger_consequence` | timing is real; the strongest opener regardless of config |
| `trust: high` (and no trigger) | `observation_question` | regulated/high-trust buyers: conservative, safe, never a gimmick |
| `self_serve` + `hasArtifact` | `gift` | show value, drive to try — self-serve arc |
| `traffic` (site, no booking) | `gift` or `observation_question` | traffic-first businesses convert on seeing, not talking |
| booking, `standard` trust, no trigger | `observation_question` | start a real conversation toward the call |
| else | `observation_question` (safe floor) | |

Bandit **eligibility** per account (the generator's proposable set):
- `trust: high` → **exclude** `provocation` and `disqualifier` from auto-exploration (too aggressive for
  a regulated seller's brand). Calmer shapes only.
- `self_serve`/`traffic` → `gift` is fully in-play.
- Bold shapes remain founder-account-pinned regardless (unchanged).

The profile is a **prior + eligibility filter**. Within eligibility the per-account bandit still learns
and can override the default from real outcomes — so a config that starts on `observation_question`
can be moved to `gift` by that account's own results.

## Invariants (unchanged, must hold)

1. **No new hallucination surface.** The profile chooses *approach knobs only*. Facts still come from
   the grounding block; `findUngroundedClaims`, `findActionClaims`, `PROSPECT_ACCURACY_RULE`, and the
   shape-signal grounding guard all run unchanged on every shape. `deriveAccountProfile` never touches
   message content.
2. **Byte-identical when off.** Config-aware selection lives inside the `message_shape_auto` gate; with
   the feature off, nothing derives a profile and the prompt/recipe are byte-identical (as verified).
3. **Signal still gates facts.** `trigger_consequence` still requires a real (non-placeholder) trigger
   even if the profile would prefer it — config never licenses a fact-asserting shape without its signal.
4. **Brain purity.** `deriveAccountProfile` + `selectMessageShape` are pure (plain config object in, no
   DB/AI-SDK); the jobs layer assembles the config subset from `ctx` and passes it in.

## Tests
- Profile derivation: each `conversionStyle`/`trust`/`hasArtifact`/`proofDepth` from representative real
  config combos; absent config → safe profile.
- Config-aware selection: high-trust → `observation_question` (never `provocation`); self_serve+artifact
  → `gift`; real trigger → `trigger_consequence` regardless of profile; placeholder trigger still NOT
  licensed even on a booking/self-serve profile.
- Eligibility: high-trust account never gets `provocation`/`disqualifier` proposed by the generator;
  bold shapes still founder-pinned.
- Byte-identical: `message_shape_auto` OFF → no profile derived, champion byte-identical (prompt + hash).
- Purity + full gate.
