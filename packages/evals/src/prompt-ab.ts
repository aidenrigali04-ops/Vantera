import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { generateObject, type LanguageModel } from "ai";
import { z } from "zod";
import { getModel } from "@vantera/ai";
import {
  leadBlock,
  strategyDirectives,
  normalizeDashes,
  conversationReplySchema,
  type DraftInput,
  type ConversationMessageInput,
  type ConversationTurn,
} from "@vantera/agent-brains";
import { loadCopyLinkedinCorpus, loadCopyRespondCorpus, type CopyLinkedinCase, type CopyRespondCase } from "./corpus";
import { runPairwise, type PairwiseReport } from "./judge/pairwise";
import { shouldSkipLiveEvals } from "./ci";

/**
 * Prompt A/B rig (Phase 2C, Task 4): drafts every corpus case for a brain under a CANDIDATE
 * system prompt (a proposed rewrite the owner is considering, never `LINKEDIN_SYSTEM`/
 * `RESPOND_SYSTEM` themselves — this module never imports or edits either), then runs the
 * existing position-swapped pairwise harness (`./judge/pairwise.ts`, Phase 2B Task 7) with those
 * candidate drafts against each case's `frozenDraft` baseline (the accepted, lint-clean draft that
 * represents current-prompt output — the same baseline `runPairwise` already uses everywhere
 * else, so a prompt-AB run is directly comparable to the CI pairwise number in `ci.ts`).
 *
 * DRAFTING-UNDER-AN-OVERRIDDEN-SYSTEM-PROMPT APPROACH: `draftLinkedIn`/`draftConversationMessage`
 * (`@vantera/agent-brains`) each bake their OWN registered system prompt (`LINKEDIN_SYSTEM` /
 * `RESPOND_SYSTEM`) and offer no override parameter — by design, since a production brain must
 * only ever run the ONE registered, attributable prompt (see `LINKEDIN_SYSTEM`'s SendRecipe
 * comment). Monkeypatching or reaching into the brain module to swap that constant would mutate
 * shared, imported state out from under any concurrent code (and this eval rig must never edit a
 * production prompt anyway). So this module instead calls `generateObject` DIRECTLY — the same
 * single-AI-entry primitive the brains themselves use — passing `system: candidateSystem` and a
 * user prompt built from the SAME exported, pure prompt-assembly helpers the brains call
 * (`leadBlock`, `strategyDirectives`). The two small per-context blocks that aren't exported from
 * `@vantera/agent-brains` (the "avoid these recent phrasings" / "winning exemplar" blocks in
 * `copy/shared.ts`, and `reply/respond.ts`'s thread renderer) are reproduced verbatim below as
 * tiny local pure functions — eval tooling duplicating a few lines of STRING FORMATTING is a far
 * smaller risk than importing brain internals that aren't part of the package's public surface,
 * and it keeps this file's only editable-surface-adjacent dependency on production code to
 * read-only, already-exported helpers. This keeps the rig honest: every candidate draft answers
 * to the EXACT context a real drafting call would see, with only the system prompt swapped.
 *
 * Also intentionally NOT reproduced: the brains' generate -> validate -> one bounded regenerate
 * humanizer retry loop (`generateHumanized`). The rig takes the single raw draft a candidate
 * system prompt produces — retry-on-violation is a production safety net, not a prompt-quality
 * signal, and folding it in here would make a weak candidate prompt's failures partially
 * invisible (the retry might paper over exactly the failure mode a prompt rewrite is being
 * tested for).
 */

/**
 * Minimal local re-statement of `copy/linkedin.ts`'s (module-private) `linkedinDraftSchema` — not
 * exported from `@vantera/agent-brains`, so the rig defines its own copy of the same shape. Kept
 * byte-for-byte identical on purpose (`connection_note` <= 300 chars, `followup_message` <= 600).
 */
const linkedinDraftEvalSchema = z.object({
  connection_note: z.string().max(300),
  followup_message: z.string().max(600),
});

