import { describe, expect, it, vi } from "vitest";
import type {
  ComposeInput,
  ConversationDraft,
  ConversationState,
  PolicyInput,
  Readout,
  Shortlist,
  StoredTurn,
} from "@vantera/agent-brains";
import type { ConversationDecideDeps } from "./conversation-decide";
import { runFirstMessage, type FirstMessageDeps } from "./first-message";
import type { ConversationMode, NewDecision, NewScheduledSend, ResponderBundle } from "./types";

const NOW = new Date("2026-10-28T15:00:00Z");
const NOTE_HOOK = { kind: "trigger" as const, text: "the Series A" };

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
  campaignId: "camp1",
  sendMode: "review",
  lead: { firstName: "Ryan", lastName: "C", title: "VP Sales", companyName: "Northwind", industry: "SaaS" },
  insights: {
    pain_points: ["unqualified leads"],
    triggers: ["Series A"],
    motivations: ["pipeline"],
    value_angle: "qualify first",
    aha_moment: "first booked meeting",
    summary: "good fit",
  },
  context: { cta: "a quick intro", accountName: "Acme" },
  thread: [],
  agentTurns: 0,
  newestUnsentMessageCreatedAt: null,
  lastAgentMessageAt: null,
  humanHandled: false,
  attribution: { strategy: {}, playbookVersion: 2 },
  ...over,
});

const NOTE_TURN: StoredTurn = { ref: "inv1", role: "agent", text: "Saw the Series A, Ryan.", at: "2026-10-27T10:00:00Z" };

type Row = { accountId: string; leadId: string; campaignId: string };

function makeFake(opts: {
  rows?: Row[];
  bundles?: Record<string, ResponderBundle | null>;
  turns?: Record<string, StoredTurn[]>;
  suppressed?: Set<string>;
} = {}) {
  const rows = opts.rows ?? [{ accountId: "acc1", leadId: "lead1", campaignId: "camp1" }];
  const states = new Map<string, { state: ConversationState; lastMessageRef: string | null }>();
  const decisions: NewDecision[] = [];
  const sends: NewScheduledSend[] = [];
  const bundleCalls: string[] = [];
  let scans = 0;
  const store: FirstMessageDeps["store"] = {
    getConversationPolicyMode: async () => "live",
    getConversationState: async (_a, leadId) => {
      const s = states.get(leadId);
      return s ? { state: structuredClone(s.state), lastMessageRef: s.lastMessageRef } : null;
    },
    saveConversationState: async (_a, leadId, state, lastMessageRef) => {
      states.set(leadId, { state: structuredClone(state), lastMessageRef });
    },
    listThreadTurns: async (_a, leadId) => opts.turns?.[leadId] ?? [NOTE_TURN],
    insertDecision: async (d) => {
      decisions.push(d);
      return d.id ?? `dec${decisions.length}`;
    },
    insertScheduledSendReturningId: async (s) => {
      sends.push(s);
      return `send${sends.length}`;
    },
    readPriors: async () => [],
    upsertPriors: async () => {},
    listUnscoredDecisions: async () => [],
    scoreDecision: async () => {},
    listConnectedWithoutFirstMessage: async () => {
      scans += 1;
      return rows;
    },
    getDraftableLead: async () => null,
    getResponderBundle: async (_a, leadId) => {
      bundleCalls.push(leadId);
      return opts.bundles && leadId in opts.bundles ? opts.bundles[leadId]! : bundle();
    },
    isSuppressed: async (_a, _k, value) => opts.suppressed?.has(value) ?? false,
    getLeadLinkedInUrl: async (_a, leadId) => `https://linkedin.com/in/${leadId}`,
    insertScheduledSend: async (s) => {
      sends.push(s);
    },
    stopSequenceRun: async () => {},
    insertLeadNotification: async () => {},
    cancelPendingSends: async () => 0,
    stopSequenceForReply: async () => {},
  };
  return {
    store,
    decisions,
    sends,
    bundleCalls,
    get scans() {
      return scans;
    },
  };
}

