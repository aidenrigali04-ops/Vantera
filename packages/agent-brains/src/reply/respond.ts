import { generateObject, type LanguageModel } from "ai";
import { z } from "zod";
import { getModel } from "@vantera/ai";
import type { StoredInsights } from "../prospect/schema";
import { validateHumanity, findUngroundedClaims, type Violation } from "../copy/humanizer";
import { generateHumanized, leadBlock, type CopyContext, type CopyLead } from "../copy/shared";
import type { ReplyVerdict } from "./classify";

/** One message in the running 1:1 thread, oldest first. */
export interface ConversationTurn {
  role: "agent" | "lead";
  text: string;
}

export interface ConversationReplyInput {
  lead: CopyLead;
  insights: StoredInsights;
  /** Same grounding the outreach copy used — CTA, value prop, seller identity, guardrails. */
  context: CopyContext;
  /** Prior messages (excludes the incoming one being answered), oldest first. */
  thread: ConversationTurn[];
  /** The prospect's latest message — the one this reply answers. */
  incoming: string;
  /** How the incoming message was classified (interested / neutral / other). */
  classification: ReplyVerdict["classification"];
}

export interface ConversationReply {
  message: string;
  /** unresolved humanizer / grounding violations — route to review, never silent-send (rule 06/11) */
  violations: Violation[];
}

/** One LinkedIn DM. Cap mirrors the outreach follow-up so a reviewed reply is sent verbatim. */
export const CONVERSATION_REPLY_MAX_CHARS = 500;

export const conversationReplySchema = z.object({
  message: z.string().max(600),
});

// The "converse to close" system prompt. Same voice + anti-pitch discipline as the outreach copy
// brain (copy/linkedin), but reactive: it must answer what the prospect actually said and move ONE
// step toward the CTA, never dump the pitch. Grounding + humanizer linting are shared with outreach.
const RESPOND_SYSTEM = `You are the seller, continuing a 1:1 LinkedIn conversation you started. The prospect just replied; write ONLY the seller's next message.

- Directly address what they actually said — answer their question, acknowledge their point or objection. Never ignore it to pivot to a pitch.
- Move the conversation exactly ONE concrete step toward the CTA goal. Don't dump the whole pitch; earn the next reply.
- Ground every claim in the facts block — never invent a metric, customer, feature, or outcome that isn't there.
- If they objected, address it honestly and briefly. If they showed interest, make the CTA easy to say yes to (offer, don't demand; no calendar links).
- Conversational chat register: no "Dear", no "Best regards", no signature, no buzzwords ("game-changer", "seamless"), no generic flattery, at most one em-dash, at most one exclamation mark, minimal hedging.
- Under ${CONVERSATION_REPLY_MAX_CHARS} characters. One message only, no subject line. Name the seller ONLY by the "Seller company" value in the block.`;

function renderThread(thread: ConversationTurn[]): string {
  if (thread.length === 0) return "(no earlier messages)";
  return thread.map((t) => `${t.role === "agent" ? "You" : "Prospect"}: ${t.text}`).join("\n");
}

/**
 * Draft the seller's next message in an ongoing LinkedIn conversation. Reuses the outreach grounding
 * (leadBlock) + humanizer (generateHumanized → validate → one bounded regenerate) so the reply speaks
 * with the same voice and the same anti-hallucination guardrails as the first-touch copy — the
 * "use the same logic as outreach to converse until close" contract.
 */
export async function draftConversationReply(
  input: ConversationReplyInput,
  model: LanguageModel = getModel()
): Promise<ConversationReply> {
  const block = leadBlock({ lead: input.lead, insights: input.insights, context: input.context });
  const prompt = [
    block,
    ``,
    `Conversation so far:`,
    renderThread(input.thread),
    ``,
    `The prospect just said (classified: ${input.classification}):`,
    input.incoming.slice(0, 2000),
    ``,
    `Write your next message.`,
  ].join("\n");

  const { output, violations } = await generateHumanized(
    async (fixNote) =>
      (
        await generateObject({
          model,
          schema: conversationReplySchema,
          system: RESPOND_SYSTEM,
          prompt: fixNote ? `${prompt}\n\n${fixNote}` : prompt,
          maxOutputTokens: 400,
        })
      ).object,
    (draft) => [
      ...validateHumanity(draft.message, { maxChars: CONVERSATION_REPLY_MAX_CHARS }),
      ...findUngroundedClaims(draft.message, block),
    ]
  );

  return { message: output.message, violations };
}