/** Mirrors `copy/shared.ts`'s (module-private) `avoidBlock` — see the module docstring above. */
function avoidBlock(avoidPhrases?: string[]): string {
  const phrases = (avoidPhrases ?? []).map((p) => p.trim()).filter(Boolean);
  if (phrases.length === 0) return "";
  return [
    `Vary your language. These phrasings were used in this account's recent messages, do NOT reuse or lightly rephrase any of them:`,
    ...phrases.map((p) => `- "${p}"`),
  ].join("\n");
}

/** Mirrors `copy/shared.ts`'s (module-private) `exemplarBlock` — see the module docstring above. */
function exemplarBlock(winningExemplars?: string[]): string {
  const exemplars = (winningExemplars ?? []).map((e) => e.trim()).filter(Boolean);
  if (exemplars.length === 0) return "";
  return [
    `These openers from this account earned interested replies from similar prospects. Use them ONLY as a guide for the angle and energy that works here. Write a fresh message for THIS prospect: do not copy or lightly rephrase any of them, and never borrow their specific numbers, names, or claims:`,
    ...exemplars.map((e) => `- "${e}"`),
  ].join("\n");
}

/** Mirrors `reply/respond.ts`'s (module-private) `renderThread` — see the module docstring above. */
function renderThread(thread: ConversationTurn[]): string {
  if (thread.length === 0) return "(no earlier messages yet)";
  return thread.map((t) => `${t.role === "agent" ? "You" : "Prospect"}: ${t.text}`).join("\n");
}

/** Same assembly as `draftLinkedIn`'s `basePrompt` (`copy/linkedin.ts`). */
function buildLinkedinPrompt(input: DraftInput): string {
  const block = leadBlock(input);
  const strat = strategyDirectives(input.context.strategy);
  const avoid = avoidBlock(input.context.avoidPhrases);
  const exemplars = exemplarBlock(input.context.winningExemplars);
  return [block, strat, avoid, exemplars].filter(Boolean).join("\n\n");
}

/** Same assembly as `draftConversationMessage`'s `prompt` (`reply/respond.ts`). */
function buildRespondPrompt(input: ConversationMessageInput): string {
  const block = leadBlock({ lead: input.lead, insights: input.insights, context: input.context });
  const strategyBlock = strategyDirectives(input.context.strategy, "conversation");
  const avoid = avoidBlock(input.context.avoidPhrases);
  const situation = input.incoming
    ? [
        `The prospect just replied (classified: ${input.classification ?? "neutral"}):`,
        input.incoming.slice(0, 2000),
        ``,
        `Write your next message answering them.`,
      ]
    : [
        `The prospect hasn't replied to your last message yet.`,
        `Write a short, natural follow-up that CONTINUES the thread above: pick up from your own last message (deepen its angle, add one concrete detail, or ask the question it implied). Assume they read it. Never a repeat, never a re-introduction, never a fresh pitch that ignores what you already said.`,
      ];
  return [
    block,
    ...(strategyBlock ? [``, strategyBlock] : []),
    ``,
    `Conversation so far:`,
    renderThread(input.thread),
    ``,
    ...situation,
    ...(avoid ? [``, avoid] : []),
  ].join("\n");
}

async function draftLinkedinCandidate(
  candidateSystem: string,
  foundCase: CopyLinkedinCase,
  model: LanguageModel
): Promise<{ caseId: string; text: string }> {
  const { object } = await generateObject({
    model,
    schema: linkedinDraftEvalSchema,
    system: candidateSystem,
    prompt: buildLinkedinPrompt(foundCase.input),
    maxOutputTokens: 600,
  });
  return {
    caseId: foundCase.id,
    text: `${normalizeDashes(object.connection_note)}\n${normalizeDashes(object.followup_message)}`,
  };
}

async function draftRespondCandidate(
  candidateSystem: string,
  foundCase: CopyRespondCase,
  model: LanguageModel
): Promise<{ caseId: string; text: string }> {
  const { object } = await generateObject({
    model,
    schema: conversationReplySchema,
    system: candidateSystem,
    prompt: buildRespondPrompt(foundCase.input),
    maxOutputTokens: 300,
  });
  return { caseId: foundCase.id, text: normalizeDashes(object.message) };
}

