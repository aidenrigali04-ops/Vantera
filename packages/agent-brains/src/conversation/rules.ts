import { MOVES, type Move, type Trigger } from "./moves";
import type { ConversationState, Stage } from "./state";

/** The slice of the reply readout the rules read. Task 3's `Readout` is structurally assignable to it. */
export type ReadoutLike = {
  stance: "positive" | "neutral" | "skeptical" | "negative" | "opt_out";
  confidence: number;
  intent:
    | "answers_question" | "asks_question" | "small_talk" | "states_problem" | "objects" | "requests_info"
    | "agrees_next_step" | "declines" | "opts_out" | "ooo" | "sells_to_us" | "other";
  explicitOptOut: boolean;
  identitySuspicion: boolean;
};

export type Veto = { move: Move; rule: string; source: string };

export type LegalInput = {
  state: ConversationState;
  trigger: Trigger;
  readout?: ReadoutLike;
  isLastTouch?: boolean;
  links: { booking: boolean; website: boolean; content: boolean };
};

const SPEC = "spec §6.1";
/** Agent turns after which a thread goes to a person. Must equal the pipeline's MAX_AGENT_TURNS. */
export const TURN_CAP = 6;
const QUESTION_BUDGET = 5;
export const DECLINE_CONFIDENCE = 0.8;
const ROLE_CONFIDENCE = 0.6;

/** Exploration may pick any move except these; they are only chosen by the model's top rank. */
export const EXPLORE_SAFE: ReadonlySet<Move> = new Set(MOVES.filter((m) => m !== "propose_times" && m !== "reframe" && m !== "poke"));

const STAGE_RANK: Record<Stage, number> = {
  pre_contact: 0, invited: 1, connected: 2, opened: 3, engaged: 4, exploring: 5, qualified: 6, asked: 7,
  booked: 8, declined: 8, dormant: 8, handed_off: 8, closed: 8,
};
const atLeast = (s: Stage, min: Stage) => STAGE_RANK[s] >= STAGE_RANK[min];

/** True for the first two agent turns after the latest lead turn (register mirroring window, R rule 22). */
export function mirrorAllowed(state: ConversationState): boolean {
  return state.lastLeadMessageAt !== null && state.counters.agentTurnsSinceLastLead < 2;
}

/** Words that read as a pitch; none may appear before the thread reaches `exploring` (R rule 4). */
export function pitchPattern(sellerName: string | null): RegExp {
  const parts = ["platform", "ai", "all-in-one", "roi"].map((w) => `\\b${w}\\b`);
  parts.push("\\d+(?:\\.\\d+)?\\s?%");
  const name = sellerName?.trim();
  if (name && name.length >= 2) parts.push(`(?<!\\w)${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?!\\w)`);
  return new RegExp(parts.join("|"), "i");
}

type Ctx = {
  s: ConversationState;
  trigger: Trigger;
  r: ReadoutLike | undefined;
  links: LegalInput["links"];
  isLastTouch: boolean;
  declined: boolean;
  roleBlocked: boolean;
};
type Check = (c: Ctx) => { rule: string; source: string } | null;
const veto = (rule: string, source = SPEC) => ({ rule, source });

const hasUnhandled = (s: ConversationState, kind: ConversationState["memory"]["objections"][number]["kind"]) =>
  s.memory.objections.some((o) => o.kind === kind && !o.handled);
const skepticismKnownHigh = (s: ConversationState) => !!s.person.skepticism && s.person.skepticism.confidence >= 0.5 && s.person.skepticism.value >= 0.5;
const QUESTION_MOVES = new Set<string>(["ask_discovery", "poke", "narrow", "soft_ask"]);
const SENIOR = new Set(["director", "vp", "cxo", "founder"]);

