import { generateObject, type LanguageModel } from "ai";
import { z } from "zod";
import { getClassifierModel, registerPrompt } from "@vantera/ai";

export const replyVerdictSchema = z.object({
  classification: z.enum(["interested", "not_interested", "neutral", "out_of_office", "unsubscribe", "other"]),
  // No schema-level max: a chatty model exceeding it failed validation and threw, sinking the
  // whole reply run (classify/suppress/notify). The length bound is applied after generation.
  rationale: z.string(),
  /**
   * The prospect confirmed a SPECIFIC scheduled meeting or call — a time agreed, an invite
   * accepted, "see you then". Stamps the lead's meeting_booked_at so the funnel's Meetings stage
   * is honest. Defaults false: mere interest or "let's find a time" is NOT a booking.
   */
  booked: z.boolean().default(false),
});

export type ReplyVerdict = z.infer<typeof replyVerdictSchema>;

export const RATIONALE_MAX_CHARS = 300;

// Removal must name a LIST (or all future contact): "remove me from the cc / this thread" is a
// human loop-in, and an unsubscribe here writes suppression that never expires (rule 11).
const LIST_TARGET = String.raw`(?:(?:your|the|this|that|any|all)\s+)?(?:(?:mailing|email|contact|distribution|marketing|prospect(?:ing)?|outreach|sales)\s+)?(?:list|lists|database|sequence|campaign)\b`;
const UNSUB_PATTERNS = [
  /\bunsubscribe\b/i,
  new RegExp(String.raw`\bremove me from\s+${LIST_TARGET}`, "i"),
  new RegExp(String.raw`\btake me off\s+${LIST_TARGET}`, "i"),
  /\bremove me from (all|any) (future )?(messages|emails|outreach|communications?|contact)\b/i,
  /\bstop (emailing|messaging|contacting) (me|us)\b/i,
  /\bdon'?t contact (me|us)\b/i,
];

// Auto-responder phrasing only: a header-style prefix, the canned "this is an automatic reply",
// or an absence statement (first-person, or opening the message) with a return cue. A human who merely MENTIONS being out
// of office ("I was out last week — what's the price?") goes to the model.
const RETURN_CUE = String.raw`\b(until|returning|return(ing)? on|will return|back on|back in|limited access|when i'?m back|when i am back|when i return|upon (my )?return)\b`;
const OOO_PATTERNS = [
  /^\s*(automatic|auto)[- ]?(reply|response)\s*:/i,
  /\bthis is an? auto(matic|mated)?[- ]?(reply|response)\b/i,
  new RegExp(String.raw`(^\s*|\b(i am|i'm|i will be|i'll be)\s+)(currently\s+)?(out of (the )?office|away|on (annual|parental|sick|maternity|paternity) leave)\b[^.?!]*${RETURN_CUE}`, "i"),
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

const CLASSIFY_SYSTEM = registerPrompt("reply/classify", `You classify a prospect's reply to B2B outreach.
interested = wants to learn more, asks to see more / get a deck / "send info", or accepts the ask.
not_interested = a clear no, polite or hard ("not for us", "we're all set", "no thanks").
neutral = ambiguous, a question without commitment, OR a soft/timing deferral ("not right now",
"reach back next quarter", "maybe later") — treat a "later" as neutral, never as a no.
out_of_office = auto-responder. unsubscribe = asks to stop contact.
other = wrong person, a referral to someone else ("you want X, not me"), forwarded, or anything else.
Set booked=true ONLY when the prospect confirms a specific meeting or call is scheduled — a time
agreed, an invite accepted, or "see you then". Mere interest, "let's find a time", or asking for a
link is NOT booked. Rationale: one short sentence.`);

export async function classifyReply(
  body: string,
  model: LanguageModel = getClassifierModel()
): Promise<ReplyVerdict> {
  const pre = preClassify(body);
  if (pre) return pre;
  const { object } = await generateObject({
    model,
    schema: replyVerdictSchema,
    system: CLASSIFY_SYSTEM.text,
    prompt: `Reply:\n${body.slice(0, 2000)}`,
    maxOutputTokens: 300,
  });
  return { ...object, rationale: object.rationale.slice(0, RATIONALE_MAX_CHARS) };
}
