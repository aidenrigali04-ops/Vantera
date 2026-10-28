import { generateObject, type LanguageModel } from "ai";
import { z } from "zod";
import { getModel, registerPrompt } from "@vantera/ai";
import { preClassify } from "../reply/classify";
import { deriveStage, renderState, type ConversationState, type StoredTurn } from "./state";

const trait = z.object({ value: z.number().min(0).max(1), confidence: z.number().min(0).max(1) }).nullable();
const TRAITS = ["directness", "formality", "warmth", "skepticism", "verbosity"] as const;
const OBJECTION_KINDS = ["dismissive", "situational", "existing_solution", "info_request", "what_is_this", "not_now", "wrong_person"] as const;
const LINK_KINDS = ["booking", "website", "content"] as const;
export type LinkKind = (typeof LINK_KINDS)[number];

export const readoutSchema = z.object({
  stance: z.enum(["positive", "neutral", "skeptical", "negative", "opt_out"]),
  confidence: z.number().min(0).max(1),
  intent: z.enum([
    "answers_question", "asks_question", "small_talk", "states_problem", "objects", "requests_info",
    "agrees_next_step", "declines", "opts_out", "ooo", "sells_to_us", "other",
  ]),
  explicitOptOut: z.boolean(),
  identitySuspicion: z.boolean(),
  booked: z.boolean(),
  answeredQuestionRef: z.string().nullable(),
  newProblems: z.array(z.string().max(200)).max(4),
  newPriorities: z.array(z.string().max(200)).max(4),
  newObjection: z.object({ kind: z.enum(OBJECTION_KINDS), text: z.string().max(200) }).nullable(),
  personDelta: z.object({
    directness: trait,
    formality: trait,
    warmth: trait,
    skepticism: trait,
    verbosity: trait,
    seniority: z.enum(["ic", "manager", "director", "vp", "cxo", "founder", "unknown"]).nullable(),
    role: z.enum(["buyer", "influencer", "seller_to_us", "gatekeeper", "recruiter", "unknown"]).nullable(),
    roleConfidence: z.number().min(0).max(1).nullable(),
    language: z.string().nullable(),
    emoji: z.boolean().nullable(),
    notes: z.array(z.string().max(120)).max(3),
  }),
  // seller-side fields (what a message WE sent used, asked, claimed, linked)
  hookUsed: z.object({ kind: z.enum(["trigger", "pain", "observation", "proof", "reframe"]), text: z.string().max(200) }).nullable(),
  questionAsked: z.string().max(240).nullable(),
  claims: z.array(z.string().max(200)).max(6),
  linksShared: z.array(z.enum(LINK_KINDS)).max(3),
  ask: z.enum(["none", "soft", "hard"]),
  labeled: z.boolean(),
});
export type Readout = z.infer<typeof readoutSchema>;

export const READ_SYSTEM = registerPrompt("conversation/read", `You read ONE message in a 1:1 LinkedIn conversation and return a structured readout. You do not write replies.

You are given the compact conversation state, the seller's grounding facts, and the message with its author (lead, agent, or human). Messages may be in any language and may be a single emoji; read them as they are.

For a LEAD message, fill in:
- stance and confidence: positive, neutral, skeptical, negative, or opt_out. A short or terse answer is not negative. Never infer a decline from brevity: "I dont." answering a question is an answer, not a no. Emoji-only is small_talk with a neutral stance.
- intent: the single best fit of answers_question, asks_question, small_talk, states_problem, objects, requests_info, agrees_next_step, declines, opts_out, ooo, sells_to_us, other. A business-development or agency person describing services they sell is sells_to_us.
- explicitOptOut: only an explicit request to stop contact. identitySuspicion: only on explicit wording such as "bot", "automated", "AI", "is this a real person". booked: only on a confirmed specific time, never on interest or "let's find a time".
- answeredQuestionRef: the ref of the question we asked that this message answers, else null.
- newProblems, newPriorities, newObjection: only what they actually said, in their words, briefly.
- personDelta: traits (directness, formality, warmth, skepticism, verbosity as 0..1 with a confidence) only from how they write, tentative and low confidence from one message; null when unsure. Add language, emoji use, a short note, and role/seniority only when the message shows it.
- Leave hookUsed null, questionAsked null, claims and linksShared empty, ask none, labeled false.

For an AGENT or HUMAN (seller) message, record what this message used, asked, claimed, and linked:
- hookUsed: the angle it opened with (trigger, pain, observation, proof, reframe) or null.
- questionAsked: the one question it asks, or null. claims: factual claims it makes. linksShared: which of booking, website, content it linked. ask: none, soft, or hard. labeled: true if it reflects the lead's feelings back.
- Set stance neutral, intent other, all lead-side fields to their empty values.

Never invent facts. Use only the state, the grounding, and the message.`);

