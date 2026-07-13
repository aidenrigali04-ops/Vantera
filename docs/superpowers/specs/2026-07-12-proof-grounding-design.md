# Proof Grounding — citable proof, pricing & FAQ facts for the conversation engine

**Status:** scoped (recommendation), not built. Emerged from the 2026-07-11/12 conversation-quality
simulations (see the conversation-engine-quality branch).

## Problem

The reply brain refuses to fabricate specifics — the anti-hallucination guard (`findUngroundedClaims`)
flags any metric/$/×/case-study claim not present in the message's grounding. That guard is correct
and load-bearing (report pain-point #6). But it exposes a gap: when a warm prospect asks for proof,
the account usually has **nothing true to say**, so the brain either deflects or safely refuses,
stalling ready-to-book buyers.

Two live simulations reproduced it exactly:

- A hot HR-tech buyer (Scenario D) was ready to book but asked *"what do show rates actually look like —
  a rough number or a real example — before I block time."* The brain had no grounded proof, deflected
  with *"I'll show you on the call,"* and she flagged it: *"that's a red flag."* The brain then correctly
  refused to invent a case study.
- An earlier run fabricated *"$2k–$4k/mo"* when pushed on pricing — **caught by the guard, routed to
  review, never sent.**

The guard is working. The missing piece is a way to give the brain **true facts it's allowed to cite.**

## Goal

Let an account store a small set of TRUE, citable facts — outcome metrics, anonymized case studies,
pricing, and FAQ answers — that flow into the brains' grounding so they can (a) weave them into replies
**when relevant**, and (b) pass the anti-hallucination whitelist automatically.

## Key mechanic (verified in code)

`findUngroundedClaims(text, grounding)` whitelists a metric iff
`normalize(grounding).includes(normalize(metricToken))`, where `grounding` is the `leadBlock` string
(`copy/humanizer.ts`, confirmed by `copy/grounding.test.ts`). **So injecting proof text into `leadBlock`
makes any metric the message quotes from it pass, with zero humanizer changes.** This is why the feature
is small — it reuses the grounding + whitelist machinery end to end.

## Design

### 1. Data — one additive migration (next in sequence, ~`0046_proof_points.sql`)

New account-scoped table `proof_points`:

| column | notes |
|---|---|
| `id` uuid pk | |
| `account_id` uuid fk → accounts, cascade | tenant scope |
| `kind` text check in (`metric`, `outcome`, `pricing`, `faq`) | drives how the brain uses it |
| `text` text not null | the citable sentence, quoted verbatim |
| `question` text null | only for `faq` (the objection this answers) |
| `sort` int / `created_at` / `updated_at` | ordering + timestamps |

- **RLS in the same migration (rule 02):** member `select` + member write (this is the account's own
  config, client-editable — same posture as other account settings), with a guardrail test.
- **Account-level, not per-agent:** proof is about the seller's offer (like `accounts.website_scan`),
  used by every outreach + reply. One list per account.
- No retention window needed (account config, not prospect data).

### 2. Brain grounding (`leadBlock` only; rank + humanizer untouched)

- Extend `CopyContext` with `proofPoints?: ProofPoint[]` (`{ kind, text, question? }`).
- `leadBlock` renders a bounded **"Proof you may cite"** section — the facts verbatim, plus the rule:
  *"Use these ONLY when they genuinely strengthen your point or the prospect asks for evidence or price.
  Never stuff a message with stats. Quote them as written, never invent beyond them, and if they ask for
  a number that isn't here, say you don't have it rather than guessing. Pricing: share it when they ask
  about cost."*
- Because the proof text is in `leadBlock`, `findUngroundedClaims` whitelists any metric quoted from it.
  **No humanizer change.**
- **First touch is unaffected** — `LINKEDIN_SYSTEM` still forbids metrics/pitch in DM 1; proof is a
  mid-conversation tool, available in the shared block but suppressed there by the first-touch rules.

### 3. Wiring (`pg-store` bundles — two reads)

- `getResponderBundle` and the copy-draft bundle already assemble `context` from account + agent rows.
  Add one read of `proof_points` for the account → `context.proofPoints`.

### 4. UI — a settings page

- **Settings › "Proof & pricing"** (account-level, admin-editable): a list editor to add / edit /
  remove / reorder proof points, each a `kind` + one-line fact (+ `question` for FAQ).
- **Accuracy attestation on save:** *"These are sent to prospects as fact on your behalf. Only add true,
  verifiable statements. Use anonymized references ('a fintech client') unless you have permission to name
  a customer."* (Honesty contract + fictional-names integrity, rules 06/11.)
- **Optional (v1.1):** surface the same editor inside the Outreach agent wizard's "Add Content" step so
  it's discoverable at setup.

### 5. Knowledge-sync (rule 09)

- `proof-points.md` help article (surface: settings) — what proof grounding is, how to write a strong
  proof point, and the honesty rule.
- Optional read-only copilot tool `getProofPoints` so the assistant can answer *"what proof am I sharing?"*

## Guardrails / honesty

- Facts are the account's attestation. Anonymized customer references encouraged; named customers only
  with permission — **no fabricated names** (carries the fictional-names integrity rule).
- The brain cites **sparingly and only when relevant** (prompt-enforced); never in the first DM.
- The anti-hallucination guard is unchanged and still flags anything cited that isn't a proof point —
  proof grounding *widens* what's true to say, it never loosens the guard.

## Scope boundaries (YAGNI)

- **IN:** the table + RLS + guardrail test; `context.proofPoints` injection into `leadBlock` (+ test);
  two pg-store reads; the settings list editor + attestation; `proof-points.md`.
- **OUT (later):** auto-extracting proof from the website scan; per-ICP/segment proof targeting;
  A/B proof variants; attachments/media as proof; automated claim verification; stat freshness/expiry.

## Definition of done (rule 12)

Migration + RLS + guardrail test; brain grounding + a `leadBlock`/grounding test (a proof metric
whitelists a cited metric; absent proof → the same metric still flagged); pg-store wiring; settings UI +
attestation; `proof-points.md`; whitelabel-auditor pass; full gate green. No new send path (no new
suppression test triggered) and no new Trigger schedule.

## Effort

**Small–medium.** One additive migration, ~one brain-grounding change (+ test), two pg-store reads, one
settings page, one help article. No humanizer, scheduler, or rank changes.

## Self-review

- **Placeholders:** none — migration number is marked approximate ("next in sequence").
- **Consistency:** account-level table matches `website_scan` precedent; RLS-in-same-migration matches
  rule 02; the whitelist mechanic is verified, not assumed.
- **Scope:** single feature, single plan — no decomposition needed.
- **Ambiguity resolved:** proof is **account-level** (not per-agent); the settings page is the primary
  surface (wizard integration is optional v1.1); proof is a **conversation** tool (first touch stays
  metric-free). These are the design's load-bearing choices — flag for owner override before build.
