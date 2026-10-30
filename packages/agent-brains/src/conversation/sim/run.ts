import type { LanguageModel } from "ai";
import { leadBlock, type CopyContext, type CopyLead } from "../../copy/shared";
import type { StoredInsights } from "../../prospect/schema";
import type { ConversationTurn } from "../../reply/respond";
import type { ComposeInput } from "../compose";
import { reward, rollup, type DecisionOutcome } from "../learn";
import type { Move, MoveDecision, Trigger } from "../moves";
import { decideMove, type PolicyInput, type Shortlist } from "../policy";
import { posteriorFor, researchPriors, type PriorTable } from "../priors";
import { applyReadout, type Readout } from "../read";
import { legalMoves } from "../rules";
import {
  archetypeOf,
  phaseOf,
  seedState,
  type Archetype,
  type ConversationState,
  type Phase,
  type StoredTurn,
} from "../state";
import type { SimJudgement } from "./judge";
import type { Persona } from "./personas";
import { simulateProspectReply } from "./prospect";

export type SimDecision = {
  move: Move;
  phase: Phase;
  archetype: Archetype;
  propensity: number;
  /** what happened after THIS decision (reader-based; the judge penalties are applied in simToPriors) */
  outcome: DecisionOutcome;
};

export type SimEnd = "max_turns" | "graceful_exit" | "hand_to_human" | "silence" | "confirmed" | "no_legal_move";

export type SimThread = {
  persona: Persona["id"];
  seed: number;
  lead: CopyLead;
  insights: StoredInsights;
  context: CopyContext;
  turns: StoredTurn[];
  /** the reader's readout for each lead turn, in order */
  readouts: ({ turn: string } & Readout)[];
  decisions: SimDecision[];
  outcome: DecisionOutcome;
  judge: SimJudgement | null;
  end: SimEnd;
  finalState: ConversationState;
  finalTrigger: Trigger;
};

export type SimDeps = {
  shortlist: (input: PolicyInput, model: LanguageModel) => Promise<Shortlist>;
  compose: (input: ComposeInput, model: LanguageModel) => Promise<{ message: string }>;
  read: (state: ConversationState, turn: StoredTurn, grounding: string, model: LanguageModel) => Promise<Readout>;
  rng: () => number;
  model: LanguageModel;
  priors?: PriorTable;
  /** optional end-of-thread judge (the script wires the independent judge model) */
  judge?: (thread: ConversationTurn[]) => Promise<SimJudgement>;
  seed?: number;
};

const SELLER = "Vantera";
const BASE_TIME = Date.parse("2026-10-01T09:00:00Z");
const HOUR = 3_600_000;

const NAMES: Record<Persona["id"], [string, string, string]> = {
  busy_exec: ["Dana", "Whitfield", "Whitfield Logistics"],
  skeptic: ["Marcus", "Hale", "Hale Industrial Software"],
  info_requester: ["Priya", "Nair", "Brightpath Learning"],
  reverse_seller: ["Jordan", "Reyes", "Reyes Growth Partners"],
  warm_operator: ["Sam", "Okafor", "Okafor Home Services"],
  rude: ["Chris", "Dunn", "Dunn Equipment"],
  ghost: ["Alex", "Moreau", "Moreau Consulting"],
};

export function syntheticLead(persona: Persona): { lead: CopyLead; insights: StoredInsights; context: CopyContext } {
  const [firstName, lastName, companyName] = NAMES[persona.id];
  return {
    lead: { firstName, lastName, title: persona.title, companyName, industry: "B2B services" },
    insights: {
      pain_points: ["Outbound pipeline depends on a few people doing manual LinkedIn prospecting"],
      triggers: ["Hiring for a sales role this quarter"],
      motivations: ["More qualified conversations without adding headcount"],
      value_angle: "Qualified LinkedIn conversations drafted for approval, no extra headcount",
      aha_moment: "Seeing a week of drafted replies grounded in real prospect context",
      summary: `${persona.title} at ${companyName}; mid-size B2B team with manual outbound.`,
    },
    context: {
      cta: "a short intro call",
      accountName: SELLER,
      accountIndustry: "LinkedIn outreach software",
      valueProp: "Finds in-market prospects on LinkedIn, drafts personal messages, and books qualified meetings while the founder approves every send",
      websiteUrl: "https://www.vanterasystem.dev",
      bookingUrl: "https://cal.com/vantera/intro",
      contentLinks: [],
    },
  };
}

