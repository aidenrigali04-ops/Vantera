import { generateObject, type LanguageModel } from "ai";
import { z } from "zod";
import { getModel, registerPrompt } from "@vantera/ai";
import { findMissingWhyNow, type WhyNow } from "./why-now";
import { validateHumanity, findUngroundedClaims, findUngroundedEntities, normalizeDashes, type Violation } from "./humanizer";
import { generateHumanized, PROSPECT_ACCURACY_RULE, VOICE_RULES, type DraftInput } from "./shared";
import { assemblePrompt, leadIdentity, CONNECTION_NOTE_MAX_CHARS } from "./linkedin";

/**
 * Note-only first-touch brain. Used when the first message after acceptance is written later, from
 * the live acceptance context: at invite time we only need the connection note. The note rules are
 * the pair prompt's "Connection note" section verbatim (a test pins that), so the two brains cannot
 * drift on what a note may say.
 */
export const linkedinNoteSchema = z.object({ connection_note: z.string().max(300) });

export interface LinkedInNoteDraft {
  connectionNote: string;
  /** unresolved humanizer violations, surfaced in the review queue, never silently shipped */
  violations: Violation[];
}

export const LINKEDIN_NOTE_SYSTEM = registerPrompt("copy/linkedin-note", `You write the LinkedIn connection note for a B2B seller. Only the note: nothing is written after it.

Connection note, under ${CONNECTION_NOTE_MAX_CHARS} characters:
- Reference the prospect's trigger, work, or a genuine commonality. That's all. One short line lands better than two.
- NO pitch, no CTA, no links, no "I'd love to connect about our product". The only goal is an accepted request from a real-sounding peer.

${PROSPECT_ACCURACY_RULE}

${VOICE_RULES}

If you ever reference the seller, use ONLY the "Seller company" value from the block, never any other brand name from the offer description.`);

/**
 * The invite-part lints of validateLinkedInDraft, applied to a lone note: humanity limits at the
 * note cap, no links, why-now citation, and grounding checks when a grounding block is supplied.
 */
export function validateLinkedInNote(
  note: string,
  grounding: string | null,
  whyNow: WhyNow | null | undefined,
  identity: string,
): Violation[] {
  const tag = (vs: Violation[]): Violation[] => vs.map((v) => ({ ...v, part: "invite" as const }));
  const violations: Violation[] = [...tag(validateHumanity(note, { maxChars: CONNECTION_NOTE_MAX_CHARS }))];
  if (/https?:\/\//i.test(note)) {
    violations.push({ rule: "no-links", detail: "no links in a connection note", part: "invite" });
  }
  violations.push(...tag(findMissingWhyNow(note, whyNow, identity)));
  if (grounding) {
    violations.push(...tag([...findUngroundedClaims(note, grounding), ...findUngroundedEntities(note, grounding)]));
  }
  return violations;
}

export async function draftLinkedInNote(input: DraftInput, model: LanguageModel = getModel()): Promise<LinkedInNoteDraft> {
  const { grounding, basePrompt } = assemblePrompt(input, null);
  const { output, violations } = await generateHumanized(
    async (fixNote) => {
      const obj = (
        await generateObject({
          model,
          schema: linkedinNoteSchema,
          system: LINKEDIN_NOTE_SYSTEM.text,
          prompt: fixNote ? `${basePrompt}\n\n${fixNote}` : basePrompt,
          maxOutputTokens: 300,
        })
      ).object;
      return { connection_note: normalizeDashes(obj.connection_note) };
    },
    (draft) => validateLinkedInNote(draft.connection_note, grounding, input.lead.whyNow, leadIdentity(input.lead)),
  );
  return { connectionNote: output.connection_note, violations };
}
