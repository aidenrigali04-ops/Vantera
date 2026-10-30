import { generateObject, type LanguageModel } from "ai";
import { getModel, registerPrompt } from "@vantera/ai";
import type { StoredInsights } from "../prospect/schema";
import { normalizeDashes } from "../copy/humanizer";
import { generateHumanized, leadBlock, PROSPECT_ACCURACY_RULE, VOICE_RULES, type CopyContext, type CopyLead } from "../copy/shared";
import {
  allowedConversationLinks,
  conversationReplySchema,
  renderThread,
  validateConversationMessage,
  CONVERSATION_REPLY_MAX_CHARS,
  CONVERSATION_REPLY_MAX_WORDS,
  type ConversationDraft,
  type ConversationTurn,
} from "../reply/respond";
import { lintForMove } from "./lint";
import { LENGTH_BAND_CHARS, MOVE_DEFINITIONS, type LinkKind, type MoveDecision } from "./moves";
import type { ConversationState } from "./state";

/**
 * The move-bound composer (spec §7.1). The policy has already chosen WHAT to do; this writes exactly
 * that one move, in the voice rules and grounding shared with the rest of the copy stack. There is no
 * situation-branching here and no experiment strategy: the move is the strategy.
 */
export const COMPOSE_SYSTEM = registerPrompt("conversation/compose", `You are the seller, continuing a 1:1 LinkedIn conversation you already started. Write ONLY your next message, the raw DM text, nothing else.

You are given ONE move to make, with its style. Write exactly that move: do not drift into a different one, do not combine it with another, and do not add a pitch, an ask or a question the move does not call for. You are mid-conversation, NOT introducing yourself: NEVER restart, NEVER re-introduce yourself, NEVER repeat a point, question, claim, hook or link you already used (the "Already said" list in the brief is a do-not-say list).

Rules for every message:
- WRITE IN THE PROSPECT'S LANGUAGE: whatever language their most recent message used, you use. If they haven't written yet, match the language your own last message used.
- KEEP IT SHORT: stay inside the length band given in the brief (hard cap ${CONVERSATION_REPLY_MAX_CHARS} characters, about ${CONVERSATION_REPLY_MAX_WORDS} words). Answer the main thing and stop. Say ONE thing per message.
- Lead with the substance. Don't open by restating their point back to them or with reflexive validation.
- Never hallucinate the prospect: never tell them how they feel, what they're dealing with, or why, unless they said it. You know only what's in the facts block and what they actually typed.
- Cut every word that isn't pulling weight.
- Ground every claim in the facts block. Never invent a metric, customer, feature, or outcome. Don't drop a bare number or percentage into a casual reply.
- NEVER claim to have done something outside this conversation (joined a group, signed up, watched, downloaded). Sending messages is the only thing you do.
- Soft asks only. The ONLY links allowed are the ones the brief names, and only when it names one. No other URLs, no meeting ultimatums.
- Name the seller ONLY by the "Seller company" value in the block.
- Talk about them, not us: at most one "we" and two "I", and address the reader as "you".

${PROSPECT_ACCURACY_RULE}

${VOICE_RULES}`);

export type ComposeInput = {
  lead: CopyLead;
  insights: StoredInsights;
  context: CopyContext;
  state: ConversationState;
  thread: ConversationTurn[];
  incoming?: string;
  decision: Pick<MoveDecision, "move" | "style" | "rationale">;
  avoidSkeletons?: string[];
  sellerName: string | null;
};

const BAND_LABEL = { one_line: "one line", short: "short", standard: "standard" } as const;
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

function linkLine(kind: LinkKind, context?: CopyContext): string {
  if (kind === "none") return "Do not include any link.";
  if (kind === "booking") return `You may include this booking link once: ${context?.bookingUrl ?? "(none available)"}`;
  if (kind === "website") return `You may include this website link once: ${context?.websiteUrl ?? "(none available)"}`;
  return `You may include one of these content links once: ${(context?.contentLinks ?? []).join(", ") || "(none available)"}`;
}

