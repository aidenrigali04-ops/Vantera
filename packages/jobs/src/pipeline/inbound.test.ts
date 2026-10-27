import { describe, expect, it, vi } from "vitest";
import { InMemoryLinkedInInfra } from "@vantera/linkedin-infra";
import {
  RESPOND_SYSTEM,
  leadBlock,
  type ConversationMessageInput,
  type JudgeFn,
  type ReplyVerdict,
} from "@vantera/agent-brains";
import { getModelId } from "@vantera/ai";
import { handleLinkedInEvent, runInbound } from "./inbound";
import { MAX_BEST_OF_N } from "./copy-draft";
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
  takeovers: { accountId: string; leadId: string; campaignId: string | null }[];
  nativeMessages: Parameters<InboundStore["insertNativeMessage"]>[0][];
  bundleRequests: { leadId: string; opts?: { excludeReplyId?: string } }[];
  /** ordered log of effect calls — proves the classification marker is written LAST */
  effects: string[];
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
  const takeovers: { accountId: string; leadId: string; campaignId: string | null }[] = [];
  const nativeMessages: Parameters<InboundStore["insertNativeMessage"]>[0][] = [];
  const bundleRequests: { leadId: string; opts?: { excludeReplyId?: string } }[] = [];
  const effects: string[] = [];
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
      // ingestion time defaults to the provider time — tests that care about webhook lag override it
      return { id: `reply_${++replyCounter}`, created: true, createdAt: r.receivedAt, classified: false };
    },
    setReplyClassification: async (replyId, verdict) => {
      effects.push("classify");
      classifications.push({ replyId, verdict });
    },
    getLeadLinkedInUrl: async () => null,
    isSuppressed: async () => false,
    isOwnOutboundMessage: async () => false,
    pauseForHumanTakeover: async (accountId, leadId, campaignId) => {
      takeovers.push({ accountId, leadId, campaignId });
    },
    insertNativeMessage: async (m) => {
      const created = !nativeMessages.some(
        (x) => x.accountId === m.accountId && x.providerMessageRef === m.providerMessageRef
      );
      if (created) nativeMessages.push(m);
      return { created };
    },
    addSuppression: async (...args) => { effects.push("suppress"); suppressions.push(args); },
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
  // every bundle read is recorded (incl. overridden ones) so tests can assert the exclusion opts
  const innerBundle = base.getResponderBundle;
  base.getResponderBundle = async (accountId, leadId, campaignId, opts) => {
    bundleRequests.push({ leadId, opts });
    return innerBundle(accountId, leadId, campaignId, opts);
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
    takeovers,
    nativeMessages,
    bundleRequests,
    effects,
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

  it("treats a booking as an EVENT: cancels queued sends, stops the sequence, notifies (L1)", async () => {
    const store = storeForLead();

    await runInbound(
      { source: "linkedin", payload: LINKEDIN_REPLY_FIXTURE },
      deps(store, { classifyFn: classify("interested", true) })
    );

    expect(store.canceledSends).toContain("lead1"); // no scripted nudge after "I booked"
    expect(store.stoppedSequences).toContain("lead1");
    expect(store.notifications).toContainEqual(
      expect.objectContaining({ leadId: "lead1", kind: "meeting_booked" })
    );
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
    attribution: { strategy: {}, playbookVersion: null },
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

  it("tags the booking link in the queued reply so a booking attributes to this lead (ML-6)", async () => {
    const store = storeWithBundle(bundle({ context: { cta: "a quick intro", bookingUrl: "https://calendly.com/acme/intro" } }));
    await runInbound(
      { source: "linkedin", payload: LINKEDIN_REPLY_FIXTURE },
      deps(store, { classifyFn: classify("interested"), respondFn: respond("Grab a slot: https://calendly.com/acme/intro") })
    );
    expect(store.scheduledSends[0]!.body).toBe("Grab a slot: https://calendly.com/acme/intro?utm_content=vt-lead1&metadata%5Bvt%5D=vt-lead1");
  });

  it("stamps the contextual reply with a conversation_reply recipe (Stage 1)", async () => {
    const store = storeWithBundle(
      bundle({ attribution: { strategy: {}, playbookVersion: null } })
    );

    await runInbound(
      { source: "linkedin", payload: LINKEDIN_REPLY_FIXTURE },
      deps(store, { classifyFn: classify("interested"), respondFn: respond() })
    );

    expect(store.scheduledSends[0]!.recipe).toEqual({
      v: 2,
      brain: "conversation_reply",
      strategy: {},
      experimentId: null,
      variant: null,
      playbookVersion: null,
      exemplars: 0,
      promptHash: RESPOND_SYSTEM.hash,
      modelId: getModelId(),
    });
  });

  it("stamps the contextual reply with the resolved strategy + playbook version (WS-3.1)", async () => {
    const store = storeWithBundle(
      bundle({
        attribution: {
          strategy: { askStyle: "specific" },
          playbookVersion: 3,
        },
      })
    );

    await runInbound(
      { source: "linkedin", payload: LINKEDIN_REPLY_FIXTURE },
      deps(store, { classifyFn: classify("interested"), respondFn: respond() })
    );

    expect(store.scheduledSends[0]!.recipe).toMatchObject({
      strategy: { askStyle: "specific" },
      playbookVersion: 3,
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

// ── Phase 2C fast-follow: best-of-N judge-ranked reply selection ─────────────
describe("runInbound — active responder — best-of-N (off by default)", () => {
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
    attribution: { strategy: {}, playbookVersion: null },
    ...over,
  });

  function storeWithBundle(b: ResponderBundle | null) {
    return makeStore({
      findLinkedInAccountByProviderRef: async () => ({ id: "li", accountId: "acc1" }),
      findLeadByLinkedInUrl: async () => ({ id: "lead1", campaignId: "camp1" }),
      getResponderBundle: async () => b,
    });
  }

  it("no bestOfN config, no judgeFn: byte-identical to today — one respondFn call, no bestOfN key on the recipe", async () => {
    const store = storeWithBundle(bundle());
    const respondFn: InboundDeps["respondFn"] = vi.fn(async () => ({ message: "single reply", violations: [] }));

    await runInbound(
      { source: "linkedin", payload: LINKEDIN_REPLY_FIXTURE },
      deps(store, { classifyFn: classify("interested"), respondFn })
    );

    expect(respondFn).toHaveBeenCalledTimes(1);
    expect(store.scheduledSends[0]!.body).toBe("single reply");
    expect(store.scheduledSends[0]!.recipe).not.toHaveProperty("bestOfN");
  });

  it("bestOfN=5 configured but judgeFn absent: forced to n=1 — one respondFn call, no bestOfN stamp", async () => {
    const store = storeWithBundle(bundle());
    const respondFn: InboundDeps["respondFn"] = vi.fn(async () => ({ message: "single reply", violations: [] }));

    await runInbound(
      { source: "linkedin", payload: LINKEDIN_REPLY_FIXTURE },
      deps(store, { classifyFn: classify("interested"), respondFn, bestOfN: 5 })
    );

    expect(respondFn).toHaveBeenCalledTimes(1);
    expect(store.scheduledSends[0]!.recipe).not.toHaveProperty("bestOfN");
  });

  it("bestOfN=1 with a judgeFn wired: still exactly one respondFn call and zero judge calls", async () => {
    const store = storeWithBundle(bundle());
    const respondFn: InboundDeps["respondFn"] = vi.fn(async () => ({ message: "single reply", violations: [] }));
    const judgeFn = vi.fn<JudgeFn>();

    await runInbound(
      { source: "linkedin", payload: LINKEDIN_REPLY_FIXTURE },
      deps(store, { classifyFn: classify("interested"), respondFn, bestOfN: 1, judgeFn })
    );

    expect(respondFn).toHaveBeenCalledTimes(1);
    expect(judgeFn).not.toHaveBeenCalled();
    expect(store.scheduledSends[0]!.recipe).not.toHaveProperty("bestOfN");
  });

  it("bestOfN=3 + a judge: drafts 3 candidates, judges each on the SAME grounding/cta the humanizer uses, and stamps + queues the highest-scored one", async () => {
    const store = storeWithBundle(bundle());
    let call = 0;
    let capturedInput: ConversationMessageInput | undefined;
    const respondFn: InboundDeps["respondFn"] = vi.fn(async (input) => {
      capturedInput = input;
      call += 1;
      return { message: `reply-${call}`, violations: [] };
    });
    const scoreByMessage: Record<string, number> = { "reply-1": 2, "reply-2": 4, "reply-3": 3 };
    const seenContexts: { grounding: string; cta?: string }[] = [];
    const judgeFn: JudgeFn = vi.fn(async (draft, ctx) => {
      seenContexts.push(ctx);
      return { overall: scoreByMessage[draft.text]! };
    });

    await runInbound(
      { source: "linkedin", payload: LINKEDIN_REPLY_FIXTURE },
      deps(store, { classifyFn: classify("interested"), respondFn, bestOfN: 3, judgeFn })
    );

    expect(respondFn).toHaveBeenCalledTimes(3);
    expect(judgeFn).toHaveBeenCalledTimes(3);
    // reply-2 scored highest (4) — it's the one queued.
    expect(store.scheduledSends[0]!.body).toBe("reply-2");
    expect(store.scheduledSends[0]!.recipe).toMatchObject({ bestOfN: 3 });
    // the judge saw the exact same grounding block the humanizer/respond brain builds from this input.
    expect(capturedInput).toBeDefined();
    const expectedGrounding = leadBlock(capturedInput!);
    for (const ctx of seenContexts) {
      expect(ctx.grounding).toBe(expectedGrounding);
      expect(ctx.cta).toBe("a quick intro");
    }
  });

  it("caps the effective n at MAX_BEST_OF_N regardless of a larger configured value", async () => {
    const store = storeWithBundle(bundle());
    const respondFn: InboundDeps["respondFn"] = vi.fn(async () => ({ message: "reply", violations: [] }));
    const judgeFn: JudgeFn = vi.fn(async () => ({ overall: 3 }));

    await runInbound(
      { source: "linkedin", payload: LINKEDIN_REPLY_FIXTURE },
      deps(store, { classifyFn: classify("interested"), respondFn, bestOfN: 999, judgeFn })
    );

    expect(respondFn).toHaveBeenCalledTimes(MAX_BEST_OF_N);
    expect(judgeFn).toHaveBeenCalledTimes(MAX_BEST_OF_N);
    expect(store.scheduledSends[0]!.recipe).toMatchObject({ bestOfN: MAX_BEST_OF_N });
  });

  it("hard-negative replies never call respondFn/judgeFn even with best-of-N configured", async () => {
    const store = storeWithBundle(bundle());
    const respondFn: InboundDeps["respondFn"] = vi.fn(async () => ({ message: "unused", violations: [] }));
    const judgeFn: JudgeFn = vi.fn(async () => ({ overall: 5 }));

    await runInbound(
      { source: "linkedin", payload: LINKEDIN_REPLY_FIXTURE },
      deps(store, { classifyFn: classify("not_interested"), respondFn, bestOfN: 3, judgeFn })
    );

    expect(respondFn).not.toHaveBeenCalled();
    expect(judgeFn).not.toHaveBeenCalled();
    expect(store.scheduledSends).toHaveLength(0);
  });

  it("a judge-preferred candidate that's lint-dirty still gets ONE fix pass and routes to review if still dirty — the humanizer stays the hard floor", async () => {
    const store = storeWithBundle(bundle({ sendMode: "automatic" }));
    let call = 0;
    const respondFn: InboundDeps["respondFn"] = vi.fn(async () => {
      call += 1;
      return call === 2
        ? { message: "dirty reply", violations: [{ rule: "banned-phrase", detail: 'remove "game-changer"' }] }
        : { message: `clean reply ${call}`, violations: [] };
    });
    const judgeFn: JudgeFn = vi.fn(async (draft) => ({ overall: draft.text === "dirty reply" ? 5 : 1 }));
    const fixFn = vi.fn(async () => ({
      message: "still dirty",
      violations: [{ rule: "banned-phrase", detail: 'remove "seamless"' }],
    }));

    await runInbound(
      { source: "linkedin", payload: LINKEDIN_REPLY_FIXTURE },
      {
        ...deps(store, { classifyFn: classify("interested"), respondFn, bestOfN: 3, judgeFn }),
        fixReplyFn: fixFn,
      }
    );

    // the fix pass ran exactly once, on the CHOSEN (dirty) candidate — never on the clean ones.
    expect(fixFn).toHaveBeenCalledOnce();
    expect(fixFn).toHaveBeenCalledWith(expect.objectContaining({ message: "dirty reply" }), expect.anything());
    // still flagged after the fix ⇒ never silently approved, exactly like today's single-draft path.
    expect(store.scheduledSends[0]!.status).toBe("pending_review");
    expect(store.scheduledSends[0]!.body).toBe("still dirty");
    expect(store.scheduledSends[0]!.styleFlags).toBeTruthy();
  });

  it("a judge-preferred candidate that's lint-dirty auto-approves once the fix pass cleans it (automatic mode)", async () => {
    const store = storeWithBundle(bundle({ sendMode: "automatic" }));
    let call = 0;
    const respondFn: InboundDeps["respondFn"] = vi.fn(async () => {
      call += 1;
      return call === 2
        ? { message: "dirty reply", violations: [{ rule: "banned-phrase", detail: 'remove "game-changer"' }] }
        : { message: `clean reply ${call}`, violations: [] };
    });
    const judgeFn: JudgeFn = vi.fn(async (draft) => ({ overall: draft.text === "dirty reply" ? 5 : 1 }));
    const fixFn = vi.fn(async () => ({ message: "fixed reply", violations: [] }));

    await runInbound(
      { source: "linkedin", payload: LINKEDIN_REPLY_FIXTURE },
      {
        ...deps(store, { classifyFn: classify("interested"), respondFn, bestOfN: 3, judgeFn }),
        fixReplyFn: fixFn,
      }
    );

    expect(fixFn).toHaveBeenCalledOnce();
    expect(store.scheduledSends[0]!.status).toBe("approved");
    expect(store.scheduledSends[0]!.body).toBe("fixed reply");
    expect(store.scheduledSends[0]!.styleFlags).toBeNull();
  });
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
      insertReply: async (r) => ({ id: "existing_reply", created: false, createdAt: r.receivedAt, classified: true }),
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

// ── Audit fixes (conversation path, 2026-10) ────────────────────────────────────────────
describe("runInbound — opt-out suppression targets the lead's STORED url (rule 11)", () => {
  // The payload carries the provider-id URL form; every send-path check compares against the
  // lead's stored linkedin_url (vanity or ACwAA form). Suppressing only the payload URL left the
  // lead contactable. The fixtures here deliberately use DIFFERENT urls.
  const PAYLOAD = {
    event_id: "li_evt_optout",
    connected_account: LINKEDIN_ACCOUNT_REF,
    event_type: "reply",
    from_profile_url: "https://www.linkedin.com/in/ACoAA_PROSPECT",
    from_provider_ref: "ACoAA_PROSPECT",
    body: "please stop",
    received_at: "2026-06-12T10:05:00.000Z",
  };
  const STORED = "https://www.linkedin.com/in/Prospect-Vanity/";

  for (const classification of ["not_interested", "unsubscribe"] as const) {
    it(`a ${classification} reply suppresses the lead's stored url AND the payload url`, async () => {
      const store = makeStore({
        findLinkedInAccountByProviderRef: async () => ({ id: "li", accountId: "acc1" }),
        findLeadByProviderRef: async () => ({ id: "lead1", campaignId: "camp1" }),
        getLeadLinkedInUrl: async () => STORED,
      });

      await runInbound({ source: "linkedin", payload: PAYLOAD }, deps(store, { classifyFn: classify(classification) }));

      const values = store.suppressions.map((s) => s[2]);
      expect(values).toEqual([
        "https://www.linkedin.com/in/prospect-vanity", // the value send-path checks compare against
        "https://www.linkedin.com/in/acoaa_prospect",
      ]);
      expect(store.suppressions.every((s) => s[4] === "lead1" && s[3] === classification)).toBe(true);
    });
  }

  it("writes one entry when the stored url and the payload url are the same", async () => {
    const store = makeStore({
      findLinkedInAccountByProviderRef: async () => ({ id: "li", accountId: "acc1" }),
      findLeadByProviderRef: async () => ({ id: "lead1", campaignId: "camp1" }),
      getLeadLinkedInUrl: async () => "https://www.linkedin.com/in/ACoAA_PROSPECT/",
    });
    await runInbound({ source: "linkedin", payload: PAYLOAD }, deps(store, { classifyFn: classify("unsubscribe") }));
    expect(store.suppressions).toHaveLength(1);
  });

  it("the responder never drafts for a suppressed lead (checked against the stored url)", async () => {
    const checked: string[] = [];
    const store = makeStore({
      findLinkedInAccountByProviderRef: async () => ({ id: "li", accountId: "acc1" }),
      findLeadByProviderRef: async () => ({ id: "lead1", campaignId: "camp1" }),
      getLeadLinkedInUrl: async () => STORED,
      isSuppressed: async (_a, _k, value) => {
        checked.push(value);
        return value === "https://www.linkedin.com/in/prospect-vanity";
      },
      getResponderBundle: async () => {
        throw new Error("must not build a bundle for a suppressed lead");
      },
    });
    const respondFn = vi.fn();

    const result = await runInbound(
      { source: "linkedin", payload: { ...PAYLOAD, body: "tell me more" } },
      deps(store, { classifyFn: classify("interested"), respondFn })
    );

    expect(result.action).toBe("reply:interested");
    expect(respondFn).not.toHaveBeenCalled();
    expect(store.scheduledSends).toHaveLength(0);
    expect(checked).toContain("https://www.linkedin.com/in/prospect-vanity");
  });
});

describe("runInbound — a reply is never lost to a mid-processing failure", () => {
  function storeForLead(over: Partial<InboundStore> = {}) {
    return makeStore({
      findLinkedInAccountByProviderRef: async () => ({ id: "li", accountId: "acc1" }),
      findLeadByLinkedInUrl: async () => ({ id: "lead1", campaignId: "camp1" }),
      ...over,
    });
  }

  it("an existing but UNclassified reply row (a crashed run's retry) is processed in full", async () => {
    const store = storeForLead({
      insertReply: async (r) => ({ id: "reply_existing", created: false, createdAt: r.receivedAt, classified: false }),
    });

    const result = await runInbound(
      { source: "linkedin", payload: LINKEDIN_REPLY_FIXTURE },
      deps(store, { classifyFn: classify("not_interested") })
    );

    expect(result).toEqual({ handled: true, action: "reply:not_interested" });
    expect(store.suppressions).toHaveLength(1);
    expect(store.classifications).toEqual([
      { replyId: "reply_existing", verdict: expect.objectContaining({ classification: "not_interested" }) },
    ]);
  });

  it("a classified existing row is the true duplicate — no effects", async () => {
    const store = storeForLead({
      insertReply: async (r) => ({ id: "reply_existing", created: false, createdAt: r.receivedAt, classified: true }),
    });
    const result = await runInbound({ source: "linkedin", payload: LINKEDIN_REPLY_FIXTURE }, deps(store));
    expect(result).toEqual({ handled: true, action: "reply:duplicate" });
    expect(store.notifications).toHaveLength(0);
  });

  it("writes the classification (the processed marker) LAST — after suppression", async () => {
    const store = storeForLead();
    await runInbound({ source: "linkedin", payload: LINKEDIN_REPLY_FIXTURE }, deps(store, { classifyFn: classify("unsubscribe") }));
    expect(store.effects).toEqual(["suppress", "classify"]);
  });

  it("a throw after the reply row exists leaves it unclassified, so the retry finishes the job", async () => {
    let failOnce = true;
    const rows = new Map<string, { id: string; classified: boolean }>();
    const store = storeForLead({
      insertReply: async (r) => {
        const existing = rows.get(r.providerMessageRef!);
        if (existing) return { id: existing.id, created: false, createdAt: r.receivedAt, classified: existing.classified };
        rows.set(r.providerMessageRef!, { id: "reply_1", classified: false });
        return { id: "reply_1", created: true, createdAt: r.receivedAt, classified: false };
      },
      setLeadReplied: async () => {
        if (failOnce) {
          failOnce = false;
          throw new Error("db blip");
        }
      },
    });
    const origClassify = store.setReplyClassification;
    store.setReplyClassification = async (id, v) => {
      rows.get("li_evt_001")!.classified = true;
      await origClassify(id, v);
    };

    await expect(
      runInbound({ source: "linkedin", payload: LINKEDIN_REPLY_FIXTURE }, deps(store, { classifyFn: classify("interested") }))
    ).rejects.toThrow("db blip");
    expect(store.classifications).toHaveLength(0);

    const retry = await runInbound(
      { source: "linkedin", payload: LINKEDIN_REPLY_FIXTURE },
      deps(store, { classifyFn: classify("interested") })
    );
    expect(retry.action).toBe("reply:interested");
    expect(store.classifications).toHaveLength(1);
    expect(store.notifications.some((n) => n.kind === "reply")).toBe(true);
  });
});

describe("runInbound — responder freshness + thread hygiene", () => {
  const bundle = (over: Partial<ResponderBundle> = {}): ResponderBundle => ({
    campaignId: "camp1",
    sendMode: "automatic",
    lead: { firstName: "Ryan", lastName: "C", title: "VP Sales", companyName: "Northwind", industry: "SaaS" },
    insights: { pain_points: [], triggers: [], motivations: [], value_angle: "", aha_moment: "", summary: "" },
    context: { cta: "a quick intro" },
    thread: [],
    agentTurns: 0,
    newestUnsentMessageCreatedAt: null,
    lastAgentMessageAt: null,
    humanHandled: false,
    attribution: { strategy: {}, playbookVersion: null },
    ...over,
  });
  const respondFn: InboundDeps["respondFn"] = async () => ({ message: "Happy to — quick look?", violations: [] });

  it("a draft created AFTER the provider timestamp but BEFORE we ingested the reply was drafted blind — supersede it", async () => {
    // reply sent 10:05:00, webhook lagged → ingested 10:20:00; a scripted touch drafted 10:10:00
    // couldn't see it, so it must not be treated as the answer.
    const store = makeStore({
      findLinkedInAccountByProviderRef: async () => ({ id: "li", accountId: "acc1" }),
      findLeadByLinkedInUrl: async () => ({ id: "lead1", campaignId: "camp1" }),
      insertReply: async () => ({ id: "r1", created: true, createdAt: new Date("2026-06-12T10:20:00.000Z"), classified: false }),
      getResponderBundle: async () => bundle({ newestUnsentMessageCreatedAt: new Date("2026-06-12T10:10:00.000Z") }),
    });

    const result = await runInbound(
      { source: "linkedin", payload: LINKEDIN_REPLY_FIXTURE },
      deps(store, { respondFn, now: () => new Date("2026-06-12T10:21:00.000Z") })
    );

    expect(result.action).toBe("reply:interested+responded");
    expect(store.canceledSends).toContain("lead1");
  });

  it("asks for the bundle WITHOUT the incoming reply, so it isn't both thread history and `incoming`", async () => {
    const store = makeStore({
      findLinkedInAccountByProviderRef: async () => ({ id: "li", accountId: "acc1" }),
      findLeadByLinkedInUrl: async () => ({ id: "lead1", campaignId: "camp1" }),
      getResponderBundle: async () => bundle(),
    });

    await runInbound({ source: "linkedin", payload: LINKEDIN_REPLY_FIXTURE }, deps(store, { respondFn }));

    expect(store.bundleRequests).toEqual([{ leadId: "lead1", opts: { excludeReplyId: "reply_1" } }]);
  });
});

describe("runInbound — native human takeover (outbound echo)", () => {
  const ECHO = {
    event_id: "li_msg_own_1",
    connected_account: LINKEDIN_ACCOUNT_REF,
    event_type: "outbound_echo",
    to_profile_url: "https://www.linkedin.com/in/ACoAA_PROSPECT",
    from_provider_ref: "ACoAA_PROSPECT",
    body: "Hi Ryan, jumping in personally here",
    sent_at: "2026-06-12T10:05:00.000Z",
  };
  function storeForLead(over: Partial<InboundStore> = {}) {
    return makeStore({
      findLinkedInAccountByProviderRef: async () => ({ id: "li", accountId: "acc1" }),
      findLeadByProviderRef: async () => ({ id: "lead1", campaignId: "camp1" }),
      ...over,
    });
  }

  it("a message the user typed in LinkedIn itself pauses the agent on that thread", async () => {
    const store = storeForLead();
    const result = await runInbound({ source: "linkedin", payload: ECHO }, deps(store));
    expect(result).toEqual({ handled: true, action: "echo:human_takeover" });
    expect(store.takeovers).toEqual([{ accountId: "acc1", leadId: "lead1", campaignId: "camp1" }]);
    expect(store.replies).toHaveLength(0); // never a reply
  });

  it("mirrors the natively typed message into the lead's thread (inbox shows it)", async () => {
    const store = storeForLead();
    await runInbound({ source: "linkedin", payload: ECHO }, deps(store));
    expect(store.nativeMessages).toEqual([
      {
        accountId: "acc1",
        leadId: "lead1",
        providerMessageRef: "li_msg_own_1",
        body: "Hi Ryan, jumping in personally here",
        sentAt: new Date("2026-06-12T10:05:00.000Z"),
      },
    ]);
  });

  it("a replayed echo is mirrored once and never re-pauses a thread the user handed back", async () => {
    const store = storeForLead();
    await runInbound({ source: "linkedin", payload: ECHO }, deps(store));
    const again = await runInbound({ source: "linkedin", payload: ECHO }, deps(store));
    expect(again).toEqual({ handled: true, action: "echo:duplicate" });
    expect(store.nativeMessages).toHaveLength(1);
    expect(store.takeovers).toHaveLength(1);
  });

  it("a stale native message (backfill) is mirrored but does not flip the thread's state now", async () => {
    const store = storeForLead();
    const result = await runInbound(
      { source: "linkedin", payload: ECHO },
      deps(store, { now: () => new Date("2026-06-20T10:00:00.000Z") })
    );
    expect(result).toEqual({ handled: true, action: "echo:mirrored" });
    expect(store.nativeMessages).toHaveLength(1);
    expect(store.takeovers).toHaveLength(0);
  });

  it("our own send echoed back is ignored (no takeover)", async () => {
    const seen: unknown[][] = [];
    const store = storeForLead({
      isOwnOutboundMessage: async (...args) => {
        seen.push(args);
        return true;
      },
    });
    const result = await runInbound({ source: "linkedin", payload: ECHO }, deps(store));
    expect(result).toEqual({ handled: true, action: "echo:own" });
    expect(store.takeovers).toHaveLength(0);
    expect(store.nativeMessages).toHaveLength(0); // already in the thread as a Vantera send
    expect(seen).toEqual([["acc1", "lead1", "li_msg_own_1", "Hi Ryan, jumping in personally here"]]);
  });

  it("an echo to someone who isn't a lead is ignored", async () => {
    const store = storeForLead({ findLeadByProviderRef: async () => null });
    const result = await runInbound({ source: "linkedin", payload: ECHO }, deps(store));
    expect(result).toEqual({ handled: false, action: "no matching lead" });
    expect(store.takeovers).toHaveLength(0);
  });
});

describe("handleLinkedInEvent — an already-parsed event (the thread-sync entry point)", () => {
  it("routes a parsed reply through the same reply path as a webhook", async () => {
    const store = makeStore({
      findLinkedInAccountByProviderRef: async () => ({ id: "li", accountId: "acc1" }),
      findLeadByProviderRef: async () => ({ id: "lead1", campaignId: "camp1" }),
    });
    const result = await handleLinkedInEvent(
      {
        type: "reply",
        providerEventId: "msg_9",
        connectedAccountRef: LINKEDIN_ACCOUNT_REF,
        fromProfileUrl: "https://www.linkedin.com/in/ACoAA_PROSPECT",
        fromProviderRef: "ACoAA_PROSPECT",
        fromPublicIdentifier: null,
        fromName: null,
        body: "Sounds good, tell me more",
        receivedAt: "2026-06-12T10:05:00.000Z",
      },
      deps(store)
    );
    expect(result).toEqual({ handled: true, action: "reply:interested" });
    expect(store.replies).toHaveLength(1);
    expect(store.replies[0]!.providerMessageRef).toBe("msg_9");
  });
});
