import { describe, expect, it, vi } from "vitest";
import { InMemoryLinkedInInfra } from "@vantera/linkedin-infra";
import type { ReplyVerdict } from "@vantera/agent-brains";
import { runInbound } from "./inbound";
import type { InboundDeps, InboundStore, NewScheduledSend, ResponderBundle } from "./types";

// ---------------------------------------------------------------------------
// Fake store — records calls for assertions
// ---------------------------------------------------------------------------

function makeStore(overrides: Partial<InboundStore> = {}): InboundStore & {
  replies: Parameters<InboundStore["insertReply"]>[0][];
  savedProviderRefs: { leadId: string; providerRef: string }[];
  classifications: { replyId: string; verdict: ReplyVerdict }[];
  suppressions: Parameters<InboundStore["addSuppression"]>[];
  connectedLeads: { leadId: string; at: Date }[];
  repliedLeads: { leadId: string; campaignId: string | null }[];
  canceledSends: string[];
  revivedRuns: { leadId: string; nextActionAt: Date }[];
  upsertedLinkedInStatuses: Parameters<InboundStore["upsertLinkedInAccountStatus"]>[0][];
  stoppedSequences: string[];
  notifications: Parameters<InboundStore["insertLeadNotification"]>[0][];
  bookedMeetings: { leadId: string; at: Date }[];
  scheduledSends: NewScheduledSend[];
} {
  let replyCounter = 0;
  const replies: Parameters<InboundStore["insertReply"]>[0][] = [];
  const classifications: { replyId: string; verdict: ReplyVerdict }[] = [];
  const suppressions: Parameters<InboundStore["addSuppression"]>[] = [];
  const connectedLeads: { leadId: string; at: Date }[] = [];
  const repliedLeads: { leadId: string; campaignId: string | null }[] = [];
  const canceledSends: string[] = [];
  const upsertedLinkedInStatuses: Parameters<InboundStore["upsertLinkedInAccountStatus"]>[0][] = [];
  const stoppedSequences: string[] = [];
  const notifications: Parameters<InboundStore["insertLeadNotification"]>[0][] = [];
  const bookedMeetings: { leadId: string; at: Date }[] = [];
  const scheduledSends: NewScheduledSend[] = [];

  const savedProviderRefs: { leadId: string; providerRef: string }[] = [];
  const revivedRuns: { leadId: string; nextActionAt: Date }[] = [];
  const base: InboundStore = {
    findLinkedInAccountByProviderRef: async () => null,
    upsertLinkedInAccountStatus: async (e) => {
      upsertedLinkedInStatuses.push(e);
      return { supersededRefs: [] };
    },
    findLeadByLinkedInUrl: async () => null,
    findLeadByProviderRef: async () => null,
    findContactedLeadsByName: async () => [],
    saveLeadProviderRef: async (leadId, providerRef) => {
      savedProviderRefs.push({ leadId, providerRef });
    },
    insertReply: async (r) => {
      replies.push(r);
      return { id: `reply_${++replyCounter}`, created: true };
    },
    setReplyClassification: async (replyId, verdict) => {
      classifications.push({ replyId, verdict });
    },
    addSuppression: async (...args) => { suppressions.push(args); },
    setLeadConnected: async (leadId, at) => { connectedLeads.push({ leadId, at }); },
    setLeadReplied: async (leadId, campaignId) => { repliedLeads.push({ leadId, campaignId }); },
    markMeetingBooked: async (leadId, at) => { bookedMeetings.push({ leadId, at }); },
    cancelPendingSends: async (leadId) => { canceledSends.push(leadId); return 0; },
    stopSequenceForReply: async (leadId) => { stoppedSequences.push(leadId); },
    reviveSequenceRun: async (leadId, nextActionAt) => { revivedRuns.push({ leadId, nextActionAt }); },
    insertLeadNotification: async (n) => { notifications.push(n); },
    // Responder defaults to OFF: no bundle ⇒ a reply is only classified + notified (prior behavior).
    getResponderBundle: async () => null,
    insertScheduledSend: async (send) => { scheduledSends.push(send); },
    ...overrides,
  };

  return Object.assign(base, {
    replies,
    revivedRuns,
    classifications,
    suppressions,
    connectedLeads,
    repliedLeads,
    canceledSends,
    upsertedLinkedInStatuses,
    stoppedSequences,
    notifications,
    bookedMeetings,
    scheduledSends,
    savedProviderRefs,
  });
}

// ---------------------------------------------------------------------------
// Fixtures — raw provider payloads (exercising the parse path via the real fake)
// ---------------------------------------------------------------------------

const LINKEDIN_ACCOUNT_REF = "li_acct_001";
const NORMALIZED_URL = "https://linkedin.com/in/prospect-smith";

const LINKEDIN_REPLY_FIXTURE = {
  event_id: "li_evt_001",
  connected_account: LINKEDIN_ACCOUNT_REF,
  event_type: "reply",
  from_profile_url: "https://LinkedIn.com/in/Prospect-Smith/",
  body: "Not interested thanks.",
  received_at: "2026-06-12T10:05:00.000Z",
};

const LINKEDIN_ACCEPTED_FIXTURE = {
  event_id: "li_evt_002",
  connected_account: LINKEDIN_ACCOUNT_REF,
  event_type: "relationship_accepted",
  profile_url: "https://LinkedIn.com/in/New-Connection/",
};

