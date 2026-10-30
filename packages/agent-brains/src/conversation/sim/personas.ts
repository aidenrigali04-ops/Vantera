import type { Phase, ConversationState } from "../state";

/**
 * Simulated prospects (spec §8). Reply probabilities are calibrated from the research brief §2:
 * first-message reply 0.15-0.20, executives x0.7, a hard CTA costs 0.35. Every number is an
 * assumption, not Vantera data; sim-seeded priors are weighted at half a real observation.
 */
export type Persona = {
  id: "busy_exec" | "skeptic" | "info_requester" | "reverse_seller" | "warm_operator" | "rude" | "ghost";
  seniority: ConversationState["person"]["seniority"];
  /** synthetic LinkedIn headline for the lead the runner seeds */
  title: string;
  disposition: {
    replyProbByPhase: Record<Phase, number>;
    /** reply probability is multiplied by (1 - hardCtaPenalty) when the agent message pushes a calendar/meeting/demo */
    hardCtaPenalty: number;
    refuses: string[];
  };
  register: { formality: "casual" | "neutral" | "formal"; directness: "low" | "medium" | "high"; emoji: boolean; avgWords: number };
  /** plain-language behaviour script given to the prospect model */
  behavior: string;
};

const probs = (pre: number, eng: number, exp: number, asked: number, no: number): Record<Phase, number> => ({
  pre_reply: pre,
  engaged: eng,
  exploring: exp,
  asked,
  after_no: no,
});

export const PERSONAS: Persona[] = [
  {
    id: "busy_exec",
    seniority: "cxo",
    title: "Chief Executive Officer",
    disposition: { replyProbByPhase: probs(0.12, 0.5, 0.6, 0.4, 0.05), hardCtaPenalty: 0.35, refuses: ["discovery chains", "long messages"] },
    register: { formality: "neutral", directness: "high", emoji: false, avgWords: 9 },
    behavior:
      "You are a time-poor CEO. You answer in a few words. You ignore long messages and chains of questions, and you only engage with something short that is specific to your company.",
  },
  {
    id: "skeptic",
    seniority: "director",
    title: "Director of Revenue Operations",
    disposition: { replyProbByPhase: probs(0.18, 0.45, 0.5, 0.3, 0.05), hardCtaPenalty: 0.35, refuses: ["unsupported claims"] },
    register: { formality: "neutral", directness: "high", emoji: false, avgWords: 12 },
    behavior:
      "You are a skeptical director. Early on you ask why you are being messaged at all ('why are you messaging me?'). You discount any claim without a checkable basis and you warm up only when the seller drops claims and answers you plainly.",
  },
  {
    id: "info_requester",
    seniority: "manager",
    title: "Marketing Manager",
    disposition: { replyProbByPhase: probs(0.2, 0.6, 0.5, 0.3, 0.1), hardCtaPenalty: 0.35, refuses: ["booking a call"] },
    register: { formality: "neutral", directness: "medium", emoji: false, avgWords: 14 },
    behavior:
      "You are a manager who always asks for a deck, brochure or 'some info' instead of talking. You never agree to a call or a time, whatever is offered.",
  },
  {
    id: "reverse_seller",
    seniority: "manager",
    title: "Business Development Manager at a growth agency",
    disposition: { replyProbByPhase: probs(0.25, 0.7, 0.6, 0.2, 0.1), hardCtaPenalty: 0.35, refuses: ["buying anything"] },
    register: { formality: "casual", directness: "medium", emoji: false, avgWords: 18 },
    behavior:
      "You work in business development at an agency. You reply eagerly, but only to pitch your own services back to the seller. You are never a buyer and never agree to evaluate the seller's product.",
  },
  {
    id: "warm_operator",
    seniority: "manager",
    title: "Operations Manager",
    disposition: { replyProbByPhase: probs(0.22, 0.7, 0.75, 0.6, 0.1), hardCtaPenalty: 0.35, refuses: [] },
    register: { formality: "casual", directness: "medium", emoji: false, avgWords: 16 },
    behavior:
      "You are a friendly operator. By your second reply you state a real, specific problem you have at work. If the seller asks for a meeting after a real exchange (not in the first message), you agree and accept a specific time.",
  },
  {
    id: "rude",
    seniority: "manager",
    title: "Sales Manager",
    disposition: { replyProbByPhase: probs(0.15, 0.3, 0.1, 0.05, 0), hardCtaPenalty: 0.35, refuses: ["everything"] },
    register: { formality: "casual", directness: "high", emoji: false, avgWords: 5 },
    behavior: "You are irritated by cold messages. Your one reply is a single curt or hostile line.",
  },
  {
    id: "ghost",
    seniority: "manager",
    title: "Account Manager",
    disposition: { replyProbByPhase: probs(0, 0, 0, 0, 0), hardCtaPenalty: 0, refuses: ["everything"] },
    register: { formality: "neutral", directness: "medium", emoji: false, avgWords: 0 },
    behavior: "You never reply.",
  },
];

export const personaById = (id: Persona["id"]): Persona => {
  const p = PERSONAS.find((x) => x.id === id);
  if (!p) throw new Error(`unknown persona ${id}`);
  return p;
};
