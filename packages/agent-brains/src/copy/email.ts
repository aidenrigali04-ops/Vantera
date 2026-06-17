import { generateObject, type LanguageModel } from "ai";
import { z } from "zod";
import { getModel } from "@vantera/ai";
import { validateHumanity, findUngroundedClaims, type Violation } from "./humanizer";
import { generateHumanized, leadBlock, type DraftInput } from "./shared";

export const EMAIL_MAX_WORDS = 90;
const SUBJECT_MAX_WORDS = 5;

export const emailDraftSchema = z.object({
  subject: z.string().max(60),
  body: z.string().max(800),
});

export interface EmailDraft {
  subject: string;
  body: string;
  /** unresolved humanizer violations — surfaced in the review queue, never silently shipped */
  violations: Violation[];
}

// Cold-email system prompt. Practices baked in from outbound research (Lavender/Gong-school):
// short beats long, one idea per email, observation-first openers, interest-based CTAs,
// internal-style subjects. Compliance floor per rule 11: honest subject, accurate sender intent.
const EMAIL_SYSTEM = `You write first-touch cold emails for a B2B seller. You get a seller/prospect block; write one email.

Structure: observation → relevance → ask.
1. Open with a specific observation about the PROSPECT (their trigger or pain) — never about the seller, never with a greeting line.
2. One connecting sentence: why that observation means the seller's offer is relevant, anchored on the aha moment as a concrete outcome.
3. Close with ONE soft, interest-based ask aligned to the CTA goal ("worth a look?", "open to seeing how?") — never demand a meeting slot.

Hard rules:
- Body under ${EMAIL_MAX_WORDS} words. Two or three short paragraphs of 1-2 sentences. Vary sentence length.
- Reading level: a smart 12-year-old understands it. No jargon, no buzzwords.
- Subject: 1-${SUBJECT_MAX_WORDS} words, specific to the observation, written like an internal note (lowercase except proper nouns). Never clickbait, never deceptive — it must honestly reflect the body.
- No links, no images, no attachments in a first touch.
- Plain human voice: no "I hope this finds you well", no "I wanted to reach out", no "game-changer"/"cutting-edge"/"seamless", no generic flattery, no "As a …" openers, at most one em-dash, at most one exclamation mark, minimal hedging.
- Use the prospect's first name at most once. Sign-off is just the sender's first name placeholder "{{sender_name}}".`;

// `grounding` is the per-lead facts (leadBlock). When provided, the body is checked for
// fabricated metric claims (rule 11 / anti-hallucination); unresolved ones surface in the
// review queue rather than reaching a prospect.
export function validateEmailDraft(
  draft: { subject: string; body: string },
  grounding?: string,
): Violation[] {
  const violations = validateHumanity(draft.body, { maxWords: EMAIL_MAX_WORDS });
  const subjectWords = draft.subject.trim().split(/\s+/).filter(Boolean).length;
  if (subjectWords > SUBJECT_MAX_WORDS) {
    violations.push({ rule: "subject-length", detail: `${subjectWords} words; cap is ${SUBJECT_MAX_WORDS}` });
  }
  if (draft.subject.includes("!")) {
    violations.push({ rule: "subject-style", detail: "no exclamation marks in subjects" });
  }
  if (/https?:\/\//i.test(draft.body)) {
    violations.push({ rule: "no-links", detail: "no links in a first-touch email" });
  }
  if (grounding) {
    violations.push(...findUngroundedClaims(`${draft.subject}\n${draft.body}`, grounding));
  }
  return violations;
}

/** Email copy system: one personalized first-touch draft per lead. */
export async function draftEmail(
  input: DraftInput,
  model: LanguageModel = getModel()
): Promise<EmailDraft> {
  const block = leadBlock(input);
  const { output, violations } = await generateHumanized(
    async (fixNote) =>
      (
        await generateObject({
          model,
          schema: emailDraftSchema,
          system: EMAIL_SYSTEM,
          prompt: fixNote ? `${block}\n\n${fixNote}` : block,
          maxOutputTokens: 700,
        })
      ).object,
    (draft) => validateEmailDraft(draft, block)
  );
  return { ...output, violations };
}