function makeDecide(fake: ReturnType<typeof makeFake>, pick: "observe" | "wait" | "hand_to_human" = "observe") {
  const readFn = vi.fn(async (_s: ConversationState, t: StoredTurn) =>
    t.ref === NOTE_TURN.ref ? readout({ hookUsed: NOTE_HOOK }) : readout()
  );
  const shortlistFn = vi.fn(async (input: PolicyInput): Promise<Shortlist> => {
    // an empty shortlist is how the core reaches hand_to_human ("no legal move fits")
    if (pick === "hand_to_human") return { candidates: [], degraded: "no_legal_candidates" };
    const move = input.legal.includes(pick) ? pick : input.legal[0]!;
    return { candidates: [{ move, style: { lengthBand: "short", question: true, link: "none", mirror: false }, rationale: "fits" }] };
  });
  const composeFn = vi.fn(async (_i: ComposeInput): Promise<ConversationDraft> => ({
    message: "Congrats on the round. How are you qualifying inbound now?",
    violations: [],
  }));
  const decide: ConversationDecideDeps = {
    store: fake.store,
    readFn: readFn as unknown as ConversationDecideDeps["readFn"],
    shortlistFn: shortlistFn as unknown as ConversationDecideDeps["shortlistFn"],
    composeFn: composeFn as unknown as ConversationDecideDeps["composeFn"],
    now: () => NOW,
    rng: () => 0.5,
    seed: () => 42,
  };
  return { decide, readFn, shortlistFn, composeFn };
}

const run = (fake: ReturnType<typeof makeFake>, decide: ConversationDecideDeps, mode: ConversationMode = "live") =>
  runFirstMessage({ store: fake.store, decide, mode, now: () => NOW });

