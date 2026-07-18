import { generateObject, type LanguageModel } from "ai";
import { z } from "zod";
import { getModel, registerPrompt } from "@vantera/ai";
import type { LinkedInDraft, ConversationDraft } from "@vantera/agent-brains";
import { loadCopyLinkedinCorpus, loadCopyRespondCorpus, type CopyLinkedinCase, type CopyRespondCase } from "../corpus";
import { JUDGE_MODEL_ID } from "./judge";

/**
 * Pairwise win-rate harness (Phase 2B, Task 7): head-to-head A/B judge comparisons between a
 * CANDIDATE draft and its golden-set case's frozen baseline draft (Task 3's `frozenDraft`),
 * aggregated into a win-rate report.
 *
 * ADVISORY ONLY, same posture as `./judge` and `./kappa` (Task 6) — nothing in the drafting or
 * review pipeline gates on `runPairwise`'s `winRate`/`nonInferior` until a `runCalibration` report
 * (see `./kappa`) comes back `trusted: true` (the underlying judge's binary calls agree with a
 * real human rater at Cohen's kappa >= `KAPPA_TRUST_THRESHOLD`). Until that happens this is a
 * dashboard/monitoring number a human reads, never an automated release gate.
 *
 * POSITION BIAS: LLM pairwise judges are documented to favor whichever draft they see FIRST,
 * independent of content quality. `pairwiseCompare` defends against this by running the SAME
 * comparison TWICE with the two drafts in swapped order (A-first/B-second, then B-first/A-second)
 * and only credits a winner when both orderings agree on the same actual draft. A judge that
 * always just picks "whichever is first" will flip its raw answer on the swapped call and the two
 * orderings will disagree — `pairwiseCompare` resolves that disagreement to "tie", never to a
 * spurious winner.
 */

/** winRate = (candidateWins + 0.5*ties) / total. nonInferior = winRate >= this bar. */
export const PAIRWISE_NONINFERIORITY = 0.48;

const headToHeadSchema = z.object({
  winner: z.enum(["first", "second"]),
  rationale: z.string(),
});

// Stable system prompt, registered so every head-to-head generation is attributable to an exact
// prompt revision (same enterprise-grade-brain WS-2.1 convention as `./judge`'s JUDGE_PROMPT).
export const PAIRWISE_PROMPT = registerPrompt(
  "evals/pairwise",
  `You are an independent quality judge comparing two pieces of cold-outreach copy for a B2B LinkedIn sales platform, head-to-head. You did NOT write either draft — judge as a skeptical outside reviewer, not a collaborator trying to be generous to either side.

You will receive the citable Grounding facts both drafts were supposed to be written from, then Draft A (first) and Draft B (second).

Decide which draft is the stronger piece of outreach copy overall, weighing: specificity grounded in Grounding (a claim not supported by Grounding is a fabrication, not a strength), focus on the PROSPECT's world rather than the sender's product, posture (a peer reaching out, not a pitch), and naturalness (reads like a real person typed it, not a template). Pick the one you would send, even if the difference is small — there is no "tie" option here; genuine ties are handled by running this exact comparison twice with the two drafts swapped, not by asking you to hedge on a single call.

Respond with "winner": either "first" (Draft A) or "second" (Draft B), plus a short rationale for the choice.`
);

/** One head-to-head judge call. Returns the RAW positional answer — callers map it back to a/b. */
async function judgeHeadToHead(
  first: { text: string },
  second: { text: string },
  context: { grounding: string },
  model: LanguageModel
): Promise<"first" | "second"> {
  const { object } = await generateObject({
    model,
    schema: headToHeadSchema,
    system: PAIRWISE_PROMPT.text,
    prompt: [
      `Grounding (citable facts both drafts were supposed to be written from):\n${context.grounding}`,
      `\nDraft A (first):\n${first.text}`,
      `\nDraft B (second):\n${second.text}`,
    ].join("\n"),
  });
  return object.winner;
}