const toConv = (turns: StoredTurn[]): ConversationTurn[] =>
  turns.filter((t) => t.role !== "human").map((t) => ({ role: t.role === "lead" ? "lead" : "agent", text: t.text }));

const emptyDelta: Readout["personDelta"] = {
  directness: null, formality: null, warmth: null, skepticism: null, verbosity: null,
  seniority: null, role: null, roleConfidence: null, language: null, emoji: null, notes: [],
};

/** Deterministic seller-side readout: what the chosen move and style imply, no model. */
export function sellerReadout(decision: Pick<MoveDecision, "move" | "style">, message: string): Readout {
  const sentences = message.split(/(?<=[.!?])\s+/).filter(Boolean);
  const question = sentences.find((s) => s.trim().endsWith("?")) ?? null;
  return {
    stance: "neutral", confidence: 1, intent: "other", explicitOptOut: false, identitySuspicion: false, booked: false,
    answeredQuestionRef: null, newProblems: [], newPriorities: [], newObjection: null, personDelta: emptyDelta,
    hookUsed: decision.move === "observe" && sentences[0] ? { kind: "observation", text: sentences[0].slice(0, 200) } : null,
    questionAsked: question ? question.slice(0, 240) : null,
    claims: [],
    linksShared: decision.style.link === "none" ? [] : [decision.style.link],
    ask: decision.move === "propose_times" ? "hard" : decision.move === "soft_ask" ? "soft" : "none",
    labeled: decision.move === "acknowledge",
  };
}

const blankOutcome = (): DecisionOutcome => ({
  replied: false, stance: null, furtherLeadTurns: 0, booked: false, optOut: false, identitySuspicion: false, humanTakeover: false, waitThenReply: false,
});

