import { describe, expect, it, vi } from "vitest";
import {
  COMPOSE_SYSTEM,
  POLICY_SYSTEM,
  POLICY_VERSION,
  REPLY_DELAY_MIN_MS,
  TURN_CAP,
  emptyState,
  type ConversationDraft,
  type ConversationState,
  type Move,
  type PolicyInput,
  type PriorTable,
  type Readout,
  type Shortlist,
  type StoredTurn,
} from "@vantera/agent-brains";
import { getModelId } from "@vantera/ai";
import { MAX_AGENT_TURNS } from "./inbound";
import {
  runConversationDecide,
  syncState,
  type ConversationDecideDeps,
} from "./conversation-decide";
import type { ConversationTrigger, NewDecision, NewScheduledSend, ResponderBundle } from "./types";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ACC = "acc1";
const LEAD = "lead1";
const CAMP = "camp1";
const NOW = new Date("2026-10-28T15:00:00Z");
const BOOKING = "https://calendly.com/acme/intro";

function readout(over: Partial<Readout> = {}): Readout {
  return {
    stance: "neutral",
    confidence: 0.7,
    intent: "other",
    explicitOptOut: false,
    identitySuspicion: false,
    booked: false,
    answeredQuestionRef: null,
    newProblems: [],
    newPriorities: [],
    newObjection: null,
    personDelta: {
      directness: null,
      formality: null,
      warmth: null,
      skepticism: null,
      verbosity: null,
      seniority: null,
      role: null,
      roleConfidence: null,
      language: null,
      emoji: null,
      notes: [],
    },
    hookUsed: null,
    questionAsked: null,
    claims: [],
    linksShared: [],
    ask: "none",
    labeled: false,
    ...over,
  };
}

const bundle = (over: Partial<ResponderBundle> = {}): ResponderBundle => ({
  campaignId: CAMP,
  sendMode: "automatic",
  lead: { firstName: "Ryan", lastName: "C", title: "VP Sales", companyName: "Northwind", industry: "SaaS" },
  insights: {
    pain_points: ["unqualified leads"],
    triggers: ["Series A"],
    motivations: ["pipeline"],
    value_angle: "qualify first",
    aha_moment: "first booked meeting",
    summary: "good fit",
  },
  context: { cta: "a quick intro", bookingUrl: BOOKING },
  thread: [
    { role: "agent", text: "Saw the Series A — how are you qualifying inbound now?" },
    { role: "lead", text: "Mostly by hand." },
  ],
  agentTurns: 1,
  newestUnsentMessageCreatedAt: null,
  lastAgentMessageAt: null,
  humanHandled: false,
  attribution: { strategy: {}, playbookVersion: 3 },
  ...over,
});

const turn = (ref: string, role: StoredTurn["role"], text: string, at: string): StoredTurn => ({ ref, role, text, at });

const BASE_TURNS: StoredTurn[] = [
  turn("m1", "agent", "Saw the Series A — how are you qualifying inbound now?", "2026-10-27T10:00:00Z"),
  turn("m2", "lead", "Mostly by hand.", "2026-10-28T14:00:00Z"),
];

// ---------------------------------------------------------------------------
// Fake store — records every call
// ---------------------------------------------------------------------------

