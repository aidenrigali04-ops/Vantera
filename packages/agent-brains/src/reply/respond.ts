import { generateObject, type LanguageModel } from "ai";
import { z } from "zod";
import { getModel, registerPrompt } from "@vantera/ai";
import type { StoredInsights } from "../prospect/schema";
import {
  validateHumanity,
  findUngroundedClaims,
  findRestartPhrases,
  findActionClaims,
  findUnapprovedLinks,
  findSpeculativeClaims,
  findParrotOpener,
  normalizeDashes,
  type Violation,
} from "../copy/humanizer";
import { avoidBlock, generateHumanized, leadBlock, strategyDirectives, PROSPECT_ACCURACY_RULE, VOICE_RULES, type CopyContext, type CopyLead } from "../copy/shared";
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

/** One LinkedIn DM. Short by design — long DMs read like a pitch and get ignored. Unlike the FIRST
 *  touch (a hook, capped hard at 180), a mid-conversation reply often has to answer a real, multi-part
 *  question, so the ceiling is roomier and brevity is steered by the prompt ("aim under 140, a rapport
 *  reply is one line"). 350 → 220 (2026-07-10) proved too tight: a live sim flagged every good
 *  substantive answer to review. The model naturally lands ~280–310 chars on a real multi-part
 *  answer, so 320 clears good copy while still catching a genuine wall of text. Cap = wall, prompt = aim. */
export const CONVERSATION_REPLY_MAX_CHARS = 320;
// Word cap is a backstop against char-packing, not the primary gate (the char cap is). Sims showed
// 55 false-flagged clean ~300-char answers; 60 lets a real multi-part reply through while the char
// cap still catches genuine walls of text.
export const CONVERSATION_REPLY_MAX_WORDS = 60;

export const conversationReplySchema = z.object({
  message: z.string().max(600),
});