describe("runFirstMessage", () => {
  it("first-message: a connected lead with no message row gets a first_message decision; hooksUsed carries the note's hook", async () => {
    const fake = makeFake();
    const { decide, composeFn, shortlistFn } = makeDecide(fake);

    const out = await run(fake, decide);

    expect(out).toEqual({ scanned: 1, drafted: 1, waited: 0, skipped: 0, handedOff: 0 });
    expect(shortlistFn.mock.calls[0]![0].trigger).toBe("first_message");
    expect(fake.decisions).toHaveLength(1);
    expect(fake.decisions[0]).toMatchObject({ trigger: "first_message", mode: "live", leadId: "lead1" });
    expect(fake.sends).toHaveLength(1);
    expect(fake.sends[0]).toMatchObject({ linkedinStage: "message", origin: "sequence", leadId: "lead1", status: "pending_review" });
    expect(fake.sends[0]!.recipe?.brain).toBe("first_touch");
    const state = composeFn.mock.calls[0]![0].state;
    expect(state.memory.hooksUsed).toEqual([{ ...NOTE_HOOK, messageRef: NOTE_TURN.ref }]);
  });

  it("first-message: a lead whose invite was canceled 'already connected' gets a first message with no note hook", async () => {
    const fake = makeFake({ turns: { lead1: [] } });
    const { decide, composeFn, readFn } = makeDecide(fake);

    const out = await run(fake, decide);

    expect(out.drafted).toBe(1);
    expect(readFn).not.toHaveBeenCalled();
    expect(composeFn.mock.calls[0]![0].state.memory.hooksUsed).toEqual([]);
    expect(fake.sends).toHaveLength(1);
  });

  it("first-message: mode shadow logs only; nothing inserted", async () => {
    const fake = makeFake();
    const { decide, composeFn } = makeDecide(fake);

    const out = await run(fake, decide, "shadow");

    expect(out).toEqual({ scanned: 1, drafted: 0, waited: 0, skipped: 1, handedOff: 0 });
    expect(fake.decisions).toHaveLength(1);
    expect(fake.decisions[0]).toMatchObject({ mode: "shadow", trigger: "first_message", scheduledSendId: null });
    expect(composeFn).not.toHaveBeenCalled();
    expect(fake.sends).toHaveLength(0);
  });

  it("first-message: live_replies never sends a proactive first message (logged as shadow)", async () => {
    const fake = makeFake();
    const { decide } = makeDecide(fake);

    await run(fake, decide, "live_replies");

    expect(fake.decisions[0]?.mode).toBe("shadow");
    expect(fake.sends).toHaveLength(0);
  });

  it("first-message: mode off returns zeros without querying", async () => {
    const fake = makeFake();
    const { decide, shortlistFn } = makeDecide(fake);

    const out = await run(fake, decide, "off");

    expect(out).toEqual({ scanned: 0, drafted: 0, waited: 0, skipped: 0, handedOff: 0 });
    expect(fake.scans).toBe(0);
    expect(shortlistFn).not.toHaveBeenCalled();
  });

  it("first-message: skipped when a human handled the thread or the lead spoke last", async () => {
    const fake = makeFake({
      rows: [
        { accountId: "acc1", leadId: "human", campaignId: "camp1" },
        { accountId: "acc1", leadId: "leadlast", campaignId: "camp1" },
        { accountId: "acc1", leadId: "nobundle", campaignId: "camp1" },
      ],
      bundles: {
        human: bundle({ humanHandled: true }),
        leadlast: bundle({ thread: [{ role: "agent", text: "note" }, { role: "lead", text: "Thanks for connecting!" }] }),
        nobundle: null,
      },
    });
    const { decide, shortlistFn } = makeDecide(fake);

    const out = await run(fake, decide);

    expect(out).toEqual({ scanned: 3, drafted: 0, waited: 0, skipped: 3, handedOff: 0 });
    expect(shortlistFn).not.toHaveBeenCalled();
    expect(fake.decisions).toHaveLength(0);
    expect(fake.sends).toHaveLength(0);
  });

  it("first-message: a suppressed lead is skipped before any bundle is built (rule 11)", async () => {
    const fake = makeFake({ suppressed: new Set(["https://linkedin.com/in/lead1"]) });
    const { decide, readFn, shortlistFn } = makeDecide(fake);

    const out = await run(fake, decide);

    expect(out.skipped).toBe(1);
    expect(fake.bundleCalls).toEqual([]);
    expect(readFn).not.toHaveBeenCalled();
    expect(shortlistFn).not.toHaveBeenCalled();
    expect(fake.sends).toHaveLength(0);
  });

  it("first-message: a lead listed twice in one scan is decided once", async () => {
    const row = { accountId: "acc1", leadId: "lead1", campaignId: "camp1" };
    const fake = makeFake({ rows: [row, { ...row }] });
    const { decide } = makeDecide(fake);

    const out = await run(fake, decide);

    expect(out.scanned).toBe(2);
    expect(out.drafted).toBe(1);
    expect(fake.sends).toHaveLength(1);
    expect(fake.bundleCalls).toEqual(["lead1"]);
  });

  it("first-message: a retry with an unsent message already queued drafts nothing new", async () => {
    const fake = makeFake({ bundles: { lead1: bundle({ newestUnsentMessageCreatedAt: new Date("2026-10-28T14:00:00Z") }) } });
    const { decide } = makeDecide(fake);

    const out = await run(fake, decide);

    expect(out).toEqual({ scanned: 1, drafted: 0, waited: 0, skipped: 1, handedOff: 0 });
    expect(fake.sends).toHaveLength(0);
  });

  it("first-message: tallies wait and hand_to_human outcomes", async () => {
    const waitFake = makeFake();
    expect(await run(waitFake, makeDecide(waitFake, "wait").decide)).toMatchObject({ waited: 1, drafted: 0 });
    const handFake = makeFake();
    expect(await run(handFake, makeDecide(handFake, "hand_to_human").decide)).toMatchObject({ handedOff: 1, drafted: 0 });
    expect(handFake.sends).toHaveLength(0);
  });
});