function makeStore(opts: {
  turns?: StoredTurn[];
  stored?: { state: ConversationState; lastMessageRef: string | null } | null;
  suppressed?: boolean;
  priors?: PriorTable;
} = {}) {
  const calls: string[] = [];
  let stored = opts.stored ?? null;
  const saves: { state: ConversationState; lastMessageRef: string | null }[] = [];
  const decisions: NewDecision[] = [];
  const sends: (NewScheduledSend & { notBefore?: Date | null })[] = [];
  const notifications: { kind: string; body: string; leadId: string }[] = [];
  const canceled: string[] = [];
  const stopped: string[] = [];
  const suppressionChecks: string[] = [];
  const store: ConversationDecideDeps["store"] = {
    getConversationPolicyMode: async () => "live",
    getConversationState: async () => {
      calls.push("getConversationState");
      return stored ? { state: structuredClone(stored.state), lastMessageRef: stored.lastMessageRef } : null;
    },
    saveConversationState: async (_a, _l, state, lastMessageRef) => {
      calls.push("saveConversationState");
      stored = { state: structuredClone(state), lastMessageRef };
      saves.push({ state: structuredClone(state), lastMessageRef });
    },
    listThreadTurns: async () => {
      calls.push("listThreadTurns");
      return opts.turns ?? BASE_TURNS;
    },
    insertDecision: async (d) => {
      calls.push("insertDecision");
      decisions.push(d);
      return `dec${decisions.length}`;
    },
    insertScheduledSendReturningId: async (s) => {
      calls.push("insertScheduledSendReturningId");
      sends.push(s);
      return `send${sends.length}`;
    },
    readPriors: async () => {
      calls.push("readPriors");
      return opts.priors ?? [];
    },
    upsertPriors: async () => {},
    listUnscoredDecisions: async () => [],
    scoreDecision: async () => {},
    listConnectedWithoutFirstMessage: async () => [],
    insertLeadNotification: async (n) => {
      calls.push("insertLeadNotification");
      notifications.push({ kind: n.kind, body: n.body, leadId: n.leadId });
    },
    cancelPendingSends: async (leadId) => {
      calls.push("cancelPendingSends");
      canceled.push(leadId);
      return 0;
    },
    stopSequenceForReply: async (leadId) => {
      calls.push("stopSequenceForReply");
      stopped.push(leadId);
    },
    isSuppressed: async (_a, _k, value) => {
      calls.push("isSuppressed");
      suppressionChecks.push(value);
      return !!opts.suppressed;
    },
    getLeadLinkedInUrl: async () => "https://www.linkedin.com/in/Ryan-C/",
  };
  return {
    store,
    calls,
    saves,
    decisions,
    sends,
    notifications,
    canceled,
    stopped,
    suppressionChecks,
    get stored() {
      return stored;
    },
  };
}

/** Mock brains: readFn keys a readout off the turn ref; shortlist picks `pick` when legal. */
function makeDeps(
  fake: ReturnType<typeof makeStore>,
  o: {
    readouts?: Record<string, Readout>;
    pick?: Move;
    message?: string;
    violations?: ConversationDraft["violations"];
    fixFn?: ConversationDecideDeps["fixFn"];
    shortlist?: (input: PolicyInput) => Shortlist;
  } = {}
) {
  const readFn = vi.fn(async (_s: ConversationState, t: StoredTurn, _g: string) => o.readouts?.[t.ref] ?? readout());
  const shortlistFn = vi.fn(async (input: PolicyInput): Promise<Shortlist> => {
    if (o.shortlist) return o.shortlist(input);
    const move = o.pick && input.legal.includes(o.pick) ? o.pick : input.legal[0];
    return move
      ? { candidates: [{ move, style: { lengthBand: "short", question: false, link: "none", mirror: false }, rationale: "fits" }] }
      : { candidates: [], degraded: "no_legal_candidates" };
  });
  const composeFn = vi.fn(async (): Promise<ConversationDraft> => ({
    message: o.message ?? `Fair — grab a slot if useful: ${BOOKING}`,
    violations: o.violations ?? [],
  }));
  const deps: ConversationDecideDeps = {
    store: fake.store,
    readFn: readFn as unknown as ConversationDecideDeps["readFn"],
    shortlistFn: shortlistFn as unknown as ConversationDecideDeps["shortlistFn"],
    composeFn: composeFn as unknown as ConversationDecideDeps["composeFn"],
    fixFn: o.fixFn,
    now: () => NOW,
    rng: () => 0.5,
    seed: () => 42,
  };
  return { deps, readFn, shortlistFn, composeFn };
}