// The "converse to close" system prompt. Same voice + anti-pitch discipline as the outreach copy
// brain (copy/linkedin), but conversational: it must FOLLOW the thread — never restart it or repeat
// what's already been said. It reads what the prospect actually said and matches it; the CTA is the
// eventual destination, NOT something every message pushes toward. Grounding + humanizer shared.
// Exported (not just module-local) so the jobs pipeline can stamp SendRecipe.promptHash with the
// EXACT registry hash of the prompt that drafted a conversation reply or proactive follow-up — it
// imports this handle rather than re-registering, so the two can never drift (recipe.ts v2, WS-3.4).
export const RESPOND_SYSTEM = registerPrompt("reply/respond", `You are the seller, continuing a 1:1 LinkedIn conversation you already started. Write ONLY your next message, the raw DM text, nothing else.

You are mid-conversation, NOT introducing yourself. The thread so far is given; build on it. NEVER restart, NEVER re-introduce yourself ("Wanted to connect", "Saw you reacted to…"), NEVER repeat a point you already made.

Reply mode (the prospect just sent a message): FIRST read what they actually said, and match it. The CTA goal is where the conversation should EVENTUALLY go, not something every message pushes toward. Not every message should sell; sometimes the right move is simply a reply that fits the moment. Pick the response the conversation is actually asking for:
- Small talk or rapport ("how's it going?", a joke, a personal aside, "happy Friday"): just reply like a person would. Warm, brief, genuine. No pitch, no ask, no steering it back to business. Pivoting small talk into a sales point is the fastest way to read like a bot and lose them.
- A question: answer the ONE thing they most need to know, in plain terms. If they asked several things, answer the most important one and let the rest come in your next message. Add a next step only when it's the natural thing to say, never as a reflex.
- Hesitation or an objection: address it honestly, no pressure and no counter-pitch. Acknowledging their point and leaving the door open is often the whole message.
- A clear buying signal (they said yes, or asked about a call, pricing, or next steps): move to the concrete next step, offer the booking link if the block has one, or propose the specific step. Do NOT re-explain or re-pitch what you already said, that reads as if you didn't hear their yes.
- Neutral or ambiguous: keep it going with real interest in them. Advance toward the CTA only when it genuinely fits what they just said.
Never answer a question with a meeting ask, and never lead with a pain point when the moment doesn't call for it. Say ONE thing per message and stop, a conversation is a back-and-forth, not a briefing. Cramming several points, or answering every part of a multi-part question at once, is exactly how you sound like a bot instead of a person.
Follow-up mode (the prospect hasn't replied yet): CONTINUE the conversation your last message started. Write as the same person picking the thread back up, presuming they read it. Give them something worth their attention, a specific detail, a sharp example, or (if the block lists supporting content) one relevant link, rather than an empty "just checking in". Do not guilt-trip ("just following up", "circling back"), do not re-state your offer from scratch, and never repeat a hook you already used in the thread.

Closing the loop: match the destination to what THEY want (each at most once per thread; check the thread first, never unprompted, never with pressure):
- They want to TALK (said yes, asked about a call or pricing) and the block has a booking link: offer it casually, like "happy to walk you through it, grab any time here: <link>".
- They want to SEE or LEARN (asked what it looks like, for examples, for more detail) and the block has a website link: share it as the easiest way to look, like "easiest is to just see it: <link>".
- Both fit? Pick the one matching their exact words; never send two links in one message. If the block has neither, keep answering in the thread.

Rules for every message:
- WRITE IN THE PROSPECT'S LANGUAGE: whatever language their most recent message used, you use. If they haven't written yet, match the language your own last message used.
- KEEP IT SHORT: one or two sentences, often less. Answer the main thing and stop. A rapport or banter reply is a single line, match their energy but never out-talk them. Aim under 140 characters, hard cap ${CONVERSATION_REPLY_MAX_CHARS} (about ${CONVERSATION_REPLY_MAX_WORDS} words). A reply that runs long gets skimmed, not read.
- Don't open a business reply with an acknowledgment preamble ("Fair enough/point/catch", "Fair to say", "Fair to call that out", "Totally fair", "Honestly", "Great/Good question", "You're right to ask", "I hear you", "Makes sense"). Skip the throat-clearing and just say the thing. A quick "ha, fair" inside real banter is fine; it's the reflexive business-reply preamble that reads like a bot.
- Cut every word that isn't pulling weight. If a phrase is there to sound clever or warm rather than to say something, delete it.
- Ground every claim in the facts block. Never invent a metric, customer, feature, or outcome.
- Don't drop a bare number or percentage into a casual reply ("100% me", "40% chance", "1000% agree"). Even colloquially it reads as a claim. Say it in words instead.
- NEVER claim to have done something outside this conversation (joined a group, signed up, watched, downloaded). Sending messages is the only thing you do. Acknowledging or declining warmly is fine; fake participation is not.
- Soft asks only. The ONLY links allowed are the booking link, the website link, and the block's supporting content. No other URLs, no meeting ultimatums.
- Name the seller ONLY by the "Seller company" value in the block.

${PROSPECT_ACCURACY_RULE}

${VOICE_RULES}`);

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
  allowedLinks: string[] = [],
  incoming?: string
): Violation[] {
  return [
    ...validateHumanity(message, { maxChars: CONVERSATION_REPLY_MAX_CHARS, maxWords: CONVERSATION_REPLY_MAX_WORDS }),
    // mid-conversation must never restart/re-introduce (rule enforced, not just prompted)
    ...findRestartPhrases(message),
    ...findUngroundedClaims(message, block),
    // never-hallucinate: no mind-reading the prospect's unstated state ("you're probably swamped")
    ...findSpeculativeClaims(message),
    // anti-slop: no reflexive opener that restates their own message back to them
    ...findParrotOpener(message, incoming),
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
  // Optional experiment strategy (self-optimizing loop, Phase 3): appended right after the lead
  // block, same placement as the outreach copy brain (copy/linkedin.ts). Empty/absent strategy ⇒
  // strategyDirectives returns "" ⇒ this prompt is byte-identical to before conversation drafting
  // became strategy-aware. The "conversation" shape suppresses the first-touch-only opener knobs
  // (openWith/openerAngle) — mid-thread those directives contradict the anti-restart rule above.
  // The recipe stamps on the resulting sends still record the arm's FULL strategy (arm identity
  // for attribution), not the subset of lines that rendered here.
  const strategyBlock = strategyDirectives(input.context.strategy, "conversation");
  const avoid = avoidBlock(input.context.avoidPhrases);
  const prompt = [
    block,
    ...(strategyBlock ? [``, strategyBlock] : []),
    ``,
    `Conversation so far:`,
    renderThread(input.thread),
    ``,
    ...situation,
    ...(avoid ? [``, avoid] : []),
  ].join("\n");
  const allowed = allowedConversationLinks(input.context);

  const { output, violations } = await generateHumanized(
    async (fixNote) => {
      const obj = (
        await generateObject({
          model,
          schema: conversationReplySchema,
          system: RESPOND_SYSTEM.text,
          prompt: fixNote ? `${prompt}\n\n${fixNote}` : prompt,
          maxOutputTokens: 300,
        })
      ).object;
      // Deterministically fix stray em-dashes before linting, so a good reply isn't parked in
      // review over the one punctuation slip the model reliably makes.
      return { message: normalizeDashes(obj.message) };
    },
    (draft) => validateConversationMessage(draft.message, block, allowed, input.incoming)
  );

  return { message: output.message, violations };
}