/**
 * Position-swapped A/B: judge picks the better of two drafts, run TWICE with the order flipped to
 * cancel position bias. Round 1 asks with (a=first, b=second); round 2 re-asks the SAME two
 * drafts with (b=first, a=second). Each round's raw "first"/"second" answer is mapped back onto
 * a/b accounting for that round's order — only when both rounds resolve to the SAME actual draft
 * does that draft win; disagreement (most commonly a position-biased judge picking "whichever's
 * first" both times) resolves to "tie".
 *
 * `model` defaults to `getModel(JUDGE_MODEL_ID)` — tests always inject a mock, so `getModel()`'s
 * ANTHROPIC_API_KEY requirement is never hit in the test suite.
 */
export async function pairwiseCompare(
  a: { text: string },
  b: { text: string },
  context: { grounding: string },
  model: LanguageModel = getModel(JUDGE_MODEL_ID)
): Promise<"a" | "b" | "tie"> {
  const round1 = await judgeHeadToHead(a, b, context, model);
  const round1Winner: "a" | "b" = round1 === "first" ? "a" : "b";

  const round2 = await judgeHeadToHead(b, a, context, model);
  const round2Winner: "a" | "b" = round2 === "first" ? "b" : "a";

  return round1Winner === round2Winner ? round1Winner : "tie";
}

export type PairwiseReport = {
  candidateWins: number;
  baselineWins: number;
  ties: number;
  winRate: number;
  nonInferior: boolean;
};

/** Flattens a corpus case's `frozenDraft` (whichever brain shape it is) into one comparable string. */
function frozenDraftText(foundCase: CopyLinkedinCase | CopyRespondCase): string {
  const draft = foundCase.frozenDraft;
  if (!draft) {
    throw new Error(`runPairwise: corpus case "${foundCase.id}" has no frozenDraft baseline to compare against`);
  }
  if ("message" in draft) {
    return (draft as ConversationDraft).message;
  }
  const linkedinDraft = draft as LinkedInDraft;
  return `${linkedinDraft.connectionNote}\n${linkedinDraft.followupMessage}`;
}

/**
 * Runs `pairwiseCompare` for each candidate against its case's frozen baseline draft (matched by
 * `caseId` across BOTH golden-set corpora — `./judge`'s Task 3 fixtures never collide ids across
 * `copy-linkedin`/`copy-respond`, see `corpus.test.ts`), and aggregates into a `PairwiseReport`.
 * `winRate` counts a tie as half a win (standard pairwise-eval convention) so a judge that can't
 * tell the two apart doesn't drag the candidate down as if it lost outright.
 */
export async function runPairwise(
  candidates: { caseId: string; text: string }[],
  model: LanguageModel = getModel(JUDGE_MODEL_ID)
): Promise<PairwiseReport> {
  const linkedinCases = loadCopyLinkedinCorpus();
  const respondCases = loadCopyRespondCorpus();

  let candidateWins = 0;
  let baselineWins = 0;
  let ties = 0;

  for (const candidate of candidates) {
    const foundCase: CopyLinkedinCase | CopyRespondCase | undefined =
      linkedinCases.find((c) => c.id === candidate.caseId) ?? respondCases.find((c) => c.id === candidate.caseId);
    if (!foundCase) {
      throw new Error(`runPairwise: no corpus case found for caseId "${candidate.caseId}"`);
    }

    const winner = await pairwiseCompare(
      { text: candidate.text },
      { text: frozenDraftText(foundCase) },
      { grounding: foundCase.grounding },
      model
    );
    if (winner === "a") candidateWins++;
    else if (winner === "b") baselineWins++;
    else ties++;
  }

  const total = candidates.length;
  const winRate = (candidateWins + 0.5 * ties) / total;
  return { candidateWins, baselineWins, ties, winRate, nonInferior: winRate >= PAIRWISE_NONINFERIORITY };
}