const replyTrigger = (r: Readout = readout({ intent: "answers_question" }), incoming = "Mostly by hand."): ConversationTrigger => ({
  kind: "reply",
  replyId: "r1",
  incoming,
  receivedAt: new Date("2026-10-28T14:00:00Z"),
  readout: r,
});

const args = (trigger: ConversationTrigger, mode: "shadow" | "live_replies" | "live" = "live", b = bundle()) => ({
  accountId: ACC,
  leadId: LEAD,
  campaignId: CAMP,
  trigger,
  mode,
  bundle: b,
  sellerName: "Acme",
});

// ---------------------------------------------------------------------------

describe("guardrails", () => {
  it("the rulebook's TURN_CAP equals the pipeline's MAX_AGENT_TURNS", () => {
    expect(TURN_CAP).toBe(MAX_AGENT_TURNS);
  });
});

describe("syncState", () => {
  it("syncState reads unread turns in order and persists lastMessageRef", async () => {
    const turns = [
      ...BASE_TURNS,
      turn("m3", "agent", "Got it — what breaks first when volume spikes?", "2026-10-28T14:30:00Z"),
      turn("m4", "lead", "Response time.", "2026-10-28T14:40:00Z"),
    ];
    const stored = { state: emptyState(), lastMessageRef: "m2" };
    const fake = makeStore({ turns, stored });
    const { deps, readFn } = makeDeps(fake);
    const b = bundle();

    const state = await syncState(ACC, LEAD, b.lead, b.insights, "GROUNDING", deps);

    expect(readFn.mock.calls.map((c) => (c[1] as StoredTurn).ref)).toEqual(["m3", "m4"]);
    expect(readFn.mock.calls[0]![2]).toBe("GROUNDING");
    expect(fake.saves.at(-1)!.lastMessageRef).toBe("m4");
    expect(state.counters.agentTurns).toBe(1);
    expect(state.counters.leadTurns).toBe(1);

    // idempotent: a repeat sync reads nothing new and leaves the state as it was
    const again = await syncState(ACC, LEAD, b.lead, b.insights, "GROUNDING", deps);
    expect(readFn).toHaveBeenCalledTimes(2);
    expect(again).toEqual(state);
    expect(fake.stored!.lastMessageRef).toBe("m4");
  });

  it("seeds from the lead when no state exists and reads every turn", async () => {
    const fake = makeStore();
    const { deps, readFn } = makeDeps(fake);
    const b = bundle();
    const state = await syncState(ACC, LEAD, b.lead, b.insights, "G", deps);
    expect(readFn).toHaveBeenCalledTimes(2);
    expect(state.person.seniority).toBe("vp"); // seedState from "VP Sales"
    expect(fake.saves.at(-1)!.lastMessageRef).toBe("m2");
  });

  it("an unknown lastMessageRef is a backfill: every turn is read", async () => {
    const fake = makeStore({ stored: { state: emptyState(), lastMessageRef: "gone" } });
    const { deps, readFn } = makeDeps(fake);
    const b = bundle();
    await syncState(ACC, LEAD, b.lead, b.insights, "G", deps);
    expect(readFn).toHaveBeenCalledTimes(2);
  });
});

