import { generateObject, type LanguageModel } from "ai";
import { z } from "zod";
import { getModel } from "@vantera/ai";

export const replyVerdictSchema = z.object({
  classification: z.enum(["interested", "not_interested", "neutral", "out_of_office", "unsubscribe", "other"]),
  rationale: z.string().max(300),
});

export type ReplyVerdict = z.infer<typeof replyVerdictSchema>;

const UNSUB_PATTERNS = [
  /unsubscribe/i,
  /remove me/i,
  /take me off/i,
  /stop (emailing|messaging|contacting)/i,
  /don'?t contact/i,
];

const OOO_PATTERNS = [
  /out of (the )?office/i,
  /on (annual|parental|sick) leave/i,
  /auto(matic)?[- ]?reply/i,
];

/** Deterministic first pass: legal-significance phrases never depend on a model. */
export function preClassify(body: string): ReplyVerdict | null {
  if (UNSUB_PATTERNS.some((p) => p.test(body))) {
    return { classification: "unsubscribe", rationale: "explicit removal request" };
  }
  if (OOO_PATTERNS.some((p) => p.test(body))) {
    return { classification: "out_of_office", rationale: "auto-responder phrasing" };
  }
  return null;
}

const SYSTEM = `You classify a prospect's reply to B2B outreach.
interested = wants to learn more or accepts the ask. not_interested = a clear no, polite or hard.
neutral = ambiguous, or a question without commitment. out_of_office = auto-responder.
unsubscribe = asks to stop contact. other = wrong person, forwarded, anything else.
Rationale: one short sentence.`;

export async function classifyReply(
  body: string,
  model: LanguageModel = getModel()
): Promise<ReplyVerdict> {
  const pre = preClassify(body);
  if (pre) return pre;
  const { object } = await generateObject({
    model,
    schema: replyVerdictSchema,
    system: SYSTEM,
    prompt: `Reply:\n${body.slice(0, 2000)}`,
    maxOutputTokens: 200,
  });
  return object;
}
