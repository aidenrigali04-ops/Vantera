import { tagLinksInText } from "@vantera/meetings-infra";
import {
  COMPOSE_SYSTEM,
  POLICY_SYSTEM,
  POLICY_VERSION,
  applyReadout,
  archetypeOf,
  bestOfN,
  buildSendRecipe,
  decideMove,
  deriveStage,
  describeViolations,
  leadBlock,
  legalMoves,
  phaseOf,
  posteriorFor,
  renderThread,
  replyDelayMs,
  seedState,
  styleKey,
  type ComposeInput,
  type ConversationDraft,
  type ConversationState,
  type CopyLead,
  type JudgeFn,
  type Move,
  type MoveDecision,
  type Readout,
  type Shortlist,
  type StoredInsights,
  type composeMessage,
  type readTurn,
  type shortlistMoves,
} from "@vantera/agent-brains";
import { getModelId } from "@vantera/ai";
import { MAX_BEST_OF_N, normalizeLinkedInUrl } from "./copy-draft";
import type {
  ConversationMode,
  ConversationStore,
  ConversationTrigger,
  InboundStore,
  NewDecision,
  ResponderBundle,
} from "./types";

/**
 * The one conversation core (spec §4): reader → rules → policy → composer → decision log, for all
 * three triggers (an inbound reply, the first message after acceptance, a due follow-up). Pure: every
 * model call and store write is injected, so the whole loop runs in tests and in the simulator.
 */

export type DecideOutcome = {
  action: "drafted" | "wait" | "hand_to_human" | "exit" | "skipped";
  decisionId: string | null;
  move: Move | null;
  reason?: string;
};

export interface ConversationDecideDeps {
  store: ConversationStore &
    Pick<InboundStore, "insertLeadNotification" | "cancelPendingSends" | "stopSequenceForReply" | "isSuppressed" | "getLeadLinkedInUrl">;
  readFn: typeof readTurn;
  shortlistFn: typeof shortlistMoves;
  composeFn: typeof composeMessage;
  /** AUTOMATIC-mode only: one targeted fix of a flagged draft before it may auto-send */
  fixFn?: (d: ConversationDraft, i: ComposeInput) => Promise<ConversationDraft>;
  judgeFn?: JudgeFn;
  bestOfN?: number;
  now: () => Date;
  rng: () => number;
  seed: () => number;
}

export const HANDOFF_NOTE = "This thread needs you — the agent stepped aside.";

/**
 * Fold every stored turn after `lastMessageRef` into the lead's state, in order, and persist the last
 * ref read. A ref that's no longer in the thread means a backfill: every turn is read. Idempotent —
 * a repeat call with nothing new reads nothing and returns the stored state. `knownReadouts` (ref →
 * readout) supplies readouts already produced upstream so those turns skip the model call.
 */
export async function syncState(
  accountId: string,
  leadId: string,
  lead: CopyLead,
  insights: StoredInsights | null,
  grounding: string,
  deps: ConversationDecideDeps,
  knownReadouts?: Map<string, Readout>
): Promise<ConversationState> {
  const stored = await deps.store.getConversationState(accountId, leadId);
  const turns = await deps.store.listThreadTurns(accountId, leadId);
  const lastRef = stored?.lastMessageRef ?? null;
  const seen = lastRef === null ? -1 : turns.findIndex((t) => t.ref === lastRef);
  const unread = turns.slice(seen + 1);
  if (stored && unread.length === 0) return stored.state;
  let state: ConversationState;
  if (stored && seen >= 0) {
    state = stored.state;
  } else {
    // Fresh lead, or a backfill (cursor missing from the thread): re-fold every turn from the seed so
    // nothing is applied twice. Only lastMove survives — the core is its only writer, no turn re-derives it.
    state = seedState(lead, insights);
    if (stored) state.lastMove = stored.state.lastMove;
  }
  for (const turn of unread) {
    // a turn already read upstream (the incoming reply's readout) is applied, never read twice
    const readout = knownReadouts?.get(turn.ref) ?? (await deps.readFn(state, turn, grounding));
    state = applyReadout(state, turn, readout);
  }
  await deps.store.saveConversationState(accountId, leadId, state, unread.at(-1)?.ref ?? lastRef);
  return state;
}

const BRAIN = { reply: "conversation_reply", first_message: "first_touch", followup: "sequence_followup" } as const;