/**
 * Draft the corpus under a CANDIDATE system prompt, pairwise vs the current-prompt baseline
 * drafts (each case's `frozenDraft`). `model` is used for BOTH steps — drafting the candidate
 * copy AND (threaded straight into `runPairwise`) judging the head-to-head — mirroring every
 * other advisory eval entry point in this package (`./judge/pairwise.ts`, `./ci.ts`) where a
 * single injected `LanguageModel` stands in for the real model in tests. Defaults to
 * `getModel()` (the production drafting default, not the judge-specific `JUDGE_MODEL_ID`) since
 * an owner-run experiment is asking "how does MY candidate prompt draft," not "how does the judge
 * grade" — callers who want the judge on a different (stronger) model can pass one explicitly.
 *
 * ADVISORY ONLY, same posture as `runPairwise` itself: nothing here gates a release. A winning
 * `PairwiseReport` is a proposal for the owner to review, never an automatic prompt swap — see
 * `docs/prompt-experiments/2026-07-18-copy-v1.md`.
 */
export async function promptAB(
  candidateSystem: string,
  brain: "linkedin" | "respond",
  model: LanguageModel = getModel()
): Promise<PairwiseReport> {
  if (brain === "linkedin") {
    const cases = loadCopyLinkedinCorpus();
    const candidates = await Promise.all(cases.map((c) => draftLinkedinCandidate(candidateSystem, c, model)));
    return runPairwise(candidates, model);
  }
  const cases = loadCopyRespondCorpus();
  const candidates = await Promise.all(cases.map((c) => draftRespondCandidate(candidateSystem, c, model)));
  return runPairwise(candidates, model);
}

/**
 * The `evals:prompt-ab` CLI entry point — an owner-run convenience wrapper, not a CI step (this
 * package's `test`/`type-check` scripts never execute it; see `prompt-ab.test.ts` for the
 * mock-model coverage). Reads a candidate system prompt from a FILE (candidate prompts run to
 * many paragraphs — a shell argument is the wrong shape for that) and runs `promptAB` against it.
 *
 * Usage: `pnpm --filter @vantera/evals evals:prompt-ab <linkedin|respond> <path-to-candidate-prompt.txt>`
 *
 * Same API-key-gated loud-skip contract as every other live-model entry point in this package
 * (`evals:ci`, `evals:calibration-prep`) — reuses `shouldSkipLiveEvals` rather than duplicating
 * the check.
 */
export async function main(argv: string[]): Promise<number> {
  if (shouldSkipLiveEvals(process.env)) {
    console.log("::warning::ANTHROPIC_API_KEY not set — evals:prompt-ab SKIPPED. Add the secret to run a live prompt A/B pass.");
    return 0;
  }

  const brain = argv[2];
  const promptPath = argv[3];
  if (brain !== "linkedin" && brain !== "respond") {
    console.log(
      "::error::evals:prompt-ab requires a brain argument, e.g. `pnpm --filter @vantera/evals evals:prompt-ab linkedin path/to/candidate.txt`"
    );
    return 1;
  }
  if (!promptPath) {
    console.log("::error::evals:prompt-ab requires a path to a candidate system-prompt text file as the second argument.");
    return 1;
  }

  try {
    const candidateSystem = readFileSync(promptPath, "utf8");
    const report = await promptAB(candidateSystem, brain);
    console.log(
      `promptAB(${brain}, ${promptPath}): candidateWins=${report.candidateWins} baselineWins=${report.baselineWins} ties=${report.ties} winRate=${report.winRate.toFixed(3)} nonInferior=${report.nonInferior}`
    );
    console.log(
      "ADVISORY ONLY — a winning report is a PROPOSAL for owner review, never an automatic prompt swap. See docs/prompt-experiments/2026-07-18-copy-v1.md."
    );
    return 0;
  } catch (err) {
    console.log(`::error::evals:prompt-ab failed: ${err instanceof Error ? err.message : String(err)}`);
    return 1;
  }
}

// Run only when executed directly (`tsx src/prompt-ab.ts`) — importing this module (as
// `prompt-ab.test.ts` does, for `promptAB`) must never trigger a live run.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv).then((code) => process.exit(code));
}