const LINKEDIN_ACCOUNT_STATUS_FIXTURE = {
  event_id: "li_evt_003",
  connected_account: LINKEDIN_ACCOUNT_REF,
  event_type: "account_status",
  status: "active",
  profile_url: "https://linkedin.com/in/user-profile",
  display_name: "Alice Smith",
  metadata_account_id: "acc_tenant_001",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const linkedinInfra = new InMemoryLinkedInInfra();

function classify(
  classification: ReplyVerdict["classification"],
  booked = false
): InboundDeps["classifyFn"] {
  return async () => ({ classification, rationale: "test stub", booked });
}

function deps(store: InboundStore, extra?: Partial<InboundDeps>): InboundDeps {
  return {
    store,
    linkedinInfra,
    classifyFn: classify("interested"),
    // minutes after the reply fixtures' received_at — keeps replies "fresh" for the responder
    now: () => new Date("2026-06-12T10:06:00.000Z"),
    ...extra,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("runInbound — LinkedIn reply: interested", () => {
  it("logs + marks replied + notifies, but does NOT cancel sends or stop the sequence (nurtures until closed)", async () => {
    const store = makeStore({
      findLinkedInAccountByProviderRef: async () => ({ id: "li_id_1", accountId: "acc1" }),
      findLeadByLinkedInUrl: async (_accountId, url) =>
        url === NORMALIZED_URL ? { id: "lead1", campaignId: "camp1" } : null,
    });

    const result = await runInbound(
      { source: "linkedin", payload: LINKEDIN_REPLY_FIXTURE },
      deps(store, { classifyFn: classify("interested") })
    );

    expect(result).toEqual({ handled: true, action: "reply:interested" });
    expect(store.replies).toHaveLength(1);
    expect(store.replies[0]!.leadId).toBe("lead1");
    expect(store.replies[0]!.channel).toBe("linkedin");
    expect(store.classifications).toHaveLength(1);
    expect(store.classifications[0]!.verdict.classification).toBe("interested");
    // a genuine reply no longer halts outbound — the sequence keeps nurturing until close
    expect(store.canceledSends).toHaveLength(0);
    expect(store.stoppedSequences).toHaveLength(0);
    expect(store.repliedLeads.map((r) => r.leadId)).toContain("lead1");
    expect(store.notifications).toHaveLength(1);
    expect(store.suppressions).toHaveLength(0);
  });
});

describe("runInbound — meeting booked (funnel writer)", () => {
  function storeForLead() {
    return makeStore({
      findLinkedInAccountByProviderRef: async () => ({ id: "li_id_1", accountId: "acc1" }),
      findLeadByLinkedInUrl: async (_accountId, url) =>
        url === NORMALIZED_URL ? { id: "lead1", campaignId: "camp1" } : null,
    });
  }

  it("stamps meeting_booked_at when an interested reply confirms a scheduled meeting", async () => {
    const fixedNow = new Date("2026-06-12T12:00:00.000Z");
    const store = storeForLead();

    await runInbound(
      { source: "linkedin", payload: LINKEDIN_REPLY_FIXTURE },
      deps(store, { classifyFn: classify("interested", true), now: () => fixedNow })
    );

    expect(store.bookedMeetings).toEqual([{ leadId: "lead1", at: fixedNow }]);
  });

  it("does not stamp meeting_booked_at on an ordinary interested reply", async () => {
    const store = storeForLead();

    await runInbound(
      { source: "linkedin", payload: LINKEDIN_REPLY_FIXTURE },
      deps(store, { classifyFn: classify("interested", false) })
    );

    expect(store.bookedMeetings).toHaveLength(0);
  });

  it("never stamps a booking on a hard-negative reply, even if booked is set", async () => {
    const store = storeForLead();

    await runInbound(
      { source: "linkedin", payload: LINKEDIN_REPLY_FIXTURE },
      deps(store, { classifyFn: classify("not_interested", true) })
    );

    expect(store.bookedMeetings).toHaveLength(0);
  });
});

describe("runInbound — LinkedIn reply: not_interested", () => {
  it("matched via normalizeLinkedInUrl, suppression kind 'linkedin' with leadId", async () => {
    const store = makeStore({
      findLinkedInAccountByProviderRef: async () => ({ id: "li_id_1", accountId: "acc2" }),
      findLeadByLinkedInUrl: async (_accountId, url) =>
        url === NORMALIZED_URL ? { id: "lead7", campaignId: "camp2" } : null,
    });

    const result = await runInbound(
      { source: "linkedin", payload: LINKEDIN_REPLY_FIXTURE },
      deps(store, { classifyFn: classify("not_interested") })
    );

    expect(result).toEqual({ handled: true, action: "reply:not_interested" });
    expect(store.replies).toHaveLength(1);
    expect(store.replies[0]!.channel).toBe("linkedin");
    expect(store.classifications[0]!.verdict.classification).toBe("not_interested");
    expect(store.canceledSends).toContain("lead7");
    expect(store.repliedLeads.map((r) => r.leadId)).toContain("lead7");
    expect(store.suppressions).toHaveLength(1);
    const [accountId, kind, value, source, leadId] = store.suppressions[0]!;
    expect(accountId).toBe("acc2");
    expect(kind).toBe("linkedin");
    expect(value).toBe(NORMALIZED_URL); // normalized (lowercased, trailing slash stripped)
    expect(source).toBe("not_interested");
    expect(leadId).toBe("lead7");
  });
});

describe("runInbound — LinkedIn reply: unsubscribe classification", () => {
  it("adds suppression with source unsubscribe", async () => {
    const store = makeStore({
      findLinkedInAccountByProviderRef: async () => ({ id: "li_id_1", accountId: "acc2" }),
      findLeadByLinkedInUrl: async () => ({ id: "lead3", campaignId: null }),
    });

    await runInbound(
      { source: "linkedin", payload: LINKEDIN_REPLY_FIXTURE },
      deps(store, { classifyFn: classify("unsubscribe") })
    );

    expect(store.suppressions).toHaveLength(1);
    expect(store.suppressions[0]![3]).toBe("unsubscribe");
  });
});

describe("runInbound — LinkedIn reply: out_of_office", () => {
  it("stores + classifies reply but does NOT cancel sends, mark replied, or suppress", async () => {
    const store = makeStore({
      findLinkedInAccountByProviderRef: async () => ({ id: "li_id_1", accountId: "acc2" }),
      findLeadByLinkedInUrl: async () => ({ id: "lead4", campaignId: "camp1" }),
    });

    const result = await runInbound(
      { source: "linkedin", payload: LINKEDIN_REPLY_FIXTURE },
      deps(store, { classifyFn: classify("out_of_office") })
    );

    expect(result).toEqual({ handled: true, action: "reply:out_of_office" });
    expect(store.replies).toHaveLength(1);
    expect(store.classifications).toHaveLength(1);
    expect(store.canceledSends).toHaveLength(0);
    expect(store.repliedLeads).toHaveLength(0);
    expect(store.suppressions).toHaveLength(0);
  });
});

describe("runInbound — unknown linkedin identity / no lead", () => {
  it("unknown identity → handled false, zero store writes", async () => {
    const store = makeStore({
      findLinkedInAccountByProviderRef: async () => null,
    });
    const insertReplySpy = vi.fn();
    (store as unknown as Record<string, unknown>).insertReply = insertReplySpy;

    const result = await runInbound(
      { source: "linkedin", payload: LINKEDIN_REPLY_FIXTURE },
      deps(store)
    );

    expect(result).toEqual({ handled: false, action: "unknown linkedin identity" });
    expect(insertReplySpy).not.toHaveBeenCalled();
    expect(store.suppressions).toHaveLength(0);
  });

  it("no matching lead → handled false, no reply written", async () => {
    const store = makeStore({
      findLinkedInAccountByProviderRef: async () => ({ id: "li_id_1", accountId: "acc2" }),
      findLeadByLinkedInUrl: async () => null,
    });

    const result = await runInbound(
      { source: "linkedin", payload: LINKEDIN_REPLY_FIXTURE },
      deps(store)
    );

    expect(result).toEqual({ handled: false, action: "no matching lead" });
    expect(store.replies).toHaveLength(0);
  });
});

describe("runInbound — relationship_accepted", () => {
  it("calls setLeadConnected with leadId and now", async () => {
    const fixedNow = new Date("2026-06-12T12:00:00.000Z");
    const store = makeStore({
      findLinkedInAccountByProviderRef: async () => ({ id: "li_id_1", accountId: "acc2" }),
      findLeadByLinkedInUrl: async () => ({ id: "lead8", campaignId: null }),
    });

    const result = await runInbound(
      { source: "linkedin", payload: LINKEDIN_ACCEPTED_FIXTURE },
      deps(store, { now: () => fixedNow })
    );

    expect(result).toEqual({ handled: true, action: "relationship_accepted" });
    expect(store.connectedLeads).toHaveLength(1);
    expect(store.connectedLeads[0]!.leadId).toBe("lead8");
    expect(store.connectedLeads[0]!.at).toEqual(fixedNow);
  });
});

describe("runInbound — account_status", () => {
  it("with vanteraAccountId → calls upsertLinkedInAccountStatus", async () => {
    const store = makeStore();

    const result = await runInbound(
      { source: "linkedin", payload: LINKEDIN_ACCOUNT_STATUS_FIXTURE },
      deps(store)
    );

    expect(result).toEqual({ handled: true, action: "account:active" });
    expect(store.upsertedLinkedInStatuses).toHaveLength(1);
    const upserted = store.upsertedLinkedInStatuses[0]!;
    expect(upserted.vanteraAccountId).toBe("acc_tenant_001");
    expect(upserted.providerRef).toBe(LINKEDIN_ACCOUNT_REF);
    expect(upserted.status).toBe("active");
    expect(upserted.profileUrl).toBe("https://linkedin.com/in/user-profile");
    expect(upserted.displayName).toBe("Alice Smith");
  });

  it("without vanteraAccountId → handled false, no writes", async () => {
    const store = makeStore();
    const noTenantFixture = {
      ...LINKEDIN_ACCOUNT_STATUS_FIXTURE,
      metadata_account_id: undefined,
    };

    const result = await runInbound(
      { source: "linkedin", payload: noTenantFixture },
      deps(store)
    );

    expect(result).toEqual({ handled: false, action: "account event without tenant" });
    expect(store.upsertedLinkedInStatuses).toHaveLength(0);
  });

  it("an identity merge deletes the superseded provider seats (best-effort billing cleanup)", async () => {
    const store = makeStore({
      upsertLinkedInAccountStatus: async () => ({ supersededRefs: ["old_dead_ref", "dup_ref"] }),
    });
    const infra = new InMemoryLinkedInInfra();

    const result = await runInbound(
      { source: "linkedin", payload: LINKEDIN_ACCOUNT_STATUS_FIXTURE },
      { ...deps(store), linkedinInfra: infra }
    );

    expect(result).toEqual({ handled: true, action: "account:active+merged" });
    expect(infra.disconnected.sort()).toEqual(["dup_ref", "old_dead_ref"]);
  });

  it("a failing provider delete never fails the status event", async () => {
    const store = makeStore({
      upsertLinkedInAccountStatus: async () => ({ supersededRefs: ["old_dead_ref"] }),
    });
    const infra = Object.assign(new InMemoryLinkedInInfra(), {
      deleteConnectedAccount: async () => {
        throw new Error("provider down");
      },
    });

    const result = await runInbound(
      { source: "linkedin", payload: LINKEDIN_ACCOUNT_STATUS_FIXTURE },
      { ...deps(store), linkedinInfra: infra }
    );

    expect(result.handled).toBe(true); // the sweep cleans up later
  });
});

describe("runInbound — sequence stop gate (stop on close, not on reply)", () => {
  function storeForLead() {
    return makeStore({
      findLinkedInAccountByProviderRef: async () => ({ id: "li_id_1", accountId: "acc1" }),
      findLeadByLinkedInUrl: async () => ({ id: "lead-id", campaignId: "camp1" }),
    });
  }

  // A reply that is NOT a hard-negative keeps the sequence nurturing toward close:
  // no stop, no cancel — only logged + marked replied + notified.
  for (const classification of ["interested", "neutral", "other"] as const) {
    it(`keeps the sequence running on a ${classification} reply (notifies, does not stop or cancel)`, async () => {
      const store = storeForLead();

      await runInbound(
        { source: "linkedin", payload: LINKEDIN_REPLY_FIXTURE },
        deps(store, { classifyFn: classify(classification) })
      );

      expect(store.stoppedSequences).toHaveLength(0);
      expect(store.canceledSends).toHaveLength(0);
      expect(store.repliedLeads.map((r) => r.leadId)).toContain("lead-id");
      expect(store.notifications).toHaveLength(1);
      expect(store.notifications[0]).toEqual(
        expect.objectContaining({ accountId: "acc1", leadId: "lead-id", kind: "reply" })
      );
    });
  }

  // Hard-negatives terminate outbound: stop the run + cancel queued sends + suppress.
  for (const classification of ["not_interested", "unsubscribe"] as const) {
    it(`stops the sequence + cancels queued sends on a ${classification} reply`, async () => {
      const store = storeForLead();

      await runInbound(
        { source: "linkedin", payload: LINKEDIN_REPLY_FIXTURE },
        deps(store, { classifyFn: classify(classification) })
      );

      expect(store.stoppedSequences).toContain("lead-id");
      expect(store.canceledSends).toContain("lead-id");
      expect(store.suppressions).toHaveLength(1);
      expect(store.suppressions[0]![3]).toBe(classification);
      expect(store.notifications).toHaveLength(1);
    });
  }

  it("does NOT stop, cancel, or notify on an out_of_office reply", async () => {
    const store = storeForLead();

    await runInbound(
      { source: "linkedin", payload: LINKEDIN_REPLY_FIXTURE },
      deps(store, { classifyFn: classify("out_of_office") })
    );

    expect(store.stoppedSequences).toHaveLength(0);
    expect(store.canceledSends).toHaveLength(0);
    expect(store.notifications).toHaveLength(0);
  });
});

describe("runInbound — active responder (converse to close)", () => {
  const bundle = (over: Partial<ResponderBundle> = {}): ResponderBundle => ({
    campaignId: "camp1",
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
    context: { cta: "a quick intro" },
    thread: [],
    agentTurns: 0,
    newestUnsentMessageCreatedAt: null,
    lastAgentMessageAt: null,
    humanHandled: false,
    attribution: { experimentId: null, variant: null },
    ...over,
  });

  function storeWithBundle(b: ResponderBundle | null) {
    return makeStore({
      findLinkedInAccountByProviderRef: async () => ({ id: "li", accountId: "acc1" }),
      findLeadByLinkedInUrl: async () => ({ id: "lead1", campaignId: "camp1" }),
      getResponderBundle: async () => b,
    });
  }

  const respond = (
    message = "Here's the short version — worth a quick look?",
    violations: unknown[] = []
  ): InboundDeps["respondFn"] =>
    async () => ({ message, violations: violations as never });

  it("drafts + queues a contextual reply (automatic → approved) and supersedes any scripted touch", async () => {
    const store = storeWithBundle(bundle({ sendMode: "automatic" }));

    const result = await runInbound(
      { source: "linkedin", payload: LINKEDIN_REPLY_FIXTURE },
      deps(store, { classifyFn: classify("interested"), respondFn: respond() })
    );

    expect(result).toEqual({ handled: true, action: "reply:interested+responded" });
    expect(store.scheduledSends).toHaveLength(1);
    expect(store.scheduledSends[0]).toMatchObject({
      accountId: "acc1",
      campaignId: "camp1",
      leadId: "lead1",
      channel: "linkedin",
      linkedinStage: "message",
      status: "approved",
      body: "Here's the short version — worth a quick look?",
      styleFlags: null,
    });
    expect(store.canceledSends).toContain("lead1"); // contextual reply replaces the scripted touch
  });

  it("stamps the contextual reply with a conversation_reply recipe carrying the lead's arm (Stage 1)", async () => {
    const store = storeWithBundle(
      bundle({ attribution: { experimentId: "exp-9", variant: "champion" } })
    );

    await runInbound(
      { source: "linkedin", payload: LINKEDIN_REPLY_FIXTURE },
      deps(store, { classifyFn: classify("interested"), respondFn: respond() })
    );

    expect(store.scheduledSends[0]!.recipe).toEqual({
      v: 1,
      brain: "conversation_reply",
      strategy: {},
      experimentId: "exp-9",
      variant: "champion",
      playbookVersion: null,
      exemplars: 0,
    });
  });

  it("queues for review (pending_review) when the agent is in review mode", async () => {
    const store = storeWithBundle(bundle({ sendMode: "review" }));

    await runInbound(
      { source: "linkedin", payload: LINKEDIN_REPLY_FIXTURE },
      deps(store, { classifyFn: classify("neutral"), respondFn: respond() })
    );

    expect(store.scheduledSends[0]!.status).toBe("pending_review");
  });

  it("forces review on a style-flagged draft even in automatic mode (never silent-sends flagged copy)", async () => {
    const store = storeWithBundle(bundle({ sendMode: "automatic" }));

    await runInbound(
      { source: "linkedin", payload: LINKEDIN_REPLY_FIXTURE },
      deps(store, { respondFn: respond("salesy", [{ rule: "buzzword", detail: "game-changer" }]) })
    );

    expect(store.scheduledSends[0]!.status).toBe("pending_review");
    expect(store.scheduledSends[0]!.styleFlags).toBeTruthy();
  });

  it("automatic mode: a flagged reply gets one fix pass, and a clean fix auto-sends the fixed body", async () => {
    const store = storeWithBundle(bundle({ sendMode: "automatic" }));
    const fixFn = vi.fn(async () => ({ message: "clean rewrite", violations: [] }));

    await runInbound(
      { source: "linkedin", payload: LINKEDIN_REPLY_FIXTURE },
      {
        ...deps(store, { respondFn: respond("salesy", [{ rule: "buzzword", detail: "game-changer" }]) }),
        fixReplyFn: fixFn,
      }
    );

    expect(fixFn).toHaveBeenCalledOnce();
    expect(store.scheduledSends[0]).toMatchObject({ status: "approved", body: "clean rewrite", styleFlags: null });
  });

  it("automatic mode: a still-flagged fix waits in review (never silent-sends)", async () => {
    const store = storeWithBundle(bundle({ sendMode: "automatic" }));
    const fixFn = vi.fn(async () => ({
      message: "still salesy",
      violations: [{ rule: "buzzword", detail: "seamless" }],
    }));

    await runInbound(
      { source: "linkedin", payload: LINKEDIN_REPLY_FIXTURE },
      {
        ...deps(store, { respondFn: respond("salesy", [{ rule: "buzzword", detail: "game-changer" }]) }),
        fixReplyFn: fixFn,
      }
    );

    expect(store.scheduledSends[0]!.status).toBe("pending_review");
    expect(store.scheduledSends[0]!.styleFlags).toBeTruthy();
  });

  it("review mode: the fix pass is not spent — flags go straight to the queue's Fix button", async () => {
    const store = storeWithBundle(bundle({ sendMode: "review" }));
    const fixFn = vi.fn(async () => ({ message: "unused", violations: [] }));

    await runInbound(
      { source: "linkedin", payload: LINKEDIN_REPLY_FIXTURE },
      {
        ...deps(store, { respondFn: respond("salesy", [{ rule: "buzzword", detail: "game-changer" }]) }),
        fixReplyFn: fixFn,
      }
    );

    expect(fixFn).not.toHaveBeenCalled();
    expect(store.scheduledSends[0]!.status).toBe("pending_review");
  });

  it("stands down when a HUMAN has taken over the thread (manual reply) — never re-engages", async () => {
    // A human replied from the lead's page → the run is paused_reply (humanHandled). A later
    // prospect reply must NOT trigger the bot: it classifies + notifies, never auto-drafts, and
    // does NOT emit the turn-cap needs_human note (that's for capped BOT threads, not human ones).
    const store = storeWithBundle(bundle({ humanHandled: true, sendMode: "automatic" }));

    const result = await runInbound(
      { source: "linkedin", payload: LINKEDIN_REPLY_FIXTURE },
      deps(store, { classifyFn: classify("interested"), respondFn: respond() })
    );

    expect(result.action).toBe("reply:interested"); // classified + notified, not "+responded"
    expect(store.scheduledSends).toHaveLength(0);
    expect(store.canceledSends).toHaveLength(0);
    expect(store.notifications.some((n) => n.kind === "needs_human")).toBe(false);
  });

  it("stops responding past the converse-to-close turn cap — and hands off LOUDLY (needs_human)", async () => {
    const store = storeWithBundle(bundle({ agentTurns: 6 }));

    const result = await runInbound(
      { source: "linkedin", payload: LINKEDIN_REPLY_FIXTURE },
      deps(store, { respondFn: respond() })
    );

    expect(result.action).toBe("reply:interested");
    expect(store.scheduledSends).toHaveLength(0);
    expect(store.notifications.some((n) => n.kind === "needs_human")).toBe(true);
  });

  it("queues the response on the speed lane (origin reply_response)", async () => {
    const store = storeWithBundle(bundle({ sendMode: "automatic" }));

    await runInbound(
      { source: "linkedin", payload: LINKEDIN_REPLY_FIXTURE },
      deps(store, { classifyFn: classify("interested"), respondFn: respond() })
    );

    expect(store.scheduledSends[0]!.origin).toBe("reply_response");
  });

  it("does not double-message when a response NEWER than this reply is already queued/in-flight", async () => {
    // fixture reply received 10:05:00 — a draft from 10:05:30 already answers it
    const store = storeWithBundle(
      bundle({ newestUnsentMessageCreatedAt: new Date("2026-06-12T10:05:30.000Z") })
    );

    await runInbound(
      { source: "linkedin", payload: LINKEDIN_REPLY_FIXTURE },
      deps(store, { respondFn: respond() })
    );

    expect(store.scheduledSends).toHaveLength(0);
    expect(store.canceledSends).toHaveLength(0); // the newer draft IS the answer — keep it
  });

  it("supersedes a queued draft OLDER than the reply (drafted blind) — cancels it and responds", async () => {
    // a scripted touch drafted at 09:00 can't know what the lead said at 10:05: replace it
    const store = storeWithBundle(
      bundle({ newestUnsentMessageCreatedAt: new Date("2026-06-12T09:00:00.000Z") })
    );

    const result = await runInbound(
      { source: "linkedin", payload: LINKEDIN_REPLY_FIXTURE },
      deps(store, { respondFn: respond() })
    );

    expect(result.action).toBe("reply:interested+responded");
    expect(store.canceledSends).toContain("lead1");
    expect(store.scheduledSends).toHaveLength(1);
  });

  it("never auto-answers a stale reply (replay/backfill artifact) — classifies and notifies only", async () => {
    const store = storeWithBundle(bundle());

    const result = await runInbound(
      { source: "linkedin", payload: LINKEDIN_REPLY_FIXTURE },
      // reply received 2026-06-12; processed four days later (well past the freshness window)
      deps(store, { respondFn: respond(), now: () => new Date("2026-06-16T10:06:00.000Z") })
    );

    expect(result.action).toBe("reply:interested");
    expect(store.scheduledSends).toHaveLength(0);
    expect(store.notifications).toHaveLength(1);
  });

  it("stays silent when there is no live Outreach agent / no insights (null bundle)", async () => {
    const store = storeWithBundle(null);

    const result = await runInbound(
      { source: "linkedin", payload: LINKEDIN_REPLY_FIXTURE },
      deps(store, { respondFn: respond() })
    );

    expect(result.action).toBe("reply:interested");
    expect(store.scheduledSends).toHaveLength(0);
  });

  it("never keeps selling after a booked meeting (the win) — books, does not respond", async () => {
    const store = storeWithBundle(bundle());

    await runInbound(
      { source: "linkedin", payload: LINKEDIN_REPLY_FIXTURE },
      deps(store, { classifyFn: classify("interested", true), respondFn: respond() })
    );

    expect(store.bookedMeetings).toHaveLength(1);
    expect(store.scheduledSends).toHaveLength(0);
  });

  for (const c of ["not_interested", "unsubscribe"] as const) {
    it(`never responds to a ${c} reply (terminal)`, async () => {
      const store = storeWithBundle(bundle());

      await runInbound(
        { source: "linkedin", payload: LINKEDIN_REPLY_FIXTURE },
        deps(store, { classifyFn: classify(c), respondFn: respond() })
      );

      expect(store.scheduledSends).toHaveLength(0);
    });
  }
});

describe("runInbound — junk payloads", () => {
  it("linkedin junk payload → handled false, no writes", async () => {
    const store = makeStore();

    const result = await runInbound(
      { source: "linkedin", payload: null },
      deps(store)
    );

    expect(result).toEqual({ handled: false, action: "unparseable" });
    expect(store.replies).toHaveLength(0);
    expect(store.suppressions).toHaveLength(0);
  });
});

// ── Layered lead matching (0043) — provider id first, URL, public slug, unique name ─────
describe("runInbound — layered lead matching", () => {
  const PROVIDER_URL_FIXTURE = {
    event_id: "li_evt_prov_1",
    connected_account: LINKEDIN_ACCOUNT_REF,
    event_type: "reply",
    // the real webhook shape: profile URL is the /in/<provider_id> form, never the vanity slug
    from_profile_url: "https://www.linkedin.com/in/ACoAA_PROSPECT",
    from_provider_ref: "ACoAA_PROSPECT",
    from_name: "Prospect Smith",
    body: "Yes sure",
    received_at: "2026-07-05T15:09:15.246Z",
  };

  it("matches by provider ref when the URL match misses (the prod zero-replies bug)", async () => {
    const store = makeStore({
      findLinkedInAccountByProviderRef: async () => ({ id: "li_id_1", accountId: "acc1" }),
      findLeadByLinkedInUrl: async () => null, // vanity URL on the lead ≠ provider-id URL in the event
      findLeadByProviderRef: async (_acc, ref) =>
        ref === "ACoAA_PROSPECT" ? { id: "lead1", campaignId: "camp1" } : null,
    });

    const result = await runInbound(
      { source: "linkedin", payload: PROVIDER_URL_FIXTURE },
      deps(store, { classifyFn: classify("interested") })
    );

    expect(result.handled).toBe(true);
    expect(store.replies).toHaveLength(1);
    expect(store.repliedLeads).toEqual([{ leadId: "lead1", campaignId: "camp1" }]);
    // the strong key is (re)stamped on every successful match
    expect(store.savedProviderRefs).toEqual([{ leadId: "lead1", providerRef: "ACoAA_PROSPECT" }]);
  });

  it("falls back to a UNIQUE contacted-lead name match and backfills the provider ref", async () => {
    const store = makeStore({
      findLinkedInAccountByProviderRef: async () => ({ id: "li_id_1", accountId: "acc1" }),
      findLeadByLinkedInUrl: async () => null,
      findLeadByProviderRef: async () => null, // lead contacted before 0043 — no ref stored yet
      findContactedLeadsByName: async (_acc, name) =>
        name === "Prospect Smith" ? [{ id: "lead1", campaignId: "camp1" }] : [],
    });

    const result = await runInbound(
      { source: "linkedin", payload: PROVIDER_URL_FIXTURE },
      deps(store, { classifyFn: classify("interested") })
    );

    expect(result.handled).toBe(true);
    expect(store.savedProviderRefs).toEqual([{ leadId: "lead1", providerRef: "ACoAA_PROSPECT" }]);
  });

  it("never matches an AMBIGUOUS name (two contacted leads share it)", async () => {
    const store = makeStore({
      findLinkedInAccountByProviderRef: async () => ({ id: "li_id_1", accountId: "acc1" }),
      findLeadByLinkedInUrl: async () => null,
      findLeadByProviderRef: async () => null,
      findContactedLeadsByName: async () => [
        { id: "lead1", campaignId: null },
        { id: "lead2", campaignId: null },
      ],
    });

    const result = await runInbound(
      { source: "linkedin", payload: PROVIDER_URL_FIXTURE },
      deps(store, { classifyFn: classify("interested") })
    );

    expect(result).toEqual({ handled: false, action: "no matching lead" });
    expect(store.replies).toHaveLength(0);
  });

  it("matches by the public vanity slug when the payload carries one", async () => {
    const store = makeStore({
      findLinkedInAccountByProviderRef: async () => ({ id: "li_id_1", accountId: "acc1" }),
      findLeadByLinkedInUrl: async (_acc, url) =>
        url === "https://www.linkedin.com/in/prospect-smith" ? { id: "lead1", campaignId: null } : null,
      findLeadByProviderRef: async () => null,
    });

    const result = await runInbound(
      {
        source: "linkedin",
        payload: { ...PROVIDER_URL_FIXTURE, from_public_identifier: "Prospect-Smith" },
      },
      deps(store, { classifyFn: classify("interested") })
    );

    expect(result.handled).toBe(true);
    expect(store.repliedLeads).toEqual([{ leadId: "lead1", campaignId: null }]);
  });

  it("short-circuits a duplicate reply (provider retry / replay) — no double effects", async () => {
    const store = makeStore({
      findLinkedInAccountByProviderRef: async () => ({ id: "li_id_1", accountId: "acc1" }),
      findLeadByLinkedInUrl: async () => null,
      findLeadByProviderRef: async () => ({ id: "lead1", campaignId: null }),
      insertReply: async () => ({ id: "existing_reply", created: false }),
    });

    const result = await runInbound(
      { source: "linkedin", payload: PROVIDER_URL_FIXTURE },
      deps(store, { classifyFn: classify("interested") })
    );

    expect(result).toEqual({ handled: true, action: "reply:duplicate" });
    expect(store.classifications).toHaveLength(0);
    expect(store.repliedLeads).toHaveLength(0);
    expect(store.notifications).toHaveLength(0);
  });

  it("stores the provider message id on the reply (the idempotency key)", async () => {
    const store = makeStore({
      findLinkedInAccountByProviderRef: async () => ({ id: "li_id_1", accountId: "acc1" }),
      findLeadByProviderRef: async () => ({ id: "lead1", campaignId: null }),
      findLeadByLinkedInUrl: async () => null,
    });

    await runInbound(
      { source: "linkedin", payload: PROVIDER_URL_FIXTURE },
      deps(store, { classifyFn: classify("interested") })
    );

    expect(store.replies[0]?.providerMessageRef).toBe("li_evt_prov_1");
  });
});

describe("runInbound — conversation cadence + speed lane (0044)", () => {
  function storeForLead() {
    return makeStore({
      findLinkedInAccountByProviderRef: async () => ({ id: "li_id_1", accountId: "acc1" }),
      findLeadByLinkedInUrl: async (_a, url) => (url === NORMALIZED_URL ? { id: "lead1", campaignId: "camp1" } : null),
    });
  }

  it("a respondable reply revives the lead's run on the conversation clock", async () => {
    const store = storeForLead();
    await runInbound(
      { source: "linkedin", payload: LINKEDIN_REPLY_FIXTURE },
      deps(store, { classifyFn: classify("interested") })
    );
    expect(store.revivedRuns).toHaveLength(1);
    expect(store.revivedRuns[0]!.leadId).toBe("lead1");
    // nudge lands ~2 days out (the conversation gap), not on the cold cadence
    const gapMs = store.revivedRuns[0]!.nextActionAt.getTime() - new Date("2026-06-12T10:06:00.000Z").getTime();
    expect(gapMs).toBe(2 * 86_400_000);
  });

  it("hard negatives and booked wins never revive the run", async () => {
    const store = storeForLead();
    await runInbound(
      { source: "linkedin", payload: LINKEDIN_REPLY_FIXTURE },
      deps(store, { classifyFn: classify("not_interested") })
    );
    expect(store.revivedRuns).toHaveLength(0);

    const store2 = storeForLead();
    await runInbound(
      { source: "linkedin", payload: LINKEDIN_REPLY_FIXTURE },
      deps(store2, { classifyFn: classify("interested", true) })
    );
    expect(store2.revivedRuns).toHaveLength(0);
  });
});

describe("lifecycle sender interception (0045)", () => {
  const SENDER = "unipile:founder";
  const lifecycleDeps = (over: Partial<import("./types").InboundLifecycleHooks> = {}) => ({
    senderRef: SENDER,
    recordReply: vi.fn(async () => ({ userId: "u1", displayName: "Sara Bright" })),
    recordAcceptance: vi.fn(async () => true),
    notifyReply: vi.fn(async () => {}),
    ...over,
  });

  const replyPayload = {
    event_id: "ev1",
    event_type: "reply",
    connected_account: SENDER,
    from_profile_url: "https://www.linkedin.com/in/sara",
    from_provider_ref: "ACoAA-sara",
    body: "hey! yes let's talk",
    received_at: "2026-07-09T15:00:00.000Z",
  };

  it("a reply on the founder identity stops the sequence and notifies the founder", async () => {
    const lifecycle = lifecycleDeps();
    // the intercepted path never touches the store — an empty stub proves it
    const summary = await runInbound(
      { source: "linkedin", payload: replyPayload },
      {
        store: {} as never,
        linkedinInfra: new InMemoryLinkedInInfra(),
        classifyFn: vi.fn(),
        lifecycle,
      } as never
    );
    expect(summary).toEqual({ handled: true, action: "lifecycle:reply" });
    expect(lifecycle.recordReply).toHaveBeenCalledWith(
      { providerRef: "ACoAA-sara", profileUrl: "https://www.linkedin.com/in/sara" },
      expect.any(Date)
    );
    expect(lifecycle.notifyReply).toHaveBeenCalledWith("Sara Bright", "hey! yes let's talk");
  });

  it("an acceptance on the founder identity opens the DM gate", async () => {
    const lifecycle = lifecycleDeps();
    const summary = await runInbound(
      {
        source: "linkedin",
        payload: {
          event_id: "ev2",
          event_type: "relationship_accepted",
          connected_account: SENDER,
          profile_url: "https://www.linkedin.com/in/sara",
          from_provider_ref: "ACoAA-sara",
        },
      },
      { store: {} as never, linkedinInfra: new InMemoryLinkedInInfra(), classifyFn: vi.fn(), lifecycle } as never
    );
    expect(summary).toEqual({ handled: true, action: "lifecycle:accepted" });
  });

  it("an unmatched sender event falls through to the tenant path", async () => {
    const lifecycle = lifecycleDeps({ recordReply: vi.fn(async () => null) });
    const store = { findLinkedInAccountByProviderRef: vi.fn(async () => null) };
    const summary = await runInbound(
      { source: "linkedin", payload: replyPayload },
      { store: store as never, linkedinInfra: new InMemoryLinkedInInfra(), classifyFn: vi.fn(), lifecycle } as never
    );
    expect(store.findLinkedInAccountByProviderRef).toHaveBeenCalledWith(SENDER);
    expect(summary.action).toBe("unknown linkedin identity");
  });

  it("a notify failure never blocks the stop-on-reply write", async () => {
    const lifecycle = lifecycleDeps({ notifyReply: vi.fn(async () => { throw new Error("smtp down"); }) });
    const summary = await runInbound(
      { source: "linkedin", payload: replyPayload },
      { store: {} as never, linkedinInfra: new InMemoryLinkedInInfra(), classifyFn: vi.fn(), lifecycle } as never
    );
    expect(summary.action).toBe("lifecycle:reply");
  });

  it("events on other identities are untouched by the lifecycle hooks", async () => {
    const lifecycle = lifecycleDeps();
    const store = { findLinkedInAccountByProviderRef: vi.fn(async () => null) };
    await runInbound(
      { source: "linkedin", payload: { ...replyPayload, connected_account: "unipile:customer" } },
      { store: store as never, linkedinInfra: new InMemoryLinkedInInfra(), classifyFn: vi.fn(), lifecycle } as never
    );
    expect(lifecycle.recordReply).not.toHaveBeenCalled();
  });
});
