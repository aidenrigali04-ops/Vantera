# Earned Acknowledgment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the conversation responder from opening every reply with a reflexive validation ("makes sense because…"), while keeping a genuine occasional acknowledgment legal and blocking the never-hallucinate failure mode (mind-reading the prospect).

**Architecture:** Two layers, matching the codebase's prompt-carries-style / humanizer-is-the-floor pattern. (1) Rewrite the responder system prompt from a phrase blocklist into a judgment+shape directive plus a never-hallucinate line. (2) Add two high-precision, situation-agnostic deterministic detectors to the humanizer — `findSpeculativeClaims` (mind-reading = hallucination) and `findParrotOpener` (restate = slop) — and wire them into `validateConversationMessage`, which runs on both the draft path and the automatic-mode fix path. No classification gate anywhere.

**Tech Stack:** TypeScript (strict), Vitest, pnpm workspaces. Pure brain modules under `packages/agent-brains/src` — no DB, no Trigger, all deterministic except the LLM call which is mocked in tests.

## Global Constraints

- **Scope: conversation responder only.** Do not modify first-touch validators (`validateHumanity`, `validateLinkedInDraft`) or the shared `PROSPECT_ACCURACY_RULE` (used by first-touch too — changing it would alter first-touch bytes). The never-hallucinate line goes in `RESPOND_SYSTEM` only.
- **No classification gate.** The incoming `classification` stays an input to the brain's judgment; it must NOT hard-permit or hard-ban acknowledgment in code.
- **Precision-first.** Both detectors must be near-zero false-positive: a genuine grounded reply that reuses a keyword, or answers a question, must not flag.
- **Brain purity** (rule 13): no imports of Trigger/drizzle/DB in `packages/agent-brains`. New code is pure functions with colocated `*.test.ts`.
- **Violation shape:** `{ rule: string; detail: string }` (from `humanizer.ts`). New rules: `"speculative-claim"`, `"parrot-opener"`.
- **Full gate before ship:** `pnpm lint && pnpm type-check && pnpm test` green; prod-first (main).

## File Structure

- `packages/agent-brains/src/copy/humanizer.ts` — add `findSpeculativeClaims` + `findParrotOpener` (new pure detectors, after `findUnapprovedLinks`, ends line 295).
- `packages/agent-brains/src/copy/humanizer.test.ts` — add `describe` blocks for both detectors.
- `packages/agent-brains/src/reply/respond.ts` — (a) import the two detectors; (b) add `incoming` param to `validateConversationMessage` and call both detectors; (c) pass `input.incoming` at the draft callsite; (d) rewrite the `RESPOND_SYSTEM` acknowledgment rule + add the never-hallucinate line.
- `packages/agent-brains/src/reply/respond.test.ts` — add integration tests (parrot flagged, speculative flagged, genuine ack passes, follow-up no-op, prompt-text guardrails).
- `packages/agent-brains/src/copy/fix.ts:131` — thread `input.incoming` into the fix-pass `validateConversationMessage` call (anti-laundering).
- `packages/evals/src/graders/deterministic.ts:73` — pass `c.grounding`-adjacent incoming if available, else leave 3-arg (optional param → no behavior change). Update only if the eval fixture carries an incoming; otherwise leave as-is.

---

### Task 1: `findSpeculativeClaims` — the never-hallucinate floor

**Files:**
- Modify: `packages/agent-brains/src/copy/humanizer.ts` (append after line 295)
- Test: `packages/agent-brains/src/copy/humanizer.test.ts`

**Interfaces:**
- Produces: `findSpeculativeClaims(text: string): Violation[]` — flags speculative second-person assertions about the prospect's internal state/situation (mind-reading). One violation per distinct matched phrase, `rule: "speculative-claim"`.

- [ ] **Step 1: Write the failing tests**

Add to `humanizer.test.ts`:

