import { describe, expect, it, vi } from "vitest";
import { InMemoryLinkedInInfra } from "@vantera/linkedin-infra";
import type { ReplyVerdict } from "@vantera/agent-brains";
import { runInbound } from "./inbound";
import type { InboundDeps, InboundStore } from "./types";

// ---------------------------------------------------------------------------
// Fake store — records calls for assertions
// ---------------------------------------------------------------------------

function makeStore(overrides: Partial<InboundStore> = {}): InboundStore & {
  replies: Parameters<InboundStore["insertReply"]>[0][];
  classifications: { replyId: string; verdict: ReplyVerdict }[];
  suppressions: Parameters<InboundStore["addSuppression"]>[];
  connectedLeads: { leadId: string; at: Date }[];
  repliedLeads: { leadId: string; campaignId: string | null }[];
  canceledSends: string[];
  upsertedLinkedInStatuses: Parameters<InboundStore["upsertLinkedInAccountStatus"]>[0][];
  stoppedSequences: string[];
  notifications: Parameters<InboundStore["insertLeadNotification"]>[0][];
  bookedMeetings: { leadId: string; at: Date }[];
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

  const base: InboundStore = {
    findLinkedInAccountByProviderRef: async () => null,
    upsertLinkedInAccountStatus: async (e) => { upsertedLinkedInStatuses.push(e); },
    findLeadByLinkedInUrl: async () => null,
    insertReply: async (r) => {
      replies.push(r);
      return `reply_${++replyCounter}`;
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
    insertLeadNotification: async (n) => { notifications.push(n); },
    ...overrides,
  };

  return Object.assign(base, {
    replies,
    classifications,
    suppressions,
    connectedLeads,
    repliedLeads,
    canceledSends,
    upsertedLinkedInStatuses,
    stoppedSequences,
    notifications,
    bookedMeetings,
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
