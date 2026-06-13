import { generateObject, type LanguageModel } from "ai";
import { getModel } from "@vantera/ai";
import { callOutcomeSchema, type CallOutcome } from "./schema";

/** Fast path: provider already tells us no-answer/voicemail; skip the LLM. */
export function mapProviderDisposition(raw: string): CallOutcome | null {
  if (raw === "no_answer" || raw === "voicemail") return raw;
  return null;
}

const CLASSIFY_SYSTEM = `Classify the result of a cold sales call from its transcript into exactly one outcome:
booked (a meeting was agreed), callback (asked to be called later), not_interested (declined),
do_not_call (asked never to be contacted), voicemail (left a message), no_answer (no live person).
Choose the single best fit.`;

export async function classifyOutcome(
  transcript: string,
  model: LanguageModel = getModel(),
  generate: typeof generateObject = generateObject
): Promise<CallOutcome> {
  const { object } = await generate({
    model,
    schema: callOutcomeSchema,
    system: CLASSIFY_SYSTEM,
    prompt: transcript,
  });
  return object.outcome;
}