describe("runConversationDecide", () => {
  it("a double-message is read as two turns and answered once", async () => {
    const turns = [
      ...BASE_TURNS,
      turn("m3", "lead", "Actually also,", "2026-10-28T14:01:00Z"),
      turn("m4", "lead", "we tried a tool last year and it flopped", "2026-10-28T14:01:30Z"),
    ];
    const fake = makeStore({ turns, stored: { state: emptyState(), lastMessageRef: "m2" } });
    const { deps, readFn, composeFn } = makeDeps(fake, { pick: "acknowledge", readouts: { m4: readout({ stance: "skeptical", intent: "objects" }) } });

    const out = await runConversationDecide(
      args(replyTrigger(readout({ stance: "skeptical", intent: "objects" }), "Actually also,\nwe tried a tool last year and it flopped")),
      deps
    );

    expect(readFn.mock.calls.map((c) => (c[1] as StoredTurn).ref)).toEqual(["m3", "m4"]);
    expect(fake.stored!.state.counters.leadTurns).toBe(2);
    expect(composeFn).toHaveBeenCalledTimes(1);
    expect(fake.sends).toHaveLength(1);
    expect(fake.decisions).toHaveLength(1);
    expect(out.action).toBe("drafted");
  });

  it("shadow mode logs the decision with no send and composes nothing", async () => {
    const fake = makeStore();
    const { deps, composeFn } = makeDeps(fake, { pick: "answer" });

    const out = await runConversationDecide(args(replyTrigger(readout({ intent: "asks_question" })), "shadow"), deps);

    expect(out).toEqual({ action: "skipped", reason: "shadow", decisionId: "dec1", move: "answer" });
    expect(composeFn).not.toHaveBeenCalled();
    expect(fake.sends).toHaveLength(0);
    expect(fake.canceled).toHaveLength(0);
    expect(fake.decisions[0]).toMatchObject({
      mode: "shadow",
      scheduledSendId: null,
      composedBody: null,
      move: "answer",
      trigger: "reply",
      seed: 42,
      policyVersion: POLICY_VERSION,
      promptHash: POLICY_SYSTEM.hash,
    });
  });

  it("live: a drafted reply gets origin reply_response, a notBefore ≥ 4 min, the booking link tagged via tagLinksInText, and the decision links the send", async () => {
    const fake = makeStore();
    const { deps, composeFn } = makeDeps(fake, { pick: "answer" });

    const out = await runConversationDecide(args(replyTrigger(readout({ intent: "asks_question" }), "How does it work?")), deps);

    expect(out).toEqual({ action: "drafted", decisionId: "dec1", move: "answer" });
    expect(composeFn).toHaveBeenCalledTimes(1);
    const input = composeFn.mock.calls[0]![0 as never] as unknown as { incoming?: string; sellerName: string | null; decision: { move: Move }; avoidSkeletons: string[] };
    expect(input.incoming).toBe("How does it work?");
    expect(input.sellerName).toBe("Acme");
    expect(input.decision.move).toBe("answer");
    expect(input.avoidSkeletons).toEqual([]);

    expect(fake.canceled).toEqual([LEAD]);
    expect(fake.calls.indexOf("cancelPendingSends")).toBeLessThan(fake.calls.indexOf("insertScheduledSendReturningId"));
    const send = fake.sends[0]!;
    expect(send).toMatchObject({
      accountId: ACC,
      campaignId: CAMP,
      leadId: LEAD,
      channel: "linkedin",
      linkedinStage: "message",
      origin: "reply_response",
      status: "approved",
      styleFlags: null,
    });
    expect(send.body).toBe(`Fair — grab a slot if useful: ${BOOKING}?utm_content=vt-lead1&metadata%5Bvt%5D=vt-lead1`);
    expect(send.notBefore!.getTime() - NOW.getTime()).toBeGreaterThanOrEqual(REPLY_DELAY_MIN_MS);
    // TODO(Task 12): recipe v3 carries move + decisionId; for now the v2 stamp names the brain
    expect(send.recipe).toMatchObject({
      v: 2,
      brain: "conversation_reply",
      playbookVersion: 3,
      promptHash: COMPOSE_SYSTEM.hash,
      modelId: getModelId(),
    });
    expect(fake.decisions[0]).toMatchObject({
      mode: "live",
      scheduledSendId: "send1",
      composedBody: send.body,
      move: "answer",
    });
    expect(fake.calls.indexOf("insertScheduledSendReturningId")).toBeLessThan(fake.calls.indexOf("insertDecision"));
    // the acted move is remembered for the repeat guards; the read cursor is untouched
    expect(fake.stored!.state.lastMove).toEqual({ move: "answer", at: NOW.toISOString() });
    expect(fake.stored!.lastMessageRef).toBe("m2");
  });

  it("shadow and wait never stamp lastMove", async () => {
    const fake = makeStore();
    const { deps } = makeDeps(fake, { pick: "answer" });
    await runConversationDecide(args(replyTrigger(readout({ intent: "asks_question" })), "shadow"), deps);
    expect(fake.stored!.state.lastMove).toBeNull();
    const fake2 = makeStore();
    const { deps: d2 } = makeDeps(fake2, { pick: "wait" });
    await runConversationDecide(args(replyTrigger(readout({ intent: "small_talk" }))), d2);
    expect(fake2.stored!.state.lastMove).toBeNull();
  });

  it("review mode / flagged drafts wait in review; automatic gets one fix pass", async () => {
    const flagged = [{ rule: "pitch-word", detail: "x" }] as unknown as ConversationDraft["violations"];
    const fake = makeStore();
    const fixFn = vi.fn(async (d: ConversationDraft) => ({ ...d, violations: flagged }));
    const { deps } = makeDeps(fake, { pick: "answer", violations: flagged, fixFn });
    await runConversationDecide(args(replyTrigger(readout({ intent: "asks_question" }))), deps);
    expect(fixFn).toHaveBeenCalledTimes(1);
    expect(fake.sends[0]!.status).toBe("pending_review");
    expect(fake.sends[0]!.styleFlags).not.toBeNull();

    const fake2 = makeStore();
    const fix2 = vi.fn();
    const { deps: d2 } = makeDeps(fake2, { pick: "answer", fixFn: fix2 as never });
    await runConversationDecide(args(replyTrigger(readout({ intent: "asks_question" })), "live", bundle({ sendMode: "review" })), d2);
    expect(fix2).not.toHaveBeenCalled();
    expect(fake2.sends[0]!.status).toBe("pending_review");
  });

  it("live: wait logs a decision and inserts nothing", async () => {
    const fake = makeStore();
    const { deps, composeFn } = makeDeps(fake, { pick: "wait" });
    const out = await runConversationDecide(args(replyTrigger(readout({ intent: "small_talk" }))), deps);
    expect(out).toEqual({ action: "wait", decisionId: "dec1", move: "wait" });
    expect(composeFn).not.toHaveBeenCalled();
    expect(fake.sends).toHaveLength(0);
    expect(fake.canceled).toHaveLength(0);
    expect(fake.decisions[0]).toMatchObject({ move: "wait", scheduledSendId: null, composedBody: null, mode: "live" });
  });

  it("wait is a legal answer to small talk and is chosen when the shortlist says so", async () => {
    const fake = makeStore();
    const { deps, shortlistFn } = makeDeps(fake, { pick: "wait" });
    const out = await runConversationDecide(args(replyTrigger(readout({ intent: "small_talk", stance: "positive" }), "haha nice, happy friday")), deps);
    const input = shortlistFn.mock.calls[0]![0] as PolicyInput;
    expect(input.legal).toContain("wait");
    expect(input.incoming).toBe("haha nice, happy friday");
    expect(input.trigger).toBe("reply");
    // priors rendered for every legal move from the posteriors
    expect(input.priors.map((p) => p.move).sort()).toEqual([...input.legal].sort());
    for (const p of input.priors) expect(p.rate).toBeGreaterThan(0);
    expect(out.action).toBe("wait");
  });

  it("identity suspicion hands off: needs_human notification, no draft", async () => {
    const fake = makeStore();
    const { deps, composeFn, shortlistFn } = makeDeps(fake, { pick: "answer" });
    const out = await runConversationDecide(args(replyTrigger(readout({ identitySuspicion: true, intent: "asks_question" }), "is this a bot?")), deps);
    expect((shortlistFn.mock.calls[0]![0] as PolicyInput).legal).toEqual(["hand_to_human"]);
    expect(out).toEqual({ action: "hand_to_human", decisionId: "dec1", move: "hand_to_human" });
    expect(composeFn).not.toHaveBeenCalled();
    expect(fake.sends).toHaveLength(0);
    expect(fake.notifications).toEqual([
      { kind: "needs_human", body: "This thread needs you — the agent stepped aside.", leadId: LEAD },
    ]);
  });

  it("an empty shortlist hands to a human instead of throwing", async () => {
    const fake = makeStore();
    const { deps } = makeDeps(fake, { shortlist: () => ({ candidates: [], degraded: "no_legal_candidates" }) });
    const out = await runConversationDecide(args(replyTrigger()), deps);
    expect(out.action).toBe("hand_to_human");
    expect(fake.notifications).toHaveLength(1);
    expect(fake.decisions[0]).toMatchObject({ move: "hand_to_human", degraded: "no_legal_candidates" });
  });

  it("graceful_exit on a reply stops the sequence", async () => {
    const fake = makeStore();
    const { deps } = makeDeps(fake, { pick: "graceful_exit", message: "Totally fair — I'll leave it there." });
    const out = await runConversationDecide(
      args(replyTrigger(readout({ stance: "negative", confidence: 0.9, intent: "declines" }), "not for us")),
      deps
    );
    expect(out).toEqual({ action: "exit", decisionId: "dec1", move: "graceful_exit" });
    expect(fake.sends).toHaveLength(1);
    expect(fake.stopped).toEqual([LEAD]);
  });

  it("followup trigger with isLast=true can only breakup or wait", async () => {
    const fake = makeStore({ turns: [BASE_TURNS[0]!] });
    const { deps, shortlistFn } = makeDeps(fake, { pick: "breakup", message: "Closing the loop here — all the best." });
    const out = await runConversationDecide(args({ kind: "followup", runId: "run1", touchNo: 3, isLast: true }), deps);
    const input = shortlistFn.mock.calls[0]![0] as PolicyInput;
    expect(input.legal.every((m) => m === "breakup" || m === "wait")).toBe(true);
    expect(input.readout).toBeUndefined();
    expect(out).toEqual({ action: "drafted", decisionId: "dec1", move: "breakup" });
    const send = fake.sends[0]!;
    expect(send.origin).toBe("sequence");
    expect(send.notBefore ?? null).toBeNull();
    expect(send.recipe).toMatchObject({ brain: "sequence_followup" });
    expect(fake.canceled).toHaveLength(0);
    expect(fake.stopped).toHaveLength(0);
  });

  it("first_message uses the first-touch brain and origin sequence", async () => {
    const fake = makeStore({ turns: [] });
    const { deps, composeFn } = makeDeps(fake, { pick: "observe", message: "Saw the Series A news." });
    const out = await runConversationDecide(args({ kind: "first_message" }), deps);
    expect(out.action).toBe("drafted");
    const input = composeFn.mock.calls[0]![0 as never] as unknown as { incoming?: string };
    expect(input.incoming).toBeUndefined();
    expect(fake.sends[0]).toMatchObject({ origin: "sequence", recipe: { brain: "first_touch" } });
  });

  it("suppressed lead ⇒ skipped before any model call (rule 11)", async () => {
    const fake = makeStore({ suppressed: true });
    const { deps, readFn, shortlistFn, composeFn } = makeDeps(fake);
    const out = await runConversationDecide(args(replyTrigger()), deps);
    expect(out).toEqual({ action: "skipped", reason: "suppressed", decisionId: null, move: null });
    expect(fake.suppressionChecks).toEqual(["https://www.linkedin.com/in/ryan-c"]);
    expect(readFn).not.toHaveBeenCalled();
    expect(shortlistFn).not.toHaveBeenCalled();
    expect(composeFn).not.toHaveBeenCalled();
    expect(fake.decisions).toHaveLength(0);
    expect(fake.sends).toHaveLength(0);
  });
});
