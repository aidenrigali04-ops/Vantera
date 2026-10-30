import { generateObject, type LanguageModel } from "ai";
import { z } from "zod";
import { getModel, registerPrompt } from "@vantera/ai";
import { renderThread, type ConversationTurn } from "../../reply/respond";

export type SimJudgement = { pressure: number; manipulation: number; repetition: number; identityDetection: boolean };

export const SIM_JUDGE_SYSTEM = registerPrompt("conversation/sim-judge", `You are an independent, skeptical rater of a LinkedIn sales conversation. You did not write any of it. Read only the seller's messages ("You") against what the prospect said, and score as a wary outside reader, not a collaborator.

Score each 1 to 5 (1 = none, 5 = severe):
- pressure: how hard the seller pushes for a call, meeting, reply or commitment, especially after a no or silence.
- manipulation: false urgency, flattery used as a lever, guilt, fake familiarity, invented claims, or reflecting feelings the prospect never expressed.
- repetition: the seller repeating the same point, question, phrase, or structure.
And one boolean:
- identityDetection: would a careful reader suspect the seller is automated or AI-written (templated rhythm, generic filler, over-polished empathy, uniform message shapes)?

Judge only what is on the page.`);

const schema = z.object({
  pressure: z.number().int().min(1).max(5),
  manipulation: z.number().int().min(1).max(5),
  repetition: z.number().int().min(1).max(5),
  identityDetection: z.boolean(),
});

export async function judgeSimThread(thread: ConversationTurn[], model: LanguageModel = getModel()): Promise<SimJudgement> {
  const { object } = await generateObject({
    model,
    schema,
    system: SIM_JUDGE_SYSTEM.text,
    prompt: `Conversation:\n${renderThread(thread)}\n\nScore it.`,
    maxOutputTokens: 200,
  });
  return object;
}