export const isSellerTurn = (turn: StoredTurn): boolean => turn.role === "agent" || turn.role === "human";

export async function readTurn(
  state: ConversationState,
  turn: StoredTurn,
  grounding: string,
  model: LanguageModel = getModel(),
): Promise<Readout> {
  const { object } = await generateObject({
    model,
    schema: readoutSchema,
    system: READ_SYSTEM.text,
    prompt: [renderState(state), "Grounding:", grounding, "Turn:", `${turn.role} (ref ${turn.ref}):`, turn.text.slice(0, 2000)].join("\n"),
    maxOutputTokens: 600,
  });
  if (!isSellerTurn(turn) && preClassify(turn.text)?.classification === "unsubscribe") {
    return { ...object, explicitOptOut: true, stance: "opt_out", intent: "opts_out" };
  }
  return object;
}

const iso = (x: string) => new Date(x).toISOString();
const dedupeCap = (xs: string[], cap: number) => [...new Set(xs)].slice(-cap);

function mergeTrait(cur: ConversationState["person"]["directness"], d: { value: number; confidence: number } | null) {
  if (!d || d.confidence <= 0) return cur;
  if (!cur) return { value: d.value, confidence: Math.min(1, d.confidence) };
  const total = cur.confidence + d.confidence;
  if (total <= 0) return cur;
  return {
    value: (cur.value * cur.confidence + d.value * d.confidence) / total,
    confidence: Math.min(1, cur.confidence + d.confidence * (1 - cur.confidence)),
  };
}

/** Pure reducer: folds one read turn into the state. Stage is re-derived, never set by the model. */
export function applyReadout(state: ConversationState, turn: StoredTurn, readout: Readout): ConversationState {
  const s: ConversationState = structuredClone(state);
  const at = iso(turn.at);

  if (isSellerTurn(turn)) {
    s.lastAgentMessageAt = at;
    s.counters.agentTurnsSinceLastLead += 1;
    if (turn.role === "agent") s.counters.agentTurns += 1;
    if (readout.hookUsed) s.memory.hooksUsed.push({ ...readout.hookUsed, messageRef: turn.ref });
    if (readout.questionAsked) {
      s.memory.questionsAsked.push({ text: readout.questionAsked, answered: false, messageRef: turn.ref });
      s.counters.questionsBudgetUsed += 1;
    }
    s.memory.claimsMade = [...new Set([...s.memory.claimsMade, ...readout.claims])];
    for (const k of readout.linksShared) s.memory.linksShared[k] += 1;
    if (readout.ask === "soft" || readout.ask === "hard") s.counters.asksMade += 1;
    if (readout.labeled) s.counters.labelsUsed += 1;
    s.stage = deriveStage(s);
    return s;
  }

  // lead turn
  const optOut = readout.explicitOptOut;
  s.lastLeadMessageAt = at;
  s.counters.leadTurns += 1;
  s.counters.agentTurnsSinceLastLead = 0;
  s.counters.followupsSinceLastReply = 0;
  s.counters.connection.invited = true;
  s.counters.connection.connected = true;

  if (readout.answeredQuestionRef) {
    for (const q of s.memory.questionsAsked) if (q.messageRef === readout.answeredQuestionRef) q.answered = true;
  }
  s.memory.problemsStated = dedupeCap([...s.memory.problemsStated, ...readout.newProblems], 20);
  s.memory.prioritiesStated = dedupeCap([...s.memory.prioritiesStated, ...readout.newPriorities], 20);
  if (readout.newProblems.length > 0) s.qualification.painIdentified = true;
  if (readout.newObjection) s.memory.objections.push({ ...readout.newObjection, handled: false });
  if (readout.intent === "agrees_next_step") s.memory.explicitPositive = true;

  const d = readout.personDelta;
  for (const t of TRAITS) s.person[t] = mergeTrait(s.person[t], d[t]);
  if (d.seniority && d.seniority !== "unknown") s.person.seniority = d.seniority;
  if (d.role && d.role !== "unknown") {
    s.person.role = d.role;
    s.person.roleConfidence = Math.max(s.person.roleConfidence, d.roleConfidence ?? 0);
  }
  if (readout.intent === "sells_to_us") {
    s.person.role = "seller_to_us";
    s.person.roleConfidence = Math.max(s.person.roleConfidence, 0.7);
  }
  if (d.language) s.person.register.language = d.language;
  if (d.emoji !== null) s.person.register.emoji = s.person.register.emoji || d.emoji;
  s.person.notes = dedupeCap([...s.person.notes, ...d.notes], 6);

  if (readout.booked) s.memory.booked = true;
  if (optOut) s.memory.explicitOptOut = true;
  if (readout.stance === "negative" && readout.confidence >= 0.8 && readout.intent === "declines") s.memory.declined = true;

  s.stage = deriveStage(s);
  return s;
}
