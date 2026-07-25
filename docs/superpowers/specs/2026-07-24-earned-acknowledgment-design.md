# Earned Acknowledgment — killing the reflexive validation opener in the conversation responder

- **Date:** 2026-07-24
- **Status:** Design (awaiting owner review)
- **Scope:** `packages/agent-brains/src/reply/respond.ts` + `copy/humanizer.ts` + `copy/shared.ts` rule text. **Conversation responder only.**
- **Owner directive (2026-07-24):** Do not hard-gate acknowledgment per situation. A smart brain should decide, in the moment, whether an acknowledgment is a good choice. Where it is not smart enough, program it in — anchored to the rule **"never hallucinate."**

## Problem

Every responder reply currently opens with a reflexive validation of the lead's last message — *"oh that makes sense because of …"*. It reads as obviously-AI, drops trust, and interrupts the flow of a real back-and-forth. It should not be part of every message. It does not need to be fully removed: a genuine, occasional acknowledgment is human. The reflexive, every-turn version is the bot tell.

## Root cause (grounded in code)

1. **The existing guard is a soft, prompt-only blocklist.** [`respond.ts:90`](../../../packages/agent-brains/src/reply/respond.ts#L90) tells the model not to open with an acknowledgment preamble and lists ~9 exact phrases ("Fair enough", "Totally fair", "Makes sense", "Great question", "You're right to ask", "I hear you" …). Blocklists lose to paraphrase — the model routes around the list ("that tracks", "right, given you're dealing with X", "totally get that") and the instruction reads as satisfied while the behavior is identical.
2. **Nothing enforces it.** The deterministic humanizer ([`validateHumanity`](../../../packages/agent-brains/src/copy/humanizer.ts#L111)) is the real floor for banned phrases, dashes, length, etc., but it has **no** acknowledgment-preamble check, and `"makes sense"` is not in `BANNED_PHRASES`. So the rule is soft-only, fighting the single most deeply-trained LLM instinct: acknowledge-and-restate before answering. Soft rule vs. deep instinct → the instinct wins on every message.
3. **The invented-rationale variant is an unguarded hallucination.** [`findUngroundedClaims`](../../../packages/agent-brains/src/copy/humanizer.ts#L233) only catches **metric** claims (`%`, `$`, `Nx`). An opener like *"makes sense, you're probably swamped with Q4 hiring"* asserts a reason/feeling/pressure the prospect never stated — a fabricated claim about the prospect — and **no deterministic guard catches it**. [`PROSPECT_ACCURACY_RULE`](../../../packages/agent-brains/src/copy/shared.ts#L211) covers *misdescribing* their business but is prompt-only and does not cover *inventing their state of mind*.

## Design principle (owner directive)

No per-situation permission table (e.g. "allow acknowledgment only when the message is classified `objection`"). The brain judges the moment. It already sees the full thread and the incoming classification; trust that judgment as the primary mechanism. The deterministic layer exists only as the floor for when the brain is *not* smart enough — and that floor is anchored to **never hallucinate**, because the true damage of the validation opener is that it invents the prospect's reality.

Two failure sub-modes, separated because they need different enforcement:

- **Parrot / restate** — echoes the lead's own words back ("that makes sense, high volume is tough"). A style tell that adds zero information. *Anti-slop* problem.
- **Invented-rationale / mind-reading** — asserts a reason, feeling, or pressure the prospect never stated ("you're probably swamped…", "you must be frustrated…", "I imagine you're…"). This is a **prospect hallucination** and the real trust-killer: if the guess is wrong, the lead instantly knows they're talking to a pattern-matcher. This is the sub-mode the "never hallucinate" rule governs.

## Solution

Two layers, mirroring the codebase's existing **prompt-carries-style / humanizer-is-the-floor** architecture. The prompt makes the brain smart about the choice; the floor guarantees the two pathologies can't ship.

### Layer 1 — Prompt (respond.ts): trust the brain, teach the shape

Replace the line-90 phrase blocklist with a *judgment + shape* directive (words paraphrased in the plan):

- **Default: lead with the substance.** Don't front-load acknowledgment. There is no message where acknowledging is mandatory.
- **The brain decides** whether a brief acknowledgment genuinely serves this moment (declining gracefully, defusing a real objection). It can see the whole thread and how the message was classified — use that judgment.
- **Never open by restating their point back to them.**
- **Never assert a reason, feeling, or pressure they didn't state** ("you're probably…", "you must be…", "I imagine you're…"). You only know what they typed. Inventing how they feel or why — even dressed as empathy — is a hallucination.
- **If you do acknowledge, reference only what they actually said,** in a few words, then get to the point.
- **Thread-awareness (light cue, not a hard mechanism):** the brain already sees the full thread; if it acknowledged recently, don't again. This is what naturally makes acknowledgment *occasional* without a counter.

**Never-hallucinate anchor.** Extend the shared truth contract with a responder-facing line (in `PROSPECT_ACCURACY_RULE` or a responder-specific rule): *"Never tell the prospect how they feel, what they're dealing with, or why, unless they said it. You know only what's in the facts block and what they actually typed."* This is the prompt half of the never-hallucinate guarantee.

### Layer 2 — Deterministic floor (humanizer): two high-precision detectors, situation-agnostic

Precision-first. The owner wants the brain free, so the floor catches only the egregious, unambiguous pathologies — tuned for near-zero false positives. Both wire into `validateConversationMessage` and feed the existing **generate → validate → one bounded regenerate → else review** path.

1. **`findSpeculativeClaims` — the never-hallucinate enforcement.** Flags speculative second-person mind-reading about the prospect's *state*: "you're probably/likely …", "you must be …", "I bet you're …", "I imagine you're …", "I'm sure you're …", "you've gotta be …", "sounds like you're [state]". These assert an unstated prospect reality = a hallucination. High-signal and regex-able. Scoped to second-person **state assertions**, not conditionals ("if you're seeing X …" is legal).
2. **`findParrotOpener` — the anti-slop enforcement.** Flags an opener that is *predominantly a restate*. Requires **BOTH**: (a) the first clause matches a validation frame, AND (b) high content-word overlap with the incoming message. The two-key requirement keeps false positives near zero — a legitimate reply that reuses one keyword while advancing new information does not trip it.

A genuine, earned, grounded, non-parroting acknowledgment ("yeah, fair —" then the real answer) passes both detectors. This is explicitly **not** a classification gate; classification stays an input to the brain's judgment, never a hard permit/ban.

## Scope

- **Conversation responder only** ([`respond.ts`](../../../packages/agent-brains/src/reply/respond.ts)): both reply mode and proactive follow-up mode.
- **First touch is unaffected** — it has no incoming message to validate, so the validation-opener problem doesn't exist there; `validateHumanity` / `validateLinkedInDraft` are untouched and stay byte-identical.
- **Follow-up mode** (no incoming): `findParrotOpener` no-ops (nothing to echo); `findSpeculativeClaims` + the never-hallucinate rule still apply (don't invent *why* they went quiet).

## Testing (TDD, rule 12)

- Invented-rationale opener ("makes sense, you're probably slammed with hiring") → flagged `speculative-claim`.
- Pure parrot opener ("that makes sense, high volume is tough") over an incoming about high volume → flagged `parrot-opener`.
- Genuine earned ack referencing only their stated words, no mind-reading → **passes**.
- Substance-first reply with no acknowledgment (the common case) → **passes**.
- Small-talk / rapport reply → **passes**.
- **False-positive guard:** a batch of clean substantive replies that legitimately reuse a keyword or directly answer a question → **not** flagged (echo-detector precision).
- Follow-up mode: speculative rule applies; parrot detector no-ops.
- Off-path: first-touch validators produce byte-identical output.

## Rollout / safety

- Live-path change to the shipped responder (`c095dfe`). This is a straight quality fix, not a gated feature — no `app_settings` flag. The review-queue backstop (rule 06/11) means the worst case of a false flag is *more human review*, never a worse send.
- Full gate green (`pnpm lint && type-check && test`) before ship. Prod-first per owner.

## Risks & mitigations

- **Echo false-positives** → two-key requirement (frame + overlap) + a sim batch of clean replies as a regression guard, the same way the char/word caps were calibrated.
- **Over-suppression reading cold/abrupt** → earned acknowledgment stays legal (not a hard ban); tune on the sim harness.
- **Speculative regex catching a legit hypothetical** → scope to second-person state assertions, exclude conditionals; covered by test.

## Out of scope

- best_of_n judge-rubric penalty for reflexive validation (HELD until best-of-N is calibrated/on — add there as a complement, not a fix now).
- First-touch copy.
- Any classification-gated permission logic (explicitly rejected by the owner directive above).