/** The move, its constraints, and (when mirroring) the prospect's register. Deterministic text. */
export function renderMoveBrief(decision: Pick<MoveDecision, "move" | "style" | "rationale">, state: ConversationState, context?: CopyContext): string {
  const { move, style, rationale } = decision;
  const lines = [
    `Your move: ${move}. ${MOVE_DEFINITIONS[move]}`,
    `Why this move: ${rationale}`,
    `Length: ${BAND_LABEL[style.lengthBand]}, at most ${LENGTH_BAND_CHARS[style.lengthBand]} characters.`,
    style.question ? "You may end with exactly one question." : "Do not ask a question.",
    linkLine(style.link, context),
  ];
  if (style.mirror) {
    const r = state.person.register;
    const bits = [
      r.greeting ? `they greet with "${r.greeting}"` : null,
      r.signoff ? `they sign off with "${r.signoff}"` : null,
      `emoji ${r.emoji ? "is" : "is not"} natural for them`,
      r.avgSentenceWords ? `their sentences average about ${Math.round(r.avgSentenceWords)} words` : null,
    ].filter(Boolean);
    lines.push(`Match their register: ${bits.join("; ")}. Write in the prospect's language (${r.language}).`);
  }
  return lines.join("\n");
}

function alreadySaid(state: ConversationState): string {
  const m = state.memory;
  const lines = [
    m.hooksUsed.length ? `Hooks already used: ${m.hooksUsed.slice(-8).map((h) => clip(h.text, 80)).join(" | ")}` : null,
    m.questionsAsked.length
      ? `Questions already asked: ${m.questionsAsked.slice(-5).map((q) => `${q.answered ? "[answered]" : "[still open]"} ${clip(q.text, 80)}`).join(" | ")}`
      : null,
    m.claimsMade.length ? `Claims already made: ${m.claimsMade.slice(-5).map((c) => clip(c, 80)).join(" | ")}` : null,
    `Links already shared: booking ${m.linksShared.booking}, website ${m.linksShared.website}, content ${m.linksShared.content}`,
    m.openLoops.length ? `Still owed to them: ${m.openLoops.slice(0, 3).map((o) => clip(o, 80)).join("; ")}` : null,
  ].filter(Boolean);
  return ["Already said / asked / claimed / linked (never repeat):", ...lines].join("\n");
}

function linkKindsFor(context: CopyContext): { links: string[]; kinds: LinkKind[] } {
  const pairs: [string, LinkKind][] = [
    [context.bookingUrl ?? "", "booking"],
    [context.websiteUrl ?? "", "website"],
    ...(context.contentLinks ?? []).map((u): [string, LinkKind] => [u, "content"]),
  ];
  const ok = pairs.filter(([u]) => /^https?:\/\//i.test(u));
  return { links: ok.map(([u]) => u), kinds: ok.map(([, k]) => k) };
}

/** Write exactly the chosen move. `wait` and `hand_to_human` are decisions, never messages. */
export async function composeMessage(input: ComposeInput, model: LanguageModel = getModel()): Promise<ConversationDraft> {
  const { move } = input.decision;
  if (move === "wait" || move === "hand_to_human") throw new Error(`move is not composable: ${move}`);

  const block = leadBlock({ lead: input.lead, insights: input.insights, context: input.context });
  const prompt = [
    block,
    ``,
    renderMoveBrief(input.decision, input.state, input.context),
    ``,
    alreadySaid(input.state),
    ``,
    `Conversation so far:`,
    renderThread(input.thread),
    ...(input.incoming ? [``, `The prospect just wrote:`, input.incoming.slice(0, 2000)] : []),
    ``,
    `Now write only the message text.`,
  ].join("\n");

  const allowed = allowedConversationLinks(input.context);
  const { links, kinds } = linkKindsFor(input.context);
  const identity = [input.lead.firstName, input.lead.lastName, input.lead.companyName].filter(Boolean).join(" ");

  const { output, violations } = await generateHumanized(
    async (fixNote) => {
      const obj = (
        await generateObject({
          model,
          schema: conversationReplySchema,
          system: COMPOSE_SYSTEM.text,
          prompt: fixNote ? `${prompt}\n\n${fixNote}` : prompt,
          maxOutputTokens: 300,
        })
      ).object;
      return { message: normalizeDashes(obj.message) };
    },
    (draft) => [
      ...validateConversationMessage(draft.message, block, allowed, input.incoming),
      ...lintForMove(draft.message, {
        move,
        style: input.decision.style,
        state: input.state,
        sellerName: input.sellerName,
        identity,
        avoidSkeletons: input.avoidSkeletons ?? [],
        allowedLinks: links,
        linkKinds: kinds,
      }),
    ],
  );
  return { message: output.message, violations };
}
