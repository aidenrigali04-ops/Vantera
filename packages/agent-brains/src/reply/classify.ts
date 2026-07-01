import { generateObject, type LanguageModel } from "ai";
import { z } from "zod";
import { getModel } from "@vantera/ai";

export const replyVerdictSchema = z.object({
  classification: z.enum(["interested", "not_interested", "neutral", "out_of_office", "unsubscribe", "other"]),
  rationale: z.string().max(300),
  /**
   * The prospect confirmed a SPECIFIC scheduled meeting or call — a time agreed, an invite
   * accepted, "see you then". Stamps the lead's meeting_booked_at so the funnel's Meetings stage
   * is honest. Defaults false: mere interest or "let's find a time" is NOT a booking.
   */
  booked: z.boolean().default(false),
});

export type ReplyVerdict = z.infer<typeof replyVerdictSchema>;

const UNSUB_PATTERNS = [
  /\bunsubscribe\b/i,
  /\bremove me from\b/i,
  /\btake me off (your|the|this)\b/i,
  /\bstop (emailing|messaging|contacting) (me|us)\b/i,
  /\bdon'?t contact (me|us)\b/i,
];

const OOO_PATTERNS = [
  /out of (the )?office/i,
  /on (annual|parental|sick) leave/i,
  /auto(matic)?[- ]?reply/i,
];

/** Deterministic first pass: legal-significance phrases never depend on a model. */
export function preClassify(body: string): ReplyVerdict | null {
  if (UNSUB_PATTERNS.some((p) => p.test(body))) {
    return { classification: "unsubscribe", rationale: "explicit removal request", booked: false };
  }
  if (OOO_PATTERNS.some((p) => p.test(body))) {
    return { classification: "out_of_office", rationale: "auto-responder phrasing", booked: false };
  }
  return null;
}

const SYSTEM = `You classify a prospect's reply to B2B outreach.
interested = wants to learn more, asks to see more / get a deck / "send info", or accepts the ask.
not_interested = a clear no, polite or hard ("not for us", "we're all set", "no thanks").
neutral = ambiguous, a question without commitment, OR a soft/timing deferral ("not right now",
"reach back next quarter", "maybe later") — treat a "later" as neutral, never as a no.
out_of_office = auto-responder. unsubscribe = asks to stop contact.
other = wrong person, a referral to someone else ("you want X, not me"), forwarded, or anything else.
Set booked=true ONLY when the prospect confirms a specific meeting or call is scheduled — a time
agreed, an invite accepted, or "see you then". Mere interest, "let's find a time", or asking for a
link is NOT booked. Rationale: one short sentence.`;

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
