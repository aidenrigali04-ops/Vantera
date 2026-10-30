import { generateObject, type LanguageModel } from "ai";
import { z } from "zod";
import { getModel, registerPrompt } from "@vantera/ai";
import type { ConversationTurn } from "../../reply/respond";
import { renderThread } from "../../reply/respond";
import type { Phase } from "../state";
import type { Persona } from "./personas";

export type Disposition = "unchanged" | "warmer" | "colder";
export type SimReply = { text: string | null; disposition: Disposition };

/** The thread as the simulated prospect sees it, plus the phase of the agent's stage (drives the reply roll). */
export type ProspectView = { turns: ConversationTurn[]; phase: Phase };

const HARD_CTA = /\b(calendar|meeting|demo|call)\b|hop on|quick chat|calendly|cal\.com|\b(book|schedule) (a|an|some|the)\b|\b\d+[- ]?min(ute)?s?\b/i;
export const hasHardCta = (text: string): boolean => HARD_CTA.test(text);

export const PROSPECT_SYSTEM = registerPrompt("conversation/sim-prospect", `You role-play a LinkedIn prospect receiving a message from a salesperson. Stay in persona at all times.

Rules:
- Your disposition changes ONLY on substance: a specific, checkable fact about your situation, a direct answer to your question, or an easy exit offered. Tone, flattery, enthusiasm and polish never move you. A warm but empty message leaves you unchanged.
- Respond in at most 2 sentences, in your persona's register (formality, directness, emoji use, typical message length).
- You are a person, not an assistant: you never explain your reasoning and never mention being simulated.
- Output the reply text and your disposition after reading the message: "warmer" only if the message gave you substance, "colder" if it was pushy, vague, repetitive, or ignored your question, otherwise "unchanged".`);

const replySchema = z.object({
  text: z.string().min(1).max(400),
  disposition: z.enum(["unchanged", "warmer", "colder"]),
});

const OPT_OUT_LINE = "Please stop messaging me.";

/**
 * Simulate the prospect's reply to `agentMessage`. The reply roll comes FIRST and is deterministic on
 * the injected rng: silence never reaches the model.
 */
export async function simulateProspectReply(
  persona: Persona,
  thread: ProspectView,
  agentMessage: string,
  rng: () => number,
  model: LanguageModel = getModel(),
): Promise<SimReply> {
  const priorLeadReplies = thread.turns.filter((t) => t.role === "lead").length;
  // the rude persona gives one curt line, then opts out of any further message (no roll: it always answers)
  if (persona.id === "rude" && priorLeadReplies >= 1) return { text: OPT_OUT_LINE, disposition: "colder" };

  let p = persona.disposition.replyProbByPhase[thread.phase];
  if (hasHardCta(agentMessage)) p *= 1 - persona.disposition.hardCtaPenalty;
  if (!(rng() < p)) return { text: null, disposition: "unchanged" };

  const r = persona.register;
  const { object } = await generateObject({
    model,
    schema: replySchema,
    system: PROSPECT_SYSTEM.text,
    prompt: [
      `Persona: ${persona.title} (${persona.seniority}). ${persona.behavior}`,
      `Register: ${r.formality}, ${r.directness} directness, ${r.emoji ? "uses emoji" : "no emoji"}, about ${r.avgWords} words per message.`,
      persona.disposition.refuses.length ? `You refuse or ignore: ${persona.disposition.refuses.join("; ")}.` : "",
      `Conversation so far:\n${renderThread(thread.turns)}`,
      `The seller just wrote:\n${agentMessage.slice(0, 1500)}`,
      `Write your reply.`,
    ]
      .filter(Boolean)
      .join("\n\n"),
    maxOutputTokens: 200,
  });
  return { text: object.text, disposition: object.disposition };
}
