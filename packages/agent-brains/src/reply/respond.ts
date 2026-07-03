import { generateObject, type LanguageModel } from "ai";
import { z } from "zod";
import { getModel } from "@vantera/ai";
import type { StoredInsights } from "../prospect/schema";
import { validateHumanity, findUngroundedClaims, findRestartPhrases, type Violation } from "../copy/humanizer";
import { generateHumanized, leadBlock, type CopyContext, type CopyLead } from "../copy/shared";
import type { ReplyVerdict } from "./classify";

/** One message in the running 1:1 thread, oldest first. */
export interface ConversationTurn {
  role: "agent" | "lead";
  text: string;
}

export interface ConversationMessageInput {
  lead: CopyLead;
  insights: StoredInsights;
  /** Same grounding the outreach copy used — CTA, value prop, seller identity, guardrails. */
  context: CopyContext;
  /** Prior messages (excludes the incoming one being answered), oldest first. */
  thread: ConversationTurn[];
  /**
   * The prospect's latest message — present when answering a REPLY. Omit for a PROACTIVE follow-up
   * (the prospect went quiet): the brain then writes a fresh nudge that builds on the thread instead
   * of responding to anything.
   */
  incoming?: string;
  /** How the incoming message was classified (only meaningful in reply mode). */
  classification?: ReplyVerdict["classification"];
}

export interface ConversationDraft {
  message: string;
  /** unresolved humanizer / grounding violations — route to review, never silent-send (rule 06/11) */
  violations: Violation[];
}

/** One LinkedIn DM. Short by design — long DMs read like a pitch and get ignored. */
export const CONVERSATION_REPLY_MAX_CHARS = 350;

export const conversationReplySchema = z.object({
  message: z.string().max(600),
});

// The "converse to close" system prompt. Same voice + anti-pitch discipline as the outreach copy
// brain (copy/linkedin), but conversational: it must FOLLOW the thread — never restart it or repeat
// what's already been said — and move ONE step toward the CTA. Grounding + humanizer linting shared.
const RESPOND_SYSTEM = `You are the seller, continuing a 1:1 LinkedIn conversation you already started. Write ONLY your next message — the raw DM text, nothing else.

You are mid-conversation, NOT introducing yourself. The thread so far is given; build on it. NEVER restart, NEVER re-introduce yourself ("Wanted to connect", "Saw you reacted to…"), NEVER repeat a point you already made.

Reply mode (the prospect just sent a message): directly address what they actually said — answer their question, acknowledge their point or objection — then move ONE step toward the CTA goal.
Follow-up mode (the prospect hasn't replied yet): send a brief, natural nudge that adds a NEW angle or a light reason to respond. Do not guilt-trip ("just following up", "circling back").

Rules for every message:
- KEEP IT SHORT: 1-2 sentences, under ${CONVERSATION_REPLY_MAX_CHARS} characters. Brevity earns replies; cut every word not pulling weight.
- Ground every claim in the facts block — never invent a metric, customer, feature, or outcome.
- Soft asks only — offer, don't demand; no calendar links, no meeting ultimatums.
- Conversational chat register: no "Dear", no "Best regards", no signature, no buzzwords ("game-changer", "seamless"), no generic flattery, at most one em-dash, at most one exclamation mark, minimal hedging.
- Name the seller ONLY by the "Seller company" value in the block.`;

export function renderThread(thread: ConversationTurn[]): string {
  if (thread.length === 0) return "(no earlier messages yet)";
  return thread.map((t) => `${t.role === "agent" ? "You" : "Prospect"}: ${t.text}`).join("\n");
}

/** The full mid-conversation ruleset — shared with the fix pass so a "fixed" message is held to
 *  the exact bar that flagged the original (humanity + no-restart + grounded claims). */
export function validateConversationMessage(message: string, block: string): Violation[] {
  return [
    ...validateHumanity(message, { maxChars: CONVERSATION_REPLY_MAX_CHARS }),
    // mid-conversation must never restart/re-introduce (rule enforced, not just prompted)
    ...findRestartPhrases(message),
    ...findUngroundedClaims(message, block),
  ];
}

/**
 * Draft the seller's next message in an ongoing LinkedIn conversation — a contextual REPLY (when
 * `incoming` is set) or a PROACTIVE follow-up (when it isn't). Reuses the outreach grounding
 * (leadBlock) + humanizer (generate → validate → one bounded regenerate) so every message speaks
 * with the same voice and anti-hallucination guardrails as the first touch — the "use the same logic
 * as outreach to converse until close" contract, applied to both replies AND scripted follow-ups so
 * neither reads like a cold first message.
 */
export async function draftConversationMessage(
  input: ConversationMessageInput,
  model: LanguageModel = getModel()
): Promise<ConversationDraft> {
  const block = leadBlock({ lead: input.lead, insights: input.insights, context: input.context });
  const situation = input.incoming
    ? [
        `The prospect just replied (classified: ${input.classification ?? "neutral"}):`,
        input.incoming.slice(0, 2000),
        ``,
        `Write your next message answering them.`,
      ]
    : [
        `The prospect hasn't replied to your last message yet.`,
        `Write a short, natural follow-up that builds on the thread above — a new angle or light nudge, never a repeat or a re-introduction.`,
      ];
  const prompt = [block, ``, `Conversation so far:`, renderThread(input.thread), ``, ...situation].join("\n");

  const { output, violations } = await generateHumanized(
    async (fixNote) =>
      (
        await generateObject({
          model,
          schema: conversationReplySchema,
          system: RESPOND_SYSTEM,
          prompt: fixNote ? `${prompt}\n\n${fixNote}` : prompt,
          maxOutputTokens: 300,
        })
      ).object,
    (draft) => validateConversationMessage(draft.message, block)
  );

  return { message: output.message, violations };
}