export async function runConversationDecide(
  args: {
    accountId: string;
    leadId: string;
    campaignId: string;
    trigger: ConversationTrigger;
    mode: Exclude<ConversationMode, "off">;
    bundle: ResponderBundle;
    sellerName: string | null;
  },
  deps: ConversationDecideDeps
): Promise<DecideOutcome> {
  const { accountId, leadId, trigger, bundle } = args;
  const { store } = deps;
  // live_replies acts on replies only; a proactive trigger under it is logged, never sent.
  const mode: Exclude<ConversationMode, "off"> = args.mode === "live_replies" && trigger.kind !== "reply" ? "shadow" : args.mode;

  // (1) rule 11: suppression before anything that could reach a prospect — and before any model spend.
  const url = await store.getLeadLinkedInUrl(accountId, leadId);
  if (url && (await store.isSuppressed(accountId, "linkedin", normalizeLinkedInUrl(url)))) {
    return { action: "skipped", reason: "suppressed", decisionId: null, move: null };
  }
  // Retry guard for proactive sends: the caller reloads the bundle every run, so an unsent queued
  // message means this touch was already drafted (or another is pending) — never stack a second one.
  if (mode !== "shadow" && trigger.kind !== "reply" && bundle.newestUnsentMessageCreatedAt !== null) {
    return { action: "skipped", reason: "unsent_message_exists", decisionId: null, move: null };
  }

  // (2) reader: catch the state up on every unread turn (a double-message is two turns, one answer).
  const grounding = leadBlock({ lead: bundle.lead, insights: bundle.insights, context: bundle.context });
  const known = trigger.kind === "reply" ? new Map([[trigger.replyId, trigger.readout]]) : undefined;
  const state = await syncState(accountId, leadId, bundle.lead, bundle.insights, grounding, deps, known);

  // (3) rules: the deterministic legal menu.
  const readout = trigger.kind === "reply" ? trigger.readout : undefined;
  const links = {
    booking: !!bundle.context.bookingUrl,
    website: !!bundle.context.websiteUrl,
    content: (bundle.context.contentLinks ?? []).length > 0,
  };
  const { legal, vetoes } = legalMoves({
    state,
    trigger: trigger.kind,
    readout,
    ...(trigger.kind === "followup" ? { isLastTouch: trigger.isLast } : {}),
    links,
  });

  // (4) priors → posteriors per legal move for this (phase, archetype).
  const phase = phaseOf(deriveStage(state));
  const archetype = archetypeOf(state.person);
  const table = await store.readPriors(accountId);
  const posteriors = new Map<Move, { alpha: number; beta: number }>();
  const priors: { move: Move; rate: number; n: number; level: ReturnType<typeof posteriorFor>["level"] }[] = [];
  for (const move of legal) {
    const p = posteriorFor(table, move, phase, archetype);
    posteriors.set(move, { alpha: p.alpha, beta: p.beta });
    priors.push({ move, rate: p.alpha / (p.alpha + p.beta), n: p.n, level: p.level });
  }

  // (5) policy shortlist, (6) exploration pick. An empty shortlist means no move fits: a person decides.
  const shortlist: Shortlist = await deps.shortlistFn({
    state,
    trigger: trigger.kind,
    readout,
    incoming: trigger.kind === "reply" ? trigger.incoming : undefined,
    legal,
    vetoes,
    priors,
    links,
    cta: bundle.context.cta,
  });
  const decision: Pick<MoveDecision, "move" | "style" | "rationale" | "propensity"> =
    shortlist.candidates.length > 0
      ? decideMove(shortlist, posteriors, deps.rng)
      : {
          move: "hand_to_human",
          style: { lengthBand: "short", question: false, link: "none", mirror: false },
          rationale: "no legal move fits",
          propensity: 1,
        };

  const logDecision = (scheduledSendId: string | null, composedBody: string | null) => {
    const row: NewDecision = {
      accountId,
      leadId,
      scheduledSendId,
      mode: mode === "shadow" ? "shadow" : "live",
      trigger: trigger.kind,
      phase,
      archetype,
      move: decision.move,
      styleKey: styleKey(decision.style),
      propensity: decision.propensity,
      seed: deps.seed(),
      legalMoves: legal,
      vetoes,
      degraded: shortlist.degraded ?? null,
      stateSnapshot: state,
      composedBody,
      policyVersion: POLICY_VERSION,
      promptHash: POLICY_SYSTEM.hash,
    };
    return store.insertDecision(row);
  };

  // (7) shadow: record what the policy WOULD do; compose and send nothing.
  if (mode === "shadow") {
    const decisionId = await logDecision(null, null);
    return { action: "skipped", reason: "shadow", decisionId, move: decision.move };
  }

  // (8) live.
  if (decision.move === "wait") {
    return { action: "wait", decisionId: await logDecision(null, null), move: "wait" };
  }
  if (decision.move === "hand_to_human") {
    const decisionId = await logDecision(null, null);
    await store.insertLeadNotification({ accountId, leadId, kind: "needs_human", body: HANDOFF_NOTE });
    // a person owns the thread now: no proactive touches until they hand it back ("Let Vera handle it")
    await store.stopSequenceForReply(leadId);
    await rememberMove(accountId, leadId, state, decision.move, deps);
    return { action: "hand_to_human", decisionId, move: "hand_to_human" };
  }

  const input: ComposeInput = {
    lead: bundle.lead,
    insights: bundle.insights,
    context: bundle.context,
    state,
    thread: bundle.thread,
    ...(trigger.kind === "reply" ? { incoming: trigger.incoming } : {}),
    decision: { move: decision.move, style: decision.style, rationale: decision.rationale },
    avoidSkeletons: bundle.context.avoidSkeletons ?? [],
    sellerName: args.sellerName,
  };
  // Best-of-N exactly as the responder: no judge ⇒ n=1 (byte-identical single draft); the judge only
  // ranks, the humanizer/lint + fix gate below stays the hard floor.
  const configuredN = Math.min(Math.max(1, Math.floor(deps.bestOfN ?? 1)), MAX_BEST_OF_N);
  const n = deps.judgeFn ? configuredN : 1;
  const { chosen } = await bestOfN(
    n,
    () => deps.composeFn(input),
    (d) => d.message,
    { grounding, cta: bundle.context.cta, conversation: renderThread(bundle.thread) },
    deps.judgeFn
  );
  let draft = chosen;
  if (bundle.sendMode === "automatic" && draft.violations.length > 0 && deps.fixFn) {
    draft = await deps.fixFn(draft, input);
  }
  const clean = draft.violations.length === 0;
  const isReply = trigger.kind === "reply";

  // A reply replaces any queued scripted touch — the contextual answer takes over the thread.
  if (isReply) await store.cancelPendingSends(leadId);
  // ML-6: tag the booking link on every outbound so a booking attributes to this exact lead.
  const body = tagLinksInText(draft.message, bundle.context.bookingUrl, leadId);
  const sendId = await store.insertScheduledSendReturningId({
    accountId,
    campaignId: bundle.campaignId,
    leadId,
    channel: "linkedin",
    subject: null,
    body,
    status: bundle.sendMode === "automatic" && clean ? "approved" : "pending_review",
    linkedinStage: "message",
    origin: isReply ? "reply_response" : "sequence",
    styleFlags: clean ? null : describeViolations(draft.violations),
    ...(isReply
      ? { notBefore: new Date(deps.now().getTime() + replyDelayMs(trigger.incoming.length, draft.message.length, deps.rng)) }
      : {}),
    // TODO(Task 12): recipe v3 — add move, styleKey, policyVersion, propensity, decisionId here.
    recipe: buildSendRecipe({
      brain: BRAIN[trigger.kind],
      strategy: bundle.attribution.strategy,
      playbookVersion: bundle.attribution.playbookVersion,
      promptHash: COMPOSE_SYSTEM.hash,
      modelId: getModelId(),
      ...(n > 1 ? { bestOfN: n } : {}),
    }),
  });
  const decisionId = await logDecision(sendId, body);
  await rememberMove(accountId, leadId, state, decision.move, deps);

  if (decision.move === "graceful_exit") {
    if (isReply) await store.stopSequenceForReply(leadId);
    return { action: "exit", decisionId, move: "graceful_exit" };
  }
  return { action: "drafted", decisionId, move: decision.move };
}

/**
 * Stamp the move the agent acted on so the repeat guards (same-move-twice, graceful-exit-once,
 * soft-ask-twice) see it next turn. The reader cannot know the move from text, so this core is the
 * only writer of `lastMove`. Never on `wait`, never in shadow; the read pointer is left untouched.
 * The message's own content is folded in by the next `syncState` from the text actually sent.
 */
async function rememberMove(
  accountId: string,
  leadId: string,
  synced: ConversationState,
  move: Move,
  deps: ConversationDecideDeps
): Promise<void> {
  const current = await deps.store.getConversationState(accountId, leadId);
  const state = structuredClone(current?.state ?? synced);
  state.lastMove = { move, at: deps.now().toISOString() };
  await deps.store.saveConversationState(accountId, leadId, state, current?.lastMessageRef ?? null);
}