/** Per-move "legal when" predicates (spec §6.1). The first failing predicate is the logged veto. */
const CHECKS: Record<Move, Check[]> = {
  answer: [(c) => (c.s.memory.openLoops.length > 0 || c.r?.intent === "asks_question" ? null : veto("answer-needs-open-loop"))],
  acknowledge: [
    (c) => (c.s.counters.labelsUsed < 1 ? null : veto("label-overuse", "R rule 23")),
    (c) => (c.r && c.r.stance !== "neutral" ? null : veto("acknowledge-needs-affect")),
  ],
  observe: [(c) => (c.trigger === "first_message" || atLeast(c.s.stage, "connected") ? null : veto("observe-needs-connection", "R §3.2"))],
  ask_discovery: [
    (c) => (c.s.counters.questionsBudgetUsed < QUESTION_BUDGET ? null : veto("question-budget-spent", "R rule 24")),
    (c) => (c.s.lastMove && QUESTION_MOVES.has(c.s.lastMove.move) ? veto("last-move-was-a-question") : null),
  ],
  poke: [
    (c) =>
      hasUnhandled(c.s, "existing_solution") || (c.r?.stance === "skeptical" && skepticismKnownHigh(c.s))
        ? null
        : veto("poke-needs-skepticism", "R §1 Braun"),
  ],
  reframe: [
    (c) =>
      c.s.person.seniority !== "ic" && (SENIOR.has(c.s.person.seniority) || hasUnhandled(c.s, "existing_solution"))
        ? null
        : veto("reframe-needs-seniority", "R §1 Challenger"),
  ],
  narrow: [(c) => (hasUnhandled(c.s, "info_request") || c.r?.intent === "requests_info" ? null : veto("narrow-needs-info-request", "R §3"))],
  offer_value: [
    (c) => (atLeast(c.s.stage, "engaged") ? null : veto("offer-needs-engagement")),
    (c) => (c.links.content ? null : veto("no-content-to-offer")),
    (c) => (c.s.memory.linksShared.content < 1 ? null : veto("offer-already-shared")),
  ],
  soft_ask: [
    (c) => {
      const last = c.s.lastMove;
      const leadSince = !!c.s.lastLeadMessageAt && !!last && c.s.lastLeadMessageAt > last.at;
      return last?.move === "soft_ask" && !leadSince ? veto("soft-ask-twice", "R rule 6") : null;
    },
    (c) => (c.s.lastMove?.move === "propose_times" || c.s.stage === "booked" ? veto("soft-ask-after-hard-ask", "R rule 6") : null),
    (c) => (atLeast(c.s.stage, "exploring") ? null : veto("soft-ask-needs-exploring")),
    (c) => (c.s.counters.asksMade < 2 ? null : veto("asks-exhausted", "R rule 6")),
  ],
  propose_times: [(c) => (c.s.memory.explicitPositive ? null : veto("needs-explicit-positive", "R rule 6"))],
  confirm: [(c) => ((c.s.stage === "asked" || c.s.stage === "booked") && c.s.memory.explicitPositive ? null : veto("confirm-needs-agreement"))],
  graceful_exit: [
    (c) => (c.s.lastMove?.move === "graceful_exit" ? veto("graceful-exit-once") : null),
    (c) =>
      c.declined || c.roleBlocked || c.r?.stance === "negative" || c.r?.stance === "skeptical" || c.r?.stance === "opt_out"
        ? null
        : veto("graceful-exit-needs-no"),
  ],
  breakup: [(c) => (c.s.counters.followupsSinceLastReply >= 2 || c.isLastTouch ? null : veto("breakup-needs-followups", "R rule 15"))],
  wait: [(c) => (c.trigger === "reply" && c.r?.intent === "asks_question" ? veto("never-leave-a-question-hanging") : null)],
  hand_to_human: [
    (c) => {
      const { s, r } = c;
      const turns = s.counters.agentTurns + s.counters.leadTurns;
      const warranted =
        s.counters.agentTurns >= TURN_CAP ||
        !!r?.identitySuspicion ||
        (c.roleBlocked && turns >= 2) ||
        c.declined ||
        s.memory.closed ||
        s.memory.handedOff ||
        r?.stance === "negative" ||
        r?.stance === "opt_out";
      return warranted ? null : veto("handoff-not-warranted");
    },
  ],
};