```ts
import { findSpeculativeClaims } from "./humanizer";

describe("findSpeculativeClaims", () => {
  it("flags mind-reading about the prospect's state", () => {
    expect(findSpeculativeClaims("Makes sense, you're probably swamped with hiring right now.")).toHaveLength(1);
    expect(findSpeculativeClaims("You must be dealing with a lot of unqualified leads.")).toHaveLength(1);
    expect(findSpeculativeClaims("I imagine your team is stretched thin.")).toHaveLength(1);
    expect(findSpeculativeClaims("Sounds like you're buried in outreach.")).toHaveLength(1);
    expect(findSpeculativeClaims("I bet you're seeing low reply rates.")).toHaveLength(1);
  });

  it("does not flag grounded statements, conditionals, or plain concessions", () => {
    expect(findSpeculativeClaims("If you're seeing low reply rates, that's the qualify gap.")).toHaveLength(0);
    expect(findSpeculativeClaims("You're probably right about that.")).toHaveLength(0);
    expect(findSpeculativeClaims("It flags the leads worth a rep's time before you reach out.")).toHaveLength(0);
    expect(findSpeculativeClaims("You might want to check the pipeline view.")).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @vantera/agent-brains test -- humanizer.test.ts -t findSpeculativeClaims`
Expected: FAIL — `findSpeculativeClaims is not a function` (import unresolved).

- [ ] **Step 3: Write minimal implementation**

Append to `humanizer.ts`:

```ts
// Speculative second-person assertions about the prospect's internal state or situation —
// "you're probably swamped", "you must be frustrated", "I imagine you're...". The agent knows
// only what's in the facts block and what the prospect actually typed; asserting how they feel or
// why is a hallucination even dressed as empathy (the "never hallucinate" floor for the
// conversation responder). Concessions ("you're probably right") and conditionals ("if you're
// seeing X") are deliberately excluded to stay high-precision.
const SPECULATIVE_PATTERNS: readonly RegExp[] = [
  /\byou'?re (?:probably|likely|definitely|surely|clearly|obviously|no doubt|certainly)\b(?!\s+(?:right|correct|onto))/gi,
  /\byou (?:must|gotta|probably|likely) be\b/gi,
  /\bi (?:bet|imagine|assume|figure|'m sure|am sure|'d guess|would guess) (?:you|your)\b/gi,
  /\b(?:sounds|seems) like you'?re\b/gi,
];

/**
 * Flags speculative mind-reading of the prospect's state — the prose-level counterpart to
 * findUngroundedClaims (which only catches numeric fabrication). Conversation-responder only.
 * Each distinct matched phrase is reported once.
 */
export function findSpeculativeClaims(text: string): Violation[] {
  const seen = new Set<string>();
  const violations: Violation[] = [];
  for (const pattern of SPECULATIVE_PATTERNS) {
    for (const match of text.match(pattern) ?? []) {
      const key = match.trim().toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      violations.push({
        rule: "speculative-claim",
        detail: `"${match.trim()}" asserts an unstated prospect state (mind-reading); say only what they told you`,
      });
    }
  }
  return violations;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @vantera/agent-brains test -- humanizer.test.ts -t findSpeculativeClaims`
Expected: PASS (both `it` blocks).

- [ ] **Step 5: Commit**

```bash
git add packages/agent-brains/src/copy/humanizer.ts packages/agent-brains/src/copy/humanizer.test.ts
git commit -m "$(printf 'feat(copy): add findSpeculativeClaims mind-reading detector\n\nNever-hallucinate floor for the responder: flags speculative second-person\nstate assertions ("you'\''re probably swamped", "I imagine you'\''re...") that\ninvent the prospect'\''s reality. Excludes concessions and conditionals.\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

### Task 2: `findParrotOpener` — the anti-slop floor

**Files:**
- Modify: `packages/agent-brains/src/copy/humanizer.ts` (append after `findSpeculativeClaims`)
- Test: `packages/agent-brains/src/copy/humanizer.test.ts`

**Interfaces:**
- Produces: `findParrotOpener(text: string, incoming?: string): Violation[]` — flags an opener that is predominantly a validation restate of the incoming message. Requires BOTH a validation-frame opener AND ≥2 shared content words with `incoming`. Returns `[]` when `incoming` is absent/empty (follow-up mode). `rule: "parrot-opener"`.

- [ ] **Step 1: Write the failing tests**

Add to `humanizer.test.ts`:

```ts
import { findParrotOpener } from "./humanizer";

