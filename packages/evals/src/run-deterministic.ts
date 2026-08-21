import type { LanguageModel } from "ai";
import { draftLinkedIn, draftConversationMessage } from "@vantera/agent-brains";
import { getModel } from "@vantera/ai";
import { loadCopyLinkedinCorpus, loadCopyRespondCorpus, type CopyLinkedinCase, type CopyRespondCase } from "./corpus";
import { gradeLinkedinDraft, gradeRespondDraft, type GradeResult } from "./graders/deterministic";

/**
 * The deterministic quality gate's runner (Phase 2B, Task 4) — the CI entry point. Two modes over
 * the same corpus (Task 3):
 *
 * - `"frozen"`: lints each case's hand-verified `frozenDraft` — no model call, no API key needed.
 *   Every fixture's frozen draft is clean by construction (independently verified when the corpus
 *   shipped), so this mode is a pure REGRESSION GUARD on the graders themselves: if a grader
 *   change ever starts flagging a known-clean baseline, this is what catches it.
 * - `"live"`: generates a fresh draft via the real brains (`draftLinkedIn`/`draftConversationMessage`)
 *   for every case, then lints it the same way. This is the actual prompt-quality gate — it
 *   exercises the live system prompt + model, so a prompt regression that starts producing dirty
 *   copy fails here even though the frozen baselines still pass.
 *
 * The hard gate, either mode: `passRate === 1`. One dirty case anywhere in the corpus fails the
 * whole suite — there is no partial-credit threshold for copy that ships to a real prospect.
 */

function missingFrozenDraft(id: string): never {
  throw new Error(
    `runDeterministic("frozen"): case "${id}" has no frozenDraft — every corpus fixture must ship a hand-verified baseline to lint`
  );
}

async function gradeLinkedinCase(
  c: CopyLinkedinCase,
  mode: "frozen" | "live",
  model: LanguageModel | undefined
): Promise<GradeResult> {
  const draft = mode === "frozen" ? (c.frozenDraft ?? missingFrozenDraft(c.id)) : await draftLinkedIn(c.input, model);
  return gradeLinkedinDraft(draft, c, c.input.context.accountName);
}

async function gradeRespondCase(
  c: CopyRespondCase,
  mode: "frozen" | "live",
  model: LanguageModel | undefined
): Promise<GradeResult> {
  const draft =
    mode === "frozen" ? (c.frozenDraft ?? missingFrozenDraft(c.id)) : await draftConversationMessage(c.input, model);
  return gradeRespondDraft(draft, c);
}

export async function runDeterministic(
  mode: "frozen" | "live",
  model?: LanguageModel
): Promise<{ results: GradeResult[]; passRate: number }> {
  // Only resolved in "live" mode, and only when the caller didn't inject one (tests always
  // inject a mock) — "frozen" mode must stay usable with zero API-key configuration, per the
  // brief ("NO model" in frozen mode). Calling `getModel()` unconditionally as a default
  // parameter would defeat that: it throws immediately when ANTHROPIC_API_KEY is unset.
  const resolvedModel = mode === "live" ? (model ?? getModel()) : model;

  const linkedinCases = loadCopyLinkedinCorpus();
  const respondCases = loadCopyRespondCorpus();

  const results: GradeResult[] = [];
  for (const c of linkedinCases) {
    results.push(await gradeLinkedinCase(c, mode, resolvedModel));
  }
  for (const c of respondCases) {
    results.push(await gradeRespondCase(c, mode, resolvedModel));
  }

  const passRate = results.length === 0 ? 1 : results.filter((r) => r.pass).length / results.length;
  return { results, passRate };
}
