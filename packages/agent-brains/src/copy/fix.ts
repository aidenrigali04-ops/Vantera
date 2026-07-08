import { generateObject, type LanguageModel } from "ai";
import { z } from "zod";
import { getModel } from "@vantera/ai";
import { validateHumanity, type Violation } from "./humanizer";
import { generateHumanized, leadBlock, type DraftInput } from "./shared";
import {
  CONNECTION_NOTE_MAX_CHARS,
  FOLLOWUP_MAX_CHARS,
  linkedinDraftSchema,
  validateLinkedInDraft,
  type LinkedInDraft,
} from "./linkedin";
import {
  allowedConversationLinks,
  renderThread,
  validateConversationMessage,
  type ConversationDraft,
  type ConversationMessageInput,
} from "../reply/respond";

/**
 * The copy FIX pass — a targeted EDIT of copy that already failed the humanizer, as opposed to the
 * bounded regenerate inside each draft brain (which re-rolls from the full lead context). Two homes:
 * the review queue's "Fix" button (an owner clicks it on a flagged draft) and the automatic-send
 * paths (a flagged draft gets one fix attempt before it may auto-send). Every fix is re-linted with
 * the SAME validator that flagged the original, so a "fixed" message can never dodge the bar — and
 * anything still flagged after the fix stays in the review queue (rule 06/11: never silent-send).
 *
 * Editing (not regenerating) is deliberate: the draft's personalization already passed grounding,
 * so the safest repair keeps the message and removes the slop — the prompt forbids new facts,
 * numbers, claims, or links, which is what makes a grounding-blind fix safe.
 */

const FIX_SYSTEM = `You EDIT B2B outreach copy that failed a style check. Rewrite it to fix EVERY listed violation while preserving the message's meaning, personalization, and intent.

Rules:
- Do NOT add any new facts, numbers, metrics, claims, customer names, or links. You may only rephrase or remove.
- Keep the same conversational chat register. Do not make the message longer; shorter is better.
- Never use a dash of any kind as punctuation. Use a comma or start a new sentence. No semicolons, no bullet points.
- No greetings/sign-offs that weren't there, at most one exclamation mark, minimal hedging. Plain everyday words, never business-speak (utilize, leverage, streamline).
- Return only the corrected text.`;

function violationList(violations: Violation[]): string {
  return violations.map((v) => `- ${v.rule}: ${v.detail}`).join("\n");
}

/** Fix a flagged first-touch LinkedIn pair (connection note + follow-up), re-validated against the
 *  same grounding the draft was checked with. Used by the automatic-send copy-draft path. */
export async function fixLinkedInDraft(
  draft: LinkedInDraft,
  input: DraftInput,
  model: LanguageModel = getModel()
): Promise<LinkedInDraft> {
  const block = leadBlock(input);
  const prompt = [
    `Lead facts (for context only, do not add anything not already in the messages):`,
    block,
    ``,
    `Connection note (max ${CONNECTION_NOTE_MAX_CHARS} chars, no links, no pitch):`,
    draft.connectionNote,
    ``,
    `Follow-up message (max ${FOLLOWUP_MAX_CHARS} chars, no links):`,
    draft.followupMessage,
    ``,
    `Style violations to fix:`,
    violationList(draft.violations),
  ].join("\n");

  const { output, violations } = await generateHumanized(
    async (fixNote) =>
      (
        await generateObject({
          model,
          schema: linkedinDraftSchema,
          system: FIX_SYSTEM,
          prompt: fixNote ? `${prompt}\n\n${fixNote}` : prompt,
          maxOutputTokens: 600,
        })
      ).object,
    (fixed) => validateLinkedInDraft(fixed, block, input.context.accountName)
  );
  return {
    connectionNote: output.connection_note,
    followupMessage: output.followup_message,
    violations,
  };
}

const fixedMessageSchema = z.object({ message: z.string().max(600) });

/** Fix a flagged conversation message (reply or scripted follow-up), held to the full
 *  mid-conversation bar (humanity + no-restart + grounded claims). Used by the automatic-send
 *  responder and sequence-touch paths. */
export async function fixConversationMessage(
  original: ConversationDraft,
  input: ConversationMessageInput,
  model: LanguageModel = getModel()
): Promise<ConversationDraft> {
  const block = leadBlock({ lead: input.lead, insights: input.insights, context: input.context });
  const prompt = [
    `Lead facts (for context only, do not add anything not already in the message):`,
    block,
    ``,
    `Conversation so far:`,
    renderThread(input.thread),
    ``,
    `Your flagged next message (mid-conversation, never re-introduce yourself):`,
    original.message,
    ``,
    `Style violations to fix:`,
    violationList(original.violations),
  ].join("\n");

  const { output, violations } = await generateHumanized(
    async (fixNote) =>
      (
        await generateObject({
          model,
          schema: fixedMessageSchema,
          system: FIX_SYSTEM,
          prompt: fixNote ? `${prompt}\n\n${fixNote}` : prompt,
          maxOutputTokens: 300,
        })
      ).object,
    (fixed) => validateConversationMessage(fixed.message, block, allowedConversationLinks(input.context))
  );
  return { message: output.message, violations };
}

export interface DraftTextFix {
  text: string;
  violations: Violation[];
}

/**
 * Fix one flagged draft body from the review queue, where only the stored text + flag string exist
 * (no lead context). Re-linted with the humanizer at the stage's send cap; `banLinks` adds the
 * no-links rule (always for invites, and whenever the original flags mention links). The no-new-facts
 * instruction stands in for the grounding check the original draft already passed.
 */
export async function fixDraftText(
  input: { text: string; flags: string; maxChars: number; banLinks?: boolean },
  model: LanguageModel = getModel()
): Promise<DraftTextFix> {
  const validate = (text: string): Violation[] => {
    const violations = validateHumanity(text, { maxChars: input.maxChars });
    if (input.banLinks && /https?:\/\//i.test(text)) {
      violations.push({ rule: "no-links", detail: "no links in this message" });
    }
    return violations;
  };

  const prompt = [
    `Message (max ${input.maxChars} chars):`,
    input.text,
    ``,
    `Style violations to fix:`,
    input.flags,
  ].join("\n");

  const { output, violations } = await generateHumanized(
    async (fixNote) =>
      (
        await generateObject({
          model,
          schema: fixedMessageSchema,
          system: FIX_SYSTEM,
          prompt: fixNote ? `${prompt}\n\n${fixNote}` : prompt,
          maxOutputTokens: 300,
        })
      ).object,
    (fixed) => validate(fixed.message)
  );
  return { text: output.message, violations };
}