export async function runSimThread(persona: Persona, deps: SimDeps, maxTurns = 6): Promise<SimThread> {
  const { lead, insights, context } = syntheticLead(persona);
  const grounding = leadBlock({ lead, insights, context });
  const links = { booking: !!context.bookingUrl, website: !!context.websiteUrl, content: (context.contentLinks ?? []).length > 0 };
  const table = deps.priors ?? researchPriors();

  let state = seedState(lead, insights);
  const turns: StoredTurn[] = [];
  const readouts: SimThread["readouts"] = [];
  const decisions: SimDecision[] = [];
  /** per decision: index into `readouts` of the reply it drew, or -1 */
  const replyIdx: number[] = [];
  let trigger: Trigger = "first_message";
  let readout: Readout | undefined;
  let incoming: string | undefined;
  let silences = 0;
  let end: SimEnd = "max_turns";
  let tick = 0;
  const stamp = () => new Date(BASE_TIME + HOUR * tick++).toISOString();

  while (decisions.length < maxTurns) {
    const { legal, vetoes } = legalMoves({ state, trigger, readout, links });
    const phase = phaseOf(state.stage);
    const archetype = archetypeOf(state.person);
    const posteriors = new Map<Move, { alpha: number; beta: number }>();
    const priorRows = legal.map((m) => {
      const p = posteriorFor(table, m, phase, archetype);
      posteriors.set(m, { alpha: p.alpha, beta: p.beta });
      return { move: m, rate: p.alpha / (p.alpha + p.beta), n: p.n, level: p.level };
    });
    const sl = await deps.shortlist(
      { state, trigger, readout, incoming, legal, vetoes, priors: priorRows, links, cta: context.cta },
      deps.model,
    );
    if (sl.candidates.length === 0) {
      end = "no_legal_move";
      break;
    }
    const d = decideMove(sl, posteriors, deps.rng);
    decisions.push({ move: d.move, phase, archetype, propensity: d.propensity, outcome: blankOutcome() });
    replyIdx.push(-1);
    const di = decisions.length - 1;
    state = { ...state, lastMove: { move: d.move, at: new Date(BASE_TIME + HOUR * tick).toISOString() } };

    if (d.move === "hand_to_human") {
      end = "hand_to_human";
      break;
    }
    if (d.move !== "wait") {
      const draft = await deps.compose(
        { lead, insights, context, state, thread: toConv(turns), incoming, decision: d, sellerName: SELLER },
        deps.model,
      );
      const agentTurn: StoredTurn = { ref: `t${turns.length}`, role: "agent", text: draft.message, at: stamp(), stage: "message" };
      turns.push(agentTurn);
      const lastMove = state.lastMove;
      state = applyReadout(state, agentTurn, sellerReadout(d, draft.message));
      state.lastMove = lastMove;
      if (d.move === "graceful_exit") {
        end = "graceful_exit";
        break;
      }
      const reply = await simulateProspectReply(
        persona,
        { turns: toConv(turns), phase: phaseOf(state.stage) },
        draft.message,
        deps.rng,
        deps.model,
      );
      if (reply.text !== null) {
        silences = 0;
        const leadTurn: StoredTurn = { ref: `t${turns.length}`, role: "lead", text: reply.text, at: stamp() };
        turns.push(leadTurn);
        readout = await deps.read(state, leadTurn, grounding, deps.model);
        const keep = state.lastMove;
        state = applyReadout(state, leadTurn, readout);
        state.lastMove = keep;
        readouts.push({ turn: leadTurn.ref, ...readout });
        replyIdx[di] = readouts.length - 1;
        trigger = "reply";
        incoming = reply.text;
        if (d.move === "confirm" && state.memory.booked) {
          end = "confirmed";
          break;
        }
        continue;
      }
    }
    // wait, or the prospect stayed silent
    silences += 1;
    if (silences >= 2) {
      end = "silence";
      break;
    }
    trigger = "followup";
    readout = undefined;
    incoming = undefined;
    tick += 24;
  }

  // ---- outcomes -------------------------------------------------------
  const totalLead = readouts.length;
  const bookedAt = readouts.findIndex((r) => r.booked);
  const bookingDecision = bookedAt >= 0 ? replyIdx.indexOf(bookedAt) : -1;
  decisions.forEach((dec, i) => {
    const ri = replyIdx[i]!;
    const r = ri >= 0 ? readouts[ri] : undefined;
    dec.outcome = {
      replied: !!r,
      stance: r?.stance ?? null,
      furtherLeadTurns: r ? totalLead - ri - 1 : 0,
      booked: !!r?.booked,
      bookedShared: bookingDecision >= 0 && i < bookingDecision ? true : undefined,
      optOut: !!r && (r.explicitOptOut || r.stance === "opt_out"),
      identitySuspicion: !!r?.identitySuspicion,
      humanTakeover: false,
      waitThenReply: dec.move === "wait" && i + 1 < decisions.length && replyIdx[i + 1]! >= 0,
    };
  });

  const judge = deps.judge ? await deps.judge(toConv(turns)) : null;
  const last = readouts[readouts.length - 1];
  const outcome: DecisionOutcome = {
    replied: totalLead > 0,
    stance: last?.stance ?? null,
    furtherLeadTurns: Math.max(0, totalLead - 1),
    booked: state.memory.booked,
    optOut: state.memory.explicitOptOut || readouts.some((r) => r.explicitOptOut || r.stance === "opt_out"),
    identitySuspicion: judge?.identityDetection ?? false,
    humanTakeover: false,
    waitThenReply: decisions.some((x) => x.outcome.waitThenReply),
  };

  return {
    persona: persona.id,
    seed: deps.seed ?? 0,
    lead, insights, context, turns, readouts, decisions, outcome, judge, end,
    finalState: state,
    finalTrigger: trigger,
  };
}

/** Judge penalties (spec §8): pressure >= 4 => -3, manipulation >= 4 => -5, identityDetection => -4. */
export function judgePenalty(j: SimJudgement | null): number {
  if (!j) return 0;
  return (j.pressure >= 4 ? -3 : 0) + (j.manipulation >= 4 ? -5 : 0) + (j.identityDetection ? -4 : 0);
}

export function simToPriors(threads: SimThread[]): PriorTable {
  const rows = threads.flatMap((t) => {
    const pen = judgePenalty(t.judge);
    return t.decisions.map((d) => ({
      move: d.move,
      phase: d.phase,
      archetype: d.archetype,
      propensity: d.propensity,
      reward: reward(d.outcome, d.move) + pen,
    }));
  });
  return rollup(rows, "sim");
}
