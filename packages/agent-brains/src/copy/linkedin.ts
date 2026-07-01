import { generateObject, type LanguageModel } from "ai";
import { z } from "zod";
import { getModel } from "@vantera/ai";
import { validateHumanity, findUngroundedClaims, type Violation } from "./humanizer";
import { generateHumanized, leadBlock, strategyDirectives, type DraftInput } from "./shared";

/**
 * LinkedIn's hard cap on a connection-request note is 300 chars, but free-tier
 * accounts are limited to 200. We generate AND validate to 200 so a reviewed,
 * approved note is sent verbatim — never truncated mid-word at the send boundary
 * (the send path enforces the same cap; see LINKEDIN_NOTE_MAX in jobs).
 */
export const CONNECTION_NOTE_MAX_CHARS = 200;
// First message after acceptance. Kept short on purpose — a long DM reads like a pitch and gets
// ignored; 1–2 tight sentences earn a reply (was 500, trimmed 2026-06-29 on owner feedback).
export const FOLLOWUP_MAX_CHARS = 300;

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

Connection note — under ${CONNECTION_NOTE_MAX_CHARS} characters:
- Reference the prospect's trigger, work, or a genuine commonality. That's all.
- NO pitch, no CTA, no links, no "I'd love to connect about our product". The only goal is an accepted request from a real-sounding peer.

Follow-up message — KEEP IT SHORT, under ${FOLLOWUP_MAX_CHARS} characters, ideally 1-2 sentences:
- A brief thanks (3-6 words, not gushing), then ONE sharp observation tying their pain/trigger to the aha moment as a concrete outcome. Cut every word that isn't pulling weight.
- End with ONE soft, interest-based ask aligned to the CTA goal. No meeting demands, no calendar links.
- Brevity matters more than completeness — a tight two-sentence message beats a thorough one. Do not pad.

Both: conversational chat register, no "Dear", no "Best regards", no signature. Plain human voice: no "I hope this finds you well", no buzzwords ("game-changer", "cutting-edge", "seamless"), no generic flattery ("big fan of", "love what you're doing"), no "As a …" openers, at most one em-dash, at most one exclamation mark, minimal hedging. Name the seller ONLY by the "Seller company" value from the block — ignore any other brand name that appears in the offer description.`;

// `grounding` is the per-lead facts (leadBlock). When provided, both messages are checked for
// fabricated metric claims (rule 11 / anti-hallucination); unresolved ones surface in review.
export function validateLinkedInDraft(
  draft: {
    connection_note: string;
    followup_message: string;
  },
  grounding?: string,
): Violation[] {
  const violations = [
    ...validateHumanity(draft.connection_note, { maxChars: CONNECTION_NOTE_MAX_CHARS }),
    ...validateHumanity(draft.followup_message, { maxChars: FOLLOWUP_MAX_CHARS }),
  ];
  if (/https?:\/\//i.test(draft.connection_note)) {
    violations.push({ rule: "no-links", detail: "no links in a connection note" });
  }
  // The first follow-up is a soft, human ask — a raw link makes it read like a pitch (content is
  // referenced, never pasted in the first touch). Same anti-pitch discipline as the note.
  if (/https?:\/\//i.test(draft.followup_message)) {
    violations.push({ rule: "no-links", detail: "no links in the first follow-up — keep it a soft ask" });
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
  // Optional experiment strategy is appended after the block; empty for the champion baseline, so the
  // prompt is unchanged when no experiment is running. Grounding stays the block (strategy adds no
  // facts), so the humanizer/anti-hallucination checks are identical.
  const strat = strategyDirectives(input.context.strategy);
  const basePrompt = strat ? `${block}\n\n${strat}` : block;
  const { output, violations } = await generateHumanized(
    async (fixNote) =>
      (
        await generateObject({
          model,
          schema: linkedinDraftSchema,
          system: LINKEDIN_SYSTEM,
          prompt: fixNote ? `${basePrompt}\n\n${fixNote}` : basePrompt,
          maxOutputTokens: 600,
        })
      ).object,
    (draft) => validateLinkedInDraft(draft, block)
  );
  return {
    connectionNote: output.connection_note,
    followupMessage: output.followup_message,
    violations,
  };
}
