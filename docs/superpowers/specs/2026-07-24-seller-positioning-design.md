# Seller-Authored Positioning — value prop, brand voice, guardrails

- **Date:** 2026-07-24
- **Status:** Design (awaiting owner review)
- **Scope:** `packages/db` (1 migration), onboarding (capture), Settings (edit), `packages/jobs/src/pipeline` (2 loaders), help-content. Copy/reply brains need NO prompt change — the injection points already exist.
- **Owner decisions (2026-07-24):** (1) Capture at **onboarding + editable in Settings**. (2) The cold **opener stays de-pitched** — brand voice + guardrails apply everywhere (incl. the opener), but the value-prop *substance* stays out of the connection request; it arms the conversation.

## Problem (from the 2026-07-24 positioning analysis)

The platform understands each seller's positioning only shallowly, and two of the fields it's *built to use* are inert:

1. **The seller's entire "offer" is one AI-guessed sentence.** `CopyContext.valueProp` is set *only* to `website_scan.summary` — an AI-generated homepage summary the seller never writes or edits ([copy-draft.ts:51](../../../packages/jobs/src/pipeline/copy-draft.ts#L51), [pg-store.ts:2176](../../../packages/jobs/src/pipeline/pg-store.ts#L2176)). There is no field for the seller to state their positioning in their own words.
2. **Brand voice + guardrails are dead fields.** `leadBlock` renders `Brand voice (match this tone): …` and `Guardrails (never violate): …` ([shared.ts:253-254](../../../packages/agent-brains/src/copy/shared.ts#L253)), but **nothing populates them** — no `accounts` column, no config key, no loader (verified: source references are only the type declaration + the render). Every seller gets the same global voice, and a seller literally cannot say "never claim we're SOC 2 certified."

## Goal

Let each seller author three positioning fields — **value proposition**, **brand voice**, **guardrails** — and feed them into the copy/reply brains through the existing `leadBlock` path, with **zero regression** for accounts that leave them blank.

## Design

### Key property: the injection half already exists

`leadBlock` ([shared.ts:244-268](../../../packages/agent-brains/src/copy/shared.ts#L244)) already renders all three fields *when present* on `CopyContext` (`valueProp` → `Seller offer`, `brandVoice`, `guardrails`). So this feature is **capture + storage + loader wiring** — not a prompt rewrite. The brains change behavior only because the loaders will now supply real values.

### Data model — 3 new nullable `accounts` columns

One migration adding to `accounts` (all `text`, nullable):
- `value_prop` — the seller's own one-to-three-sentence positioning.
- `brand_voice` — free-text tone description (e.g. "warm, direct, hospitality-insider").
- `guardrails` — free-text "never say" rules, one per line.

Rationale for account-level (not `agents.config`): these are account *identity*, consistent with `name`/`onboarding_industry`, and the loaders already read `accounts` for those.

**Critical (rule 02 + column-grants gotcha):** `accounts` already has RLS; these columns inherit it. But client-writable `accounts` columns need an **explicit column-level `UPDATE` grant** in the same migration or onboarding/Settings saves fail with "permission denied" (this has bitten before). The migration MUST `GRANT UPDATE (value_prop, brand_voice, guardrails) ON accounts TO authenticated`. rls-auditor pass required.

### Capture — onboarding (value prop only) + Settings (all three)

**Onboarding — value prop, scan-prefilled (protects the friction-sensitive flow):** the website scan already runs during `savePersonalize` and produces `summary` ([website-scan.ts:14](../../../packages/agent-brains/src/prospect/website-scan.ts#L14)). In the **Confirm** step ([wizard.tsx](../../../apps/web/src/app/onboarding/wizard.tsx), where targeting is already confirmed), add one editable field — *"How should the agent describe what you do?"* — **prefilled with `website_scan.summary`**. The seller confirms or edits one sentence rather than writing from scratch. `findFirstLeads` ([actions.ts:165](../../../apps/web/src/app/onboarding/actions.ts#L165)) writes it to `accounts.value_prop`. Brand voice + guardrails are NOT added to onboarding (they're refinements; adding three fields would bloat the flow) — they live in Settings with a nudge. This applies the owner's "onboarding + Settings" choice to the core field while keeping onboarding lean.

**Settings — all three, editable anytime:** a new **Settings › Positioning** page, modeled on the existing **Proof & pricing** editor ([proof-editor.tsx](../../../apps/web/src/app/(app)/settings/proof/proof-editor.tsx)). Three fields: value prop (textarea), brand voice (short input), guardrails (textarea, "one rule per line"). A server action `updatePositioning` writes the three columns (session-scoped account, never an accountId param — rule 13). This is also where a seller edits the value prop the scan seeded.

### Injection — loader precedence + scope

**Value prop precedence (no regression):** both loaders set `valueProp = accounts.value_prop ?? website_scan.summary`. Blank → current behavior exactly. Filled → the seller's own words. Apply in:
- First touch: `toDraftInput` / `getCopyContext` ([copy-draft.ts:43-56](../../../packages/jobs/src/pipeline/copy-draft.ts#L43)).
- Responder/follow-up: `getResponderBundle` ([pg-store.ts:2167-2185](../../../packages/jobs/src/pipeline/pg-store.ts#L2167)).

**Voice + guardrails — apply everywhere.** Both loaders set `brandVoice = accounts.brand_voice` and `guardrails = accounts.guardrails`. This means `toDraftInput` (first touch) must now include these two fields (it currently omits them). `leadBlock` renders them for both surfaces; null → omitted (no regression).

**Opener stays de-pitched (owner decision) — no prompt change needed.** The first-touch prompt *already* forbids describing the seller's offer or using the CTA as an ask in the connection request ([linkedin.ts:48-50](../../../packages/agent-brains/src/copy/linkedin.ts#L48)). So even though `Seller offer: {value_prop}` is in the block, the opener won't pitch it — exactly the chosen behavior. The self-authored value prop simply makes the "Seller offer" line accurate for the *conversation*, and improves the `deriveAccountProfile` trust read ([profile.ts:110](../../../packages/agent-brains/src/copy/profile.ts#L110)), which is the only functional consumer of `valueProp` today. Guardrails now reach the opener too — a safety win (a seller's "never claim X" applies from message one).

### Never-hallucinate (owner's standing rule)

- **Value prop + guardrails are seller-attested truth**, so they're safe to assert — the same basis as proof points. Because the value-prop text joins the grounding block, any metric the seller writes in it is whitelisted by `findUngroundedClaims` exactly as proof-point metrics are (the seller vouches for their own claim). No new hallucination surface.
- **Brand voice changes tone only** — never facts.
- **Guardrails only ADD constraints** — they can never loosen the global `VOICE_RULES`/`PROSPECT_ACCURACY_RULE`. Enforcement is prompt-level (soft), with the review queue as the backstop (rule 06/11). Deterministic per-account guardrail phrase-matching in the humanizer is a possible future hardening — **out of scope** here.

## Components (boundaries)

1. **Migration** — 3 columns + `UPDATE` grant. One file in `packages/db/migrations/`, guardrail/RLS test.
2. **Onboarding** — one prefilled field in the Confirm step + `findFirstLeads` writing `value_prop`; validation in `apps/web/src/lib/validation.ts` (optional, max length).
3. **Settings › Positioning** — page + form + `updatePositioning` action + validation (pure, colocated test).
4. **Loaders** — `toDraftInput`/`getCopyContext` + `getResponderBundle` read the 3 columns and apply the `??` precedence.
5. **Help article** — `packages/help-content/content/settings-positioning.md` (rule 09 knowledge-sync).

## Testing (TDD, rule 12)

- Loader: `value_prop` set → `CopyContext.valueProp` is the seller's text; blank → falls back to `website_scan.summary` (both loaders).
- Loader: `brand_voice`/`guardrails` set → present on `CopyContext`; blank → absent.
- `leadBlock` (already tested) with the new values → renders the Brand voice / Guardrails / Seller offer lines; blank → omitted (byte-identical to today).
- First touch: with guardrails set, the block carries "Guardrails (never violate)"; opener still de-pitched (existing linkedin.ts tests stay green — no offer/CTA in the connection note).
- Grounding: a metric inside a seller value prop is whitelisted (not flagged) — mirrors the proof-point grounding test.
- Onboarding action: confirm writes `value_prop`; prefill = scan summary.
- Settings action: `updatePositioning` writes all three, session-scoped; validation rejects over-length.
- Migration: RLS + column-grant guardrail test (a second tenant can't update another account's positioning).

## Definition of Done (rule 12 + building-vantera-features)

RLS + column grant in the migration with guardrail test; white-label (no vendor names — N/A for these fields but verify copy); knowledge-sync help article in the same PR; TDD throughout; suppression N/A (no send-path change). Full gate green.

## Risks & mitigations

- **Onboarding friction** → mitigated by prefilling the value prop from the scan (confirm/edit one sentence, not author from blank); voice/guardrails kept out of onboarding.
- **Column-grant "permission denied"** → explicit `GRANT UPDATE (…)` in the migration; covered by the guardrail test.
- **Frozen stale value prop** → onboarding persists the confirmed text as authoritative; a re-scan won't override the seller's own words (correct), and Settings lets them update it anytime.
- **Guardrails are soft (prompt-enforced)** → acknowledged; review queue is the backstop; deterministic hardening deferred.

## Out of scope

- Structured ICP capture; dropping the scan's `offerings[]`/`value_props[]` (analysis gap #4); deeper conversation-arming prompt work (gap #3) beyond making the real value prop available.
- Per-account deterministic guardrail phrase-matching in the humanizer.
- Reviving `onboarding_role` / `sender_name` (separate dead-field cleanup).