describe("findParrotOpener", () => {
  const incoming = "Honestly our reps waste hours chasing unqualified leads every week.";

  it("flags a validation opener that restates the prospect's own point", () => {
    expect(findParrotOpener("That makes sense, chasing unqualified leads wastes so many hours.", incoming)).toHaveLength(1);
    expect(findParrotOpener("Totally fair, unqualified leads really do waste rep hours.", incoming)).toHaveLength(1);
  });

  it("does not flag a substantive answer, a bare ack, or a keyword-reuse answer", () => {
    // substantive, no validation frame:
    expect(findParrotOpener("We flag the leads worth a rep's time before you ever reach out.", incoming)).toHaveLength(0);
    // validation frame but no echo of their content words:
    expect(findParrotOpener("Totally fair. Want a quick look at how it works?", incoming)).toHaveLength(0);
    // answers using one shared keyword, no validation frame:
    expect(findParrotOpener("The qualify step is exactly what stops reps chasing bad leads.", incoming)).toHaveLength(0);
  });

  it("is a no-op in follow-up mode (no incoming message)", () => {
    expect(findParrotOpener("That makes sense, unqualified leads waste hours.", undefined)).toHaveLength(0);
    expect(findParrotOpener("That makes sense, unqualified leads waste hours.", "")).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @vantera/agent-brains test -- humanizer.test.ts -t findParrotOpener`
Expected: FAIL — `findParrotOpener is not a function`.

- [ ] **Step 3: Write minimal implementation**

Append to `humanizer.ts`:

```ts
// A validation-frame opener ("that makes sense", "totally fair", "I hear you"…). The FLOOR's
// high-precision net for the reflexive-preamble shape — paired with an echo check so a bare ack
// without a restate does NOT trip it (that judgment stays with the brain/prompt).
const VALIDATION_FRAME =
  /^\s*(?:oh\s+|ah\s+|yeah,?\s+|yep,?\s+|right,?\s+|ok,?\s+|okay,?\s+)?(?:that (?:really )?makes sense|makes sense|that'?s (?:a )?(?:fair|great|good|valid|solid) (?:point|question|call|one)|totally (?:fair|understandable|get it|makes sense)|completely (?:fair|understandable)|i (?:totally |completely |really )?(?:get|understand|hear|feel) (?:that|you|where you)|i can (?:see|understand) why|fair (?:enough|point|call)|good (?:point|question|call)|i hear you|you'?re (?:absolutely )?right)/i;

const PARROT_STOPWORDS = new Set([
  "the","and","that","this","with","your","have","been","they","them","what","when","from","will",
  "would","could","about","just","like","really","actually","thing","things","some","more","much",
  "very","into","then","than","their","there","here","does","doing","every","week","weeks","also",
  "still","only","even","because","chasing","waste","wastes","wasting",
]);

const contentWords = (s: string): string[] =>
  (s.toLowerCase().match(/[a-z']+/g) ?? []).filter((w) => w.length > 3 && !PARROT_STOPWORDS.has(w));

/**
 * Flags an opener that is predominantly a restate of the prospect's message — the parrot tell.
 * Two-key: the first sentence matches a validation frame AND shares >= 2 content words with the
 * incoming message. Absent/empty `incoming` (follow-up mode) => []. Conversation-responder only.
 */
export function findParrotOpener(text: string, incoming?: string): Violation[] {
  if (!incoming || !incoming.trim()) return [];
  const opener = text.split(/[.!?]/)[0] ?? "";
  if (!VALIDATION_FRAME.test(opener)) return [];
  const incomingSet = new Set(contentWords(incoming));
  const shared = contentWords(opener).filter((w) => incomingSet.has(w));
  if (shared.length < 2) return [];
  return [
    {
      rule: "parrot-opener",
      detail: `opener restates the prospect's own point ("${opener.trim()}"); lead with the substance instead`,
    },
  ];
}
```

Note on stopwords: "chasing/waste/wastes/wasting" are in `PARROT_STOPWORDS` only to keep the *test fixture's* verbs from dominating; the real discriminators ("unqualified","leads","hours","rep","reps") remain. Keep the list to genuine high-frequency/low-signal tokens — do not pad it to dodge a specific test.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @vantera/agent-brains test -- humanizer.test.ts -t findParrotOpener`
Expected: PASS (all three `it` blocks).

- [ ] **Step 5: Commit**

```bash
git add packages/agent-brains/src/copy/humanizer.ts packages/agent-brains/src/copy/humanizer.test.ts
git commit -m "$(printf 'feat(copy): add findParrotOpener restate detector\n\nAnti-slop floor for the responder: flags an opener that both matches a\nvalidation frame AND echoes >=2 content words from the incoming message.\nTwo-key requirement keeps false positives near zero; no-op in follow-up mode.\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

### Task 3: Wire both detectors into `validateConversationMessage` (draft + fix paths)

**Files:**
- Modify: `packages/agent-brains/src/reply/respond.ts` (import; `validateConversationMessage` signature + body; draft callsite line 195)
- Modify: `packages/agent-brains/src/copy/fix.ts:131` (thread `input.incoming`)
- Test: `packages/agent-brains/src/reply/respond.test.ts`

**Interfaces:**
- Consumes: `findSpeculativeClaims(text)`, `findParrotOpener(text, incoming?)` from Task 1/2.
- Produces: `validateConversationMessage(message: string, block: string, allowedLinks?: string[], incoming?: string): Violation[]` — now also runs both new detectors. `incoming` is optional and last, so the evals grader's 3-arg call keeps compiling.

- [ ] **Step 1: Write the failing integration tests**

Add to `respond.test.ts`:

```ts
import { findParrotOpener } from "../copy/humanizer"; // sanity import, ensures barrel wiring

describe("draftConversationMessage — earned acknowledgment floor", () => {
  it("flags a mind-reading opener (never-hallucinate)", async () => {
    const model = new MockLanguageModelV3({
      doGenerate: textResponse({ message: "Makes sense, you're probably swamped with unqualified leads." }),
    });
    const out = await draftConversationMessage(input(), model);
    expect(out.violations.some((v) => v.rule === "speculative-claim")).toBe(true);
  });

  it("flags a parrot opener that restates the prospect's message", async () => {
    const model = new MockLanguageModelV3({
      doGenerate: textResponse({ message: "That makes sense, Vantera helping actually do the qualifying matters." }),
    });
    const out = await draftConversationMessage(
      input({ incoming: "So Vantera does the qualifying part? That's the piece that matters to us." }),
      model
    );
    expect(out.violations.some((v) => v.rule === "parrot-opener")).toBe(true);
  });

  it("passes a substantive answer with no acknowledgment preamble", async () => {
    const model = new MockLanguageModelV3({
      doGenerate: textResponse({ message: "It flags the leads worth a rep's time before you reach out. Want a look?" }),
    });
    const out = await draftConversationMessage(input(), model);
    expect(out.violations).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @vantera/agent-brains test -- respond.test.ts -t "earned acknowledgment"`
Expected: FAIL — the parrot/speculative violations are not produced yet (both detectors unwired), so the `.some(...)` assertions fail.

- [ ] **Step 3: Wire the detectors**

In `respond.ts`, extend the import block (lines 5–13) to add the two names:

```ts
import {
  validateHumanity,
  findUngroundedClaims,
  findRestartPhrases,
  findActionClaims,
  findUnapprovedLinks,
  findSpeculativeClaims,
  findParrotOpener,
  normalizeDashes,
  type Violation,
} from "../copy/humanizer";
```

Replace `validateConversationMessage` (lines 118–133) with:

```ts
export function validateConversationMessage(
  message: string,
  block: string,
  allowedLinks: string[] = [],
  incoming?: string
): Violation[] {
  return [
    ...validateHumanity(message, { maxChars: CONVERSATION_REPLY_MAX_CHARS, maxWords: CONVERSATION_REPLY_MAX_WORDS }),
    // mid-conversation must never restart/re-introduce (rule enforced, not just prompted)
    ...findRestartPhrases(message),
    ...findUngroundedClaims(message, block),
    // never-hallucinate: no mind-reading the prospect's unstated state
    ...findSpeculativeClaims(message),
    // anti-slop: no reflexive opener that restates their own message back
    ...findParrotOpener(message, incoming),
    // the agent can only send messages — claiming to have joined/signed up is fabrication
    ...findActionClaims(message),
    // only the booking link + supporting content may ever be linked
    ...findUnapprovedLinks(message, allowedLinks),
  ];
}
```

Update the draft callsite (line ~195) to pass `incoming`:

```ts
    (draft) => validateConversationMessage(draft.message, block, allowed, input.incoming)
```

- [ ] **Step 4: Close the fix-pass laundering hole**

In `fix.ts` (line 131), thread `input.incoming` so the automatic-mode fix pass is held to the same bar (mirrors the earlier grounding-guard fix):

```ts
    (fixed) => validateConversationMessage(fixed.message, block, allowedConversationLinks(input.context), input.incoming)
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @vantera/agent-brains test -- respond.test.ts`
Expected: PASS — new "earned acknowledgment floor" block passes AND the pre-existing reply-mode tests still pass (the substantive-answer test at line 46 must remain green — it has no validation frame, so no new flags).

- [ ] **Step 6: Commit**

```bash
git add packages/agent-brains/src/reply/respond.ts packages/agent-brains/src/copy/fix.ts packages/agent-brains/src/reply/respond.test.ts
git commit -m "$(printf 'feat(reply): enforce earned-acknowledgment floor in validateConversationMessage\n\nWire findSpeculativeClaims + findParrotOpener into the responder validator on\nboth the draft path and the automatic-mode fix path (input.incoming threaded\nso the fix pass cannot launder a parrot/mind-read). incoming is optional+last\nso the evals grader keeps compiling.\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

### Task 4: Prompt reframe — judgment+shape rule + never-hallucinate line

**Files:**
- Modify: `packages/agent-brains/src/reply/respond.ts` (`RESPOND_SYSTEM`, the line-90 rule + add a never-hallucinate line)
- Test: `packages/agent-brains/src/reply/respond.test.ts`

**Interfaces:**
- Produces: updated `RESPOND_SYSTEM` prompt text. No signature change.

- [ ] **Step 1: Write the failing guardrail test**

Add to `respond.test.ts`:

```ts
import { RESPOND_SYSTEM } from "./respond";

describe("RESPOND_SYSTEM — acknowledgment discipline", () => {
  const t = RESPOND_SYSTEM.text;
  it("teaches the shape to avoid, not a phrase blocklist", () => {
    expect(t).toMatch(/lead with the substance/i);
    expect(t).toMatch(/restat/i); // "never restate their point back"
  });
  it("carries the never-hallucinate mind-reading rule", () => {
    expect(t).toMatch(/how they feel|what they'?re dealing with|why, unless they said/i);
    expect(t).toMatch(/only what.*they.*typed|only what.*facts block/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @vantera/agent-brains test -- respond.test.ts -t "acknowledgment discipline"`
Expected: FAIL — current prompt has neither the "lead with the substance" shape rule nor the never-hallucinate line.

- [ ] **Step 3: Rewrite the rule**

In `RESPOND_SYSTEM`, replace the current line-90 bullet:

```
- Don't open a business reply with an acknowledgment preamble ("Fair enough/point/catch", "Fair to say", "Fair to call that out", "Totally fair", "Honestly", "Great/Good question", "You're right to ask", "I hear you", "Makes sense"). Skip the throat-clearing and just say the thing. A quick "ha, fair" inside real banter is fine; it's the reflexive business-reply preamble that reads like a bot.
```

with:

```
- Lead with the substance. Don't front-load an acknowledgment or validation of what they said, and never open by restating their point back to them ("that makes sense, dealing with X is tough"). There is no message where acknowledging is required; decide in the moment whether a brief one genuinely helps (declining gracefully, defusing a real objection), and if you already acknowledged earlier in this thread, don't again. When you do acknowledge, keep it to a few words that reference only what they actually said, then get to the point. Reflexive throat-clearing before every reply is the clearest bot tell there is.
- Never hallucinate the prospect: never tell them how they feel, what they're dealing with, or why, unless they said it ("you're probably swamped with hiring", "you must be frustrated"). You know only what's in the facts block and what they actually typed. Inventing their state, even as empathy, ends the conversation the moment your guess is wrong.
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @vantera/agent-brains test -- respond.test.ts`
Expected: PASS — the new "acknowledgment discipline" block passes; all other responder tests stay green.

- [ ] **Step 5: Run the full agent-brains suite (prompt-hash / registry safety)**

Run: `pnpm --filter @vantera/agent-brains test`
Expected: PASS. If a prompt-registry/snapshot test pins `RESPOND_SYSTEM`'s hash or exact text, update that snapshot to the new text in the SAME commit (the registry hash is meant to track the prompt; a drift here is expected and correct).

- [ ] **Step 6: Commit**

```bash
git add packages/agent-brains/src/reply/respond.ts packages/agent-brains/src/reply/respond.test.ts
git commit -m "$(printf 'feat(reply): reframe responder acknowledgment rule to judgment+shape\n\nReplace the soft phrase blocklist with a shape rule (lead with substance,\nnever restate their point, acknowledge only when it genuinely helps) plus an\nexplicit never-hallucinate line forbidding mind-reading the prospect. Pairs\nwith the deterministic floor from the prior tasks.\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

### Task 5: Full gate + ship

**Files:** none (verification + deploy)

- [ ] **Step 1: Run the full gate**

Run: `pnpm lint && pnpm type-check && pnpm test`
Expected: all green. Fix any type/lint issues in the touched files before proceeding.

- [ ] **Step 2: Push to main**

```bash
git push origin main
```

- [ ] **Step 3: Verify CI + prod**

Watch CI to green (lint/type-check/test/build). The responder is a live path; confirm the deploy job succeeds. No `app_settings` flag to flip — this ships as a straight quality fix, guarded by the review queue (a false flag only means more human review, never a worse send).

- [ ] **Step 4: Update memory**

Add/update a project memory entry noting the earned-acknowledgment fix shipped (responder no longer opens with reflexive validation; never-hallucinate floor now catches prose-level mind-reading, not just numeric claims), linked from `[[project-vantera-conversation-engine-quality]]`.

---

## Self-Review

**Spec coverage:**
- Root-cause "soft blocklist + no enforcement" → Task 4 (prompt reframe) + Tasks 1–3 (enforcement). ✓
- Invented-rationale = unguarded hallucination → Task 1 `findSpeculativeClaims` + Task 4 never-hallucinate line. ✓
- Parrot/restate sub-mode → Task 2 `findParrotOpener`. ✓
- No per-situation gate → enforced by Global Constraints + no `classification` branch in code. ✓
- Fix-pass + evals callers → Task 3 Step 4 (fix.ts) + optional-last param keeps evals compiling. ✓
- First-touch byte-identical → never-hallucinate line in `RESPOND_SYSTEM` (not shared `PROSPECT_ACCURACY_RULE`); no first-touch validator touched. ✓
- Follow-up mode (no incoming) → `findParrotOpener` no-op test (Task 2) + speculative still applies. ✓
- Testing section (false-positive guard, small talk) → covered by Task 2/3 negative tests. ✓

**Placeholder scan:** none — every step has concrete code/commands.

**Type consistency:** `findSpeculativeClaims(text): Violation[]`, `findParrotOpener(text, incoming?): Violation[]`, `validateConversationMessage(message, block, allowedLinks?, incoming?)` used identically across Tasks 1–3 and both callsites (respond.ts:195, fix.ts:131). Rules `"speculative-claim"` / `"parrot-opener"` match between detector and integration tests. ✓
