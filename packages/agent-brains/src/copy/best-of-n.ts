/**
 * Best-of-N judge-ranked draft selection (enterprise-grade-brain Phase 2C, Task 3 — the
 * immediate quality lift). A PURE selector: no model calls of its own, no DB, no Trigger.dev —
 * `draftFn` and `judge` are both injected by the caller (the copy-draft pipeline wires the real
 * `draftLinkedInFn` + `judgeCopy`; tests inject mocks).
 *
 * Anti-Goodhart: this module only RANKS candidates a judge already scored — it never bypasses,
 * relaxes, or replaces the humanizer. The chosen draft still flows through the same
 * lint/fix/review gate every other draft does (see `copy-draft.ts`); the judge is advisory
 * ranking among options that already exist, not a new gate.
 */

/** Minimal judge contract this selector needs — `judgeCopy` (agent-brains) satisfies it directly. */
export type JudgeFn = (
  draft: { text: string },
  ctx: { grounding: string; cta?: string }
) => Promise<{ overall: number }>;

/**
 * Generate `n` candidates via `draftFn`, judge-rank them, and return the highest-`overall`
 * (ties resolve to the FIRST/earliest index — deterministic, never a coin flip).
 *
 * Locked rules (enforced here, not just documented — these are the review invariants):
 * - `n <= 1`: calls `draftFn` EXACTLY ONCE, the judge ZERO times. Byte-identical to today's
 *   single-draft behavior — this is how the feature stays fully OFF by default.
 * - `n > 1`: drafts `n` candidates in parallel, judges each candidate's `toText(candidate)`
 *   against `context`, and picks the argmax `overall` score.
 * - `n > 1` with no `judge` supplied: defensive fallback to the first candidate (best-of-N
 *   needs a judge to rank with — without one there's no principled way to choose, so this
 *   degrades to "draft once, ignore the rest" rather than picking arbitrarily). Zero judge calls.
 */
export async function bestOfN<T>(
  n: number,
  draftFn: () => Promise<T>,
  toText: (draft: T) => string,
  context: { grounding: string; cta?: string },
  judge?: JudgeFn
): Promise<{ chosen: T; candidates: T[]; scores: number[] }> {
  if (n <= 1) {
    const chosen = await draftFn();
    return { chosen, candidates: [chosen], scores: [] };
  }

  const candidates = await Promise.all(Array.from({ length: n }, () => draftFn()));

  if (!judge) {
    return { chosen: candidates[0]!, candidates, scores: [] };
  }

  const scores = await Promise.all(
    candidates.map((candidate) => judge({ text: toText(candidate) }, context).then((v) => v.overall))
  );

  let bestIndex = 0;
  for (let i = 1; i < scores.length; i++) {
    // Strict `>` (not `>=`) so a tie keeps the earlier index — deterministic, never a coin flip.
    if (scores[i]! > scores[bestIndex]!) bestIndex = i;
  }

  return { chosen: candidates[bestIndex]!, candidates, scores };
}
