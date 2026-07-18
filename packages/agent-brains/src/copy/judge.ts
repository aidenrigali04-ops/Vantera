import { generateObject, type LanguageModel } from "ai";
import { z } from "zod";
import { getModel, registerPrompt } from "@vantera/ai";

/**
 * LLM judge for cold-outreach copy quality — a first-class agent-brains brain (promoted from
 * eval-only `packages/evals/src/judge/judge.ts` in enterprise-grade-brain Phase 2C, Task 2) so
 * BOTH the evals harness (`@vantera/evals`'s `judge/judge.ts` re-exports this module unchanged,
 * zero behavior change) and the production `packages/jobs` copy pipeline (best-of-N draft
 * selection, Task 3) consume ONE judge implementation.
 *
 * ADVISORY ONLY in both homes — nothing gates on this judge until `runCalibration` (see
 * `@vantera/evals`'s `judge/kappa.ts`) reports `trusted: true`, i.e. the judge's binary good/bad
 * calls agree with a real human rater at Cohen's kappa >= 0.7 on a hand-labeled sample
 * (`fixtures/judge-calibration/human-labels.json`, shipped empty — the owner fills ~100 during
 * calibration). Until that report comes back trusted, `judgeCopy`/`JudgeVerdict` are informational
 * only: no call site (evals OR the best-of-N pipeline) may fail a draft, block a send, or feed
 * this score into another gate.
 *
 * Deliberately a STRONGER, DIFFERENT model family (`claude-opus-4-8`) than the Sonnet-4.6 drafting
 * model `@vantera/ai`'s default resolves to — a judge from the same family as the draft model
 * tends toward self-preference bias (rating its own family's output more favorably than an
 * independent rater would).
 */
export const JUDGE_MODEL_ID = "claude-opus-4-8";

/** The 1-5 dims plus an overall 1-5 score and a plain-English rationale. */
export type JudgeVerdict = {
  specificity: number;
  themFocus: number;
  posture: number;
  naturalness: number;
  overall: number;
  rationale: string;
};

const judgeVerdictSchema = z.object({
  specificity: z.number().int().min(1).max(5),
  themFocus: z.number().int().min(1).max(5),
  posture: z.number().int().min(1).max(5),
  naturalness: z.number().int().min(1).max(5),
  overall: z.number().int().min(1).max(5),
  rationale: z.string(),
});

// Stable system prompt (rubric only) — identical across calls so Anthropic prompt caching hits;
// per-draft content goes in the user message only. Registered so every judge generation is
// attributable to an exact prompt revision (enterprise-grade-brain WS-2.1 convention). Registry
// name is `copy/judge` (renamed from `evals/judge` on the Task 2 promotion into agent-brains) —
// this is the brain's home now, not an evals-only concern.
export const JUDGE_PROMPT = registerPrompt(
  "copy/judge",
  `You are an independent quality judge for cold-outreach copy on a B2B LinkedIn sales platform. You did NOT write the draft below — score it as a skeptical outside reviewer, not as a collaborator trying to be generous.

You will receive:
- Draft: the outreach copy to evaluate (a LinkedIn connection note, follow-up message, or reply).
- Grounding: the citable facts about the prospect this draft was supposed to be written from.
- (optional) Intended call-to-action.

Score four dimensions, each an integer 1-5 (5 = excellent, 1 = poor):

specificity — Does the draft reference concrete, specific facts about THIS prospect (a real signal, a real number, their actual role or company situation) rather than generic claims that could be sent to anyone unchanged? Check every specific claim against Grounding: a claim NOT supported by Grounding is a fabrication, not specificity, and should pull this score down hard. 5 = every concrete claim traces to Grounding; 3 = mixes a couple of real specifics with filler; 1 = entirely generic, no real specifics, or contains a claim Grounding does not support.

themFocus — Is the draft framed around the PROSPECT's world, problems, and goals, rather than the sender's product, company, or credentials? 5 = almost entirely about them; 3 = balanced but leans on "we/our" more than needed; 1 = a thinly-disguised pitch about the sender's product or team.

posture — Does the draft read as one peer reaching out with genuine, low-pressure relevance, rather than a salesperson pitching, begging, flattering, or pressuring for a reply or meeting? 5 = confident, curious, no ask-pressure; 3 = fine but slightly salesy or eager; 1 = pushy, needy, or reads like a template blast.

naturalness — Does the draft read like something a real, busy professional would actually type — natural rhythm and word choice, no corporate throat-clearing or AI-sounding filler ("I hope this finds you well", "I wanted to reach out", "in today's fast-paced world", "I noticed that...")? 5 = indistinguishable from a thoughtful human message; 3 = mostly natural with one stiff phrase; 1 = obviously templated or AI-generated phrasing throughout.

overall — Your holistic judgment of whether this draft is ready to send as written, weighing all four dimensions together. This is NOT a mechanical average of the four — a draft can be specific and natural but still weak overall if it fabricates a claim or buries the point, and a slightly generic draft can still be a strong 4 if everything it does say is grounded, well-postured, and natural. Score strictly: reserve 5 for copy you would send completely unedited. Most first-draft cold outreach should land in the 2-4 range.

rationale — 1-3 sentences explaining the scores. Always name the single biggest thing that would most improve the draft, even when scores are high.

Respond with integer scores 1-5 for specificity, themFocus, posture, naturalness, and overall, plus the rationale string.`
);

/**
 * Scores one cold-outreach copy draft against the rubric above. `model` defaults to
 * `getModel(JUDGE_MODEL_ID)` — tests always inject a mock, so `getModel()`'s
 * ANTHROPIC_API_KEY requirement is never hit in the test suite.
 */
export async function judgeCopy(
  draft: { text: string },
  context: { grounding: string; cta?: string },
  model: LanguageModel = getModel(JUDGE_MODEL_ID)
): Promise<JudgeVerdict> {
  const lines = [
    `Draft:\n${draft.text}`,
    `\nGrounding (citable facts this draft was written from):\n${context.grounding}`,
  ];
  if (context.cta) {
    lines.push(`\nIntended call-to-action:\n${context.cta}`);
  }

  const { object } = await generateObject({
    model,
    schema: judgeVerdictSchema,
    system: JUDGE_PROMPT.text,
    prompt: lines.join("\n"),
  });

  return object;
}
