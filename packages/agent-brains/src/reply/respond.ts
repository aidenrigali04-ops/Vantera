import { generateObject, type LanguageModel } from "ai";
import { z } from "zod";
import { getModel } from "@vantera/ai";
import type { StoredInsights } from "../prospect/schema";
import {
  validateHumanity,
  findUngroundedClaims,
  findRestartPhrases,
  findActionClaims,
  findUnapprovedLinks,
  type Violation,
} from "../copy/humanizer";
import { avoidBlock, generateHumanized, leadBlock, VOICE_RULES, type CopyContext, type CopyLead } from "../copy/shared";
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

/** One LinkedIn DM. Short by design — long DMs read like a pitch and get ignored
 *  (350 → 300 on 2026-07-08: the prompt aims under 200, this is the enforcement ceiling). */
export const CONVERSATION_REPLY_MAX_CHARS = 300;

export const conversationReplySchema = z.object({
  message: z.string().max(600),
});

// The "converse to close" system prompt. Same voice + anti-pitch discipline as the outreach copy
// brain (copy/linkedin), but conversational: it must FOLLOW the thread — never restart it or repeat
// what's already been said — and move ONE step toward the CTA. Grounding + humanizer linting shared.
const RESPOND_SYSTEM = `You are the seller, continuing a 1:1 LinkedIn conversation you already started. Write ONLY your next message, the raw DM text, nothing else.

You are mid-conversation, NOT introducing yourself. The thread so far is given; build on it. NEVER restart, NEVER re-introduce yourself ("Wanted to connect", "Saw you reacted to…"), NEVER repeat a point you already made.

Reply mode (the prospect just sent a message): directly address what they actually said. Answer their question FULLY, acknowledge their point or objection, then move ONE step toward the CTA goal. If they asked for detail, give the detail; don't answer a question with a meeting ask.
Follow-up mode (the prospect hasn't replied yet): CONTINUE the conversation your last message started. Write as the same person picking the thread back up, presuming they read it. Every follow-up must ADD one new concrete element the thread hasn't had yet: a specific detail, a sharp example, or (if the block lists supporting content) one relevant link. A content-free nudge is worse than silence. Do not guilt-trip ("just following up", "circling back"), do not re-state your offer from scratch, and never repeat a hook you already used in the thread.

Closing the loop: match the destination to what THEY want (each at most once per thread; check the thread first, never unprompted, never with pressure):
- They want to TALK (said yes, asked about a call or pricing) and the block has a booking link: offer it casually, like "happy to walk you through it, grab any time here: <link>".
- They want to SEE or LEARN (asked what it looks like, for examples, for more detail) and the block has a website link: share it as the easiest way to look, like "easiest is to just see it: <link>".
- Both fit? Pick the one matching their exact words; never send two links in one message. If the block has neither, keep answering in the thread.

Rules for every message:
- WRITE IN THE PROSPECT'S LANGUAGE: whatever language their most recent message used, you use. If they haven't written yet, match the language your own last message used.
- KEEP IT SHORT: 1 to 2 sentences, aim under 200 characters (hard cap ${CONVERSATION_REPLY_MAX_CHARS}).
- Ground every claim in the facts block. Never invent a metric, customer, feature, or outcome.
- NEVER claim to have done something outside this conversation (joined a group, signed up, watched, downloaded). Sending messages is the only thing you do. Acknowledging or declining warmly is fine; fake participation is not.
- Soft asks only. The ONLY links allowed are the booking link, the website link, and the block's supporting content. No other URLs, no meeting ultimatums.
- Name the seller ONLY by the "Seller company" value in the block.

${VOICE_RULES}`;

export function renderThread(thread: ConversationTurn[]): string {
  if (thread.length === 0) return "(no earlier messages yet)";
  return thread.map((t) => `${t.role === "agent" ? "You" : "Prospect"}: ${t.text}`).join("\n");
}

/** URLs a conversation message may contain: the seller's interest destinations (booking +
 *  website) and their content links. Nothing else, ever. */
export function allowedConversationLinks(context: CopyContext): string[] {
  return [context.bookingUrl ?? "", context.websiteUrl ?? "", ...(context.contentLinks ?? [])].filter(
    (u) => /^https?:\/\//i.test(u)
  );
}

/** The full mid-conversation ruleset — shared with the fix pass so a "fixed" message is held to
 *  the exact bar that flagged the original (humanity + no-restart + grounded claims + no fake
 *  actions + whitelisted links only). */
export function validateConversationMessage(
  message: string,
  block: string,
  allowedLinks: string[] = []
): Violation[] {
  return [
    ...validateHumanity(message, { maxChars: CONVERSATION_REPLY_MAX_CHARS }),
    // mid-conversation must never restart/re-introduce (rule enforced, not just prompted)
    ...findRestartPhrases(message),
    ...findUngroundedClaims(message, block),
    // the agent can only send messages — claiming to have joined/signed up is fabrication
    ...findActionClaims(message),
    // only the booking link + supporting content may ever be linked
    ...findUnapprovedLinks(message, allowedLinks),
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
        `Write a short, natural follow-up that CONTINUES the thread above: pick up from your own last message (deepen its angle, add one concrete detail, or ask the question it implied). Assume they read it. Never a repeat, never a re-introduction, never a fresh pitch that ignores what you already said.`,
      ];
  const avoid = avoidBlock(input.context.avoidPhrases);
  const prompt = [block, ``, `Conversation so far:`, renderThread(input.thread), ``, ...situation, ...(avoid ? [``, avoid] : [])].join("\n");
  const allowed = allowedConversationLinks(input.context);

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
    (draft) => validateConversationMessage(draft.message, block, allowed)
  );

  return { message: output.message, violations };
}