/** Moves allowed under a narrowing rule; everything else survives only if listed. */
function narrowing(c: Ctx): { keep: ReadonlySet<Move>; rule: string; source: string } | null {
  const { s, r } = c;
  if (s.memory.closed || s.memory.handedOff) return { keep: new Set(["wait", "hand_to_human"]), ...veto("thread-closed") };
  if (r?.identitySuspicion) return { keep: new Set(["hand_to_human"]), ...veto("identity-suspicion", "spec §6.2 rule 8") };
  if (c.declined) {
    // one graceful exit, then silence
    const keep: ReadonlySet<Move> = s.lastMove?.move === "graceful_exit" ? new Set(["wait", "hand_to_human"]) : new Set(["graceful_exit", "hand_to_human"]);
    return { keep, ...veto("declined", "spec §6.2 rule 9") };
  }
  if (c.trigger === "reply" && s.counters.agentTurns >= TURN_CAP)
    return { keep: new Set(["hand_to_human", "wait"]), ...veto("turn-cap") };
  // follow-up limits govern unanswered follow-ups only; a lead who replies gets a normal menu
  if (c.trigger === "followup" && (s.lastMove?.move === "breakup" || s.counters.followupsSinceLastReply >= 3))
    return { keep: new Set(["wait"]), ...veto("followups-exhausted", "R rule 14") };
  if (c.isLastTouch) return { keep: new Set(["breakup", "wait"]), ...veto("last-touch-breakup-only", "R rule 14") };
  if (c.roleBlocked) return { keep: new Set(["answer", "graceful_exit", "hand_to_human"]), ...veto("seller-to-us", "spec §6.2 rule 7") };
  if (c.trigger === "first_message")
    return { keep: new Set(["observe", "ask_discovery", "wait", "hand_to_human"]), ...veto("first-message-menu") };
  if (c.trigger === "followup" && s.counters.followupsSinceLastReply >= 2) return { keep: new Set(["breakup", "wait"]), ...veto("followups-exhausted", "R rule 14") };
  if (r?.stance === "skeptical")
    return { keep: new Set(["answer", "acknowledge", "poke", "observe", "graceful_exit", "wait"]), ...veto("skeptical-narrowing", "spec §6.4") };
  if (s.stage === "booked") return { keep: new Set(["confirm", "answer", "wait", "hand_to_human"]), ...veto("already-booked") };
  return null;
}

/**
 * The deterministic menu for this turn: every move that survives its own legality predicate and the
 * narrowing rules, plus the logged vetoes. Text-level rules (pitch words, one question, hedged claims,
 * pronoun counts) belong to the linter, not here; `pitchPattern` supports it.
 */
export function legalMoves(input: LegalInput): { legal: Move[]; vetoes: Veto[] } {
  const { state, trigger, readout, links } = input;
  const declined =
    state.memory.declined ||
    state.memory.explicitOptOut ||
    !!readout?.explicitOptOut ||
    readout?.stance === "opt_out" ||
    readout?.intent === "opts_out" ||
    (readout?.stance === "negative" && readout.confidence >= DECLINE_CONFIDENCE && readout.intent === "declines");
  const roleBlocked =
    ((state.person.role === "seller_to_us" || state.person.role === "recruiter") && state.person.roleConfidence >= ROLE_CONFIDENCE) ||
    readout?.intent === "sells_to_us";
  const ctx: Ctx = { s: state, trigger, r: readout, links, isLastTouch: !!input.isLastTouch, declined, roleBlocked };

  const vetoes: Veto[] = [];
  let legal: Move[] = [];
  for (const move of MOVES) {
    const sameMove = (): { rule: string; source: string } | null =>
      move !== "wait" && move !== "hand_to_human" && move !== "graceful_exit" && state.lastMove?.move === move
        ? veto("same-move-twice", "spec §6.2 rule 6")
        : null;
    // soft_ask reports its own (more specific) vetoes before the generic repeat guard
    const checks = move === "soft_ask" ? [...CHECKS[move], sameMove] : [sameMove, ...CHECKS[move]];
    let failed: { rule: string; source: string } | null = null;
    for (const check of checks) {
      if (failed) break;
      failed = check(ctx);
    }
    if (failed) vetoes.push({ move, ...failed });
    else legal.push(move);
  }

  const narrow = narrowing(ctx);
  if (narrow) {
    for (const move of legal) if (!narrow.keep.has(move)) vetoes.push({ move, rule: narrow.rule, source: narrow.source });
    legal = legal.filter((m) => narrow.keep.has(m));
  }

  return { legal, vetoes };
}
