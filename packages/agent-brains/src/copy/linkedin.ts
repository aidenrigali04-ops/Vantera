import { generateObject, type LanguageModel } from "ai";
import { z } from "zod";
import { getModel } from "@vantera/ai";
import { validateHumanity, findUngroundedClaims, normalizeDashes, type Violation } from "./humanizer";
import { avoidBlock, generateHumanized, leadBlock, strategyDirectives, PROSPECT_ACCURACY_RULE, VOICE_RULES, type DraftInput } from "./shared";

/**
 * LinkedIn's hard cap on a connection-request note is 300 chars, but free-tier
 * accounts are limited to 200. We generate AND validate to 200 so a reviewed,
 * approved note is sent verbatim — never truncated mid-word at the send boundary
 * (the send path enforces the same cap; see LINKEDIN_NOTE_MAX in jobs).
 */
export const CONNECTION_NOTE_MAX_CHARS = 200;
// First message after acceptance. Kept short on purpose — a long DM reads like a pitch and gets
// ignored; 1–2 tight sentences earn a reply (500 → 300 on 2026-06-29, → 250 on 2026-07-08, → 180
// on 2026-07-10 owner feedback "the initial outreach message is too long"). Paired with a word cap
// so a draft can't pack length into short words and still read like a wall of text.
export const FOLLOWUP_MAX_CHARS = 180;
export const FOLLOWUP_MAX_WORDS = 28;

export const linkedinDraftSchema = z.object({
  connection_note: z.string().max(300),
  followup_message: z.string().max(600),
});

export interface LinkedInDraft {
  connectionNote: string;
  followupMessage: string;
  /** unresolved humanizer violations — surfaced in the review queue, never silently shipped */
  violations: Violation[];
}

// LinkedIn outreach system prompt. Practices baked in: connection notes that pitch get
// ignored or reported — the note only references the trigger/commonality; the pitch waits
// for the follow-up after acceptance, and even that stays soft. Conversational register,
// no formal sign-offs (it's chat, not email).
const LINKEDIN_SYSTEM = `You write LinkedIn outreach for a B2B seller: a connection note and one follow-up message (sent only after the prospect accepts).

Connection note, under ${CONNECTION_NOTE_MAX_CHARS} characters:
- Reference the prospect's trigger, work, or a genuine commonality. That's all. One short line lands better than two.
- NO pitch, no CTA, no links, no "I'd love to connect about our product". The only goal is an accepted request from a real-sounding peer.

Follow-up message: one or two short sentences, aim for about 120 characters and never exceed ${FOLLOWUP_MAX_CHARS} (about ${FOLLOWUP_MAX_WORDS} words). Shorter always wins. This is the FIRST real exchange, and buyers delete anything long or anything that opens with a pitch, so:
- Do NOT name the seller's company or product. Do NOT list features or describe what the seller does. Do NOT ask for a call, meeting, or demo. All of that comes later, after they engage.
- Shape: a brief thanks (3 to 6 words, not gushing), then ONE sharp observation about THEIR situation and ONE genuinely curious question about how they handle it today. The question is the whole CTA, so make it easy and interesting to answer.
- The "CTA goal" in the block only tells you where the conversation should eventually head. It must NOT appear as an ask in this message.
- If the prospect's location strongly implies a primary language other than English, writing in that language is welcome.

${PROSPECT_ACCURACY_RULE}

${VOICE_RULES}

If you ever reference the seller, use ONLY the "Seller company" value from the block, never any other brand name from the offer description.`;

// `grounding` is the per-lead facts (leadBlock). When provided, both messages are checked for
// fabricated metric claims (rule 11 / anti-hallucination); unresolved ones surface in review.
// `sellerName` enforces the de-pitched first touch: naming the product in message 1 is the
// "pitch slap" buyers cite as the top delete trigger (2026-07-08 copy analysis).
export function validateLinkedInDraft(
  draft: {
    connection_note: string;
    followup_message: string;
  },
  grounding?: string,
  sellerName?: string | null,
): Violation[] {
  const violations = [
    ...validateHumanity(draft.connection_note, { maxChars: CONNECTION_NOTE_MAX_CHARS }),
    ...validateHumanity(draft.followup_message, { maxChars: FOLLOWUP_MAX_CHARS, maxWords: FOLLOWUP_MAX_WORDS }),
  ];
  if (/https?:\/\//i.test(draft.connection_note)) {
    violations.push({ rule: "no-links", detail: "no links in a connection note" });
  }
  // The first follow-up is a soft, human ask — a raw link makes it read like a pitch (content is
  // referenced, never pasted in the first touch). Same anti-pitch discipline as the note.
  if (/https?:\/\//i.test(draft.followup_message)) {
    violations.push({ rule: "no-links", detail: "no links in the first follow-up — keep it a soft ask" });
  }
  // Touch 1 earns a conversation; it never sells. Product name or a meeting ask here is the
  // classic pitch-slap — enforced, not just prompted.
  if (sellerName && sellerName.trim().length > 2 && draft.followup_message.toLowerCase().includes(sellerName.trim().toLowerCase())) {
    violations.push({ rule: "no-product-pitch", detail: `the first message must not name ${sellerName.trim()} — earn the conversation first` });
  }
  if (/\b(?:a\s+(?:quick\s+)?call|meeting|demo|calendar|15\s*-?\s*min)\b/i.test(draft.followup_message)) {
    violations.push({ rule: "no-meeting-ask", detail: "no call/meeting ask in the first message — the question IS the CTA" });
  }
  if (grounding) {
    violations.push(
      ...findUngroundedClaims(`${draft.connection_note}\n${draft.followup_message}`, grounding),
    );
  }
  return violations;
}

/** LinkedIn copy system: personalized connection note + post-accept follow-up per lead. */
export async function draftLinkedIn(
  input: DraftInput,
  model: LanguageModel = getModel()
): Promise<LinkedInDraft> {
  const block = leadBlock(input);
  // Optional experiment strategy + recent-phrasing avoidance are appended after the block; both are
  // empty by default, so the prompt is unchanged when neither applies. Grounding stays the BLOCK
  // alone (neither adds facts), so the humanizer/anti-hallucination checks are identical.
  const strat = strategyDirectives(input.context.strategy);
  const avoid = avoidBlock(input.context.avoidPhrases);
  const basePrompt = [block, strat, avoid].filter(Boolean).join("\n\n");
  const { output, violations } = await generateHumanized(
    async (fixNote) => {
      const obj = (
        await generateObject({
          model,
          schema: linkedinDraftSchema,
          system: LINKEDIN_SYSTEM,
          prompt: fixNote ? `${basePrompt}\n\n${fixNote}` : basePrompt,
          maxOutputTokens: 600,
        })
      ).object;
      // Fix stray em-dashes deterministically before linting (both fields), same reason as the
      // conversation brain — a clean note shouldn't wait in review over one dash.
      return {
        connection_note: normalizeDashes(obj.connection_note),
        followup_message: normalizeDashes(obj.followup_message),
      };
    },
    (draft) => validateLinkedInDraft(draft, block, input.context.accountName)
  );
  return {
    connectionNote: output.connection_note,
    followupMessage: output.followup_message,
    violations,
  };
}
