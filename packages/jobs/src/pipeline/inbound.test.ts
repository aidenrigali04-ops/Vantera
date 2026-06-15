import { describe, expect, it, vi } from "vitest";
import { InMemoryEmailInfra } from "@vantera/email-infra";
import { InMemoryLinkedInInfra } from "@vantera/linkedin-infra";
import { InMemoryMessageInfra } from "@vantera/imessage-infra";
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
  pausedMailboxes: string[];
  warmupUpdates: { mailboxId: string; status: "warming" | "active"; dailyCap: number }[];
  connectedLeads: { leadId: string; at: Date }[];
  repliedLeads: { leadId: string; campaignId: string | null }[];
  canceledSends: string[];
  upsertedLinkedInStatuses: Parameters<InboundStore["upsertLinkedInAccountStatus"]>[0][];
  pausedSequences: { leadId: string; stop: boolean }[];
  notifications: Parameters<InboundStore["insertLeadNotification"]>[0][];
} {
  let replyCounter = 0;
  const replies: Parameters<InboundStore["insertReply"]>[0][] = [];
  const classifications: { replyId: string; verdict: ReplyVerdict }[] = [];
  const suppressions: Parameters<InboundStore["addSuppression"]>[] = [];
  const pausedMailboxes: string[] = [];
  const warmupUpdates: { mailboxId: string; status: "warming" | "active"; dailyCap: number }[] = [];
  const connectedLeads: { leadId: string; at: Date }[] = [];
  const repliedLeads: { leadId: string; campaignId: string | null }[] = [];
  const canceledSends: string[] = [];
  const upsertedLinkedInStatuses: Parameters<InboundStore["upsertLinkedInAccountStatus"]>[0][] = [];
  const pausedSequences: { leadId: string; stop: boolean }[] = [];
  const notifications: Parameters<InboundStore["insertLeadNotification"]>[0][] = [];

  const base: InboundStore = {
    findMailboxByProviderRef: async () => null,
    findLinkedInAccountByProviderRef: async () => null,
    upsertLinkedInAccountStatus: async (e) => { upsertedLinkedInStatuses.push(e); },
    findLeadByEmail: async () => null,
    findLeadByLinkedInUrl: async () => null,
    findLeadByPhone: async () => null as { id: string; accountId: string; campaignId: string | null } | null,
    insertReply: async (r) => {
      replies.push(r);
      return `reply_${++replyCounter}`;
    },
    setReplyClassification: async (replyId, verdict) => {
      classifications.push({ replyId, verdict });
    },
    addSuppression: async (...args) => { suppressions.push(args); },
    pauseMailbox: async (id) => { pausedMailboxes.push(id); },
    updateMailboxWarmup: async (mailboxId, status, dailyCap) => {
      warmupUpdates.push({ mailboxId, status, dailyCap });
    },
    setLeadConnected: async (leadId, at) => { connectedLeads.push({ leadId, at }); },
    setLeadReplied: async (leadId, campaignId) => { repliedLeads.push({ leadId, campaignId }); },
    cancelPendingSends: async (leadId) => { canceledSends.push(leadId); return 0; },
    pauseSequenceForReply: async (leadId, stop) => { pausedSequences.push({ leadId, stop }); },
    insertLeadNotification: async (n) => { notifications.push(n); },
    ...overrides,
  };

  return Object.assign(base, {
    replies,
    classifications,
    suppressions,
    pausedMailboxes,
    warmupUpdates,
    connectedLeads,
    repliedLeads,
    canceledSends,
    upsertedLinkedInStatuses,
    pausedSequences,
    notifications,
  });
}

// ---------------------------------------------------------------------------
// Fixtures — raw provider payloads (exercising the parse path via real fakes)
// ---------------------------------------------------------------------------

const EMAIL_MAILBOX_REF = "mbx_001";
const EMAIL_REPLY_FIXTURE = {
  event_id: "evt_001",
  mailbox_ref: EMAIL_MAILBOX_REF,
  event_type: "reply",
  from: "Prospect@Example.com",
  body: "Thanks, this looks interesting!",
  received_at: "2026-06-12T10:00:00.000Z",
  message_ref: "msg_abc",
};

const EMAIL_BOUNCE_FIXTURE = {
  event_id: "evt_002",
  mailbox_ref: EMAIL_MAILBOX_REF,
  event_type: "bounce",
  recipient: "Bounced@Example.com",
};

const EMAIL_COMPLAINT_FIXTURE = {
  event_id: "evt_003",
  mailbox_ref: EMAIL_MAILBOX_REF,
  event_type: "complaint",
  recipient: "Spam@Example.com",
};

const EMAIL_UNSUBSCRIBE_FIXTURE = {
  event_id: "evt_004",
  mailbox_ref: EMAIL_MAILBOX_REF,
  event_type: "unsubscribe",
  recipient: "Unsub@Example.com",
};

const EMAIL_WARMUP_FIXTURE = {
  event_id: "evt_005",
  mailbox_ref: EMAIL_MAILBOX_REF,
  event_type: "warmup_update",
  phase: "ready",
  daily_cap: 40,
};

const LINKEDIN_ACCOUNT_REF = "li_acct_001";
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

const emailInfra = new InMemoryEmailInfra();
const linkedinInfra = new InMemoryLinkedInInfra();
const messageInfra = new InMemoryMessageInfra();

function classify(classification: ReplyVerdict["classification"]): InboundDeps["classifyFn"] {
  return async () => ({ classification, rationale: "test stub" });
}

function deps(store: InboundStore, extra?: Partial<InboundDeps>): InboundDeps {
  return {
    store,
    emailInfra,
    linkedinInfra,
    messageInfra,
    classifyFn: classify("interested"),
    ...extra,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("runInbound — email reply: interested", () => {
  it("insertReply is called with lowercased from, classification written, cancelPendingSends + setLeadReplied called, NO suppression", async () => {
    const store = makeStore({
      findMailboxByProviderRef: async () => ({ id: "mbx_id_1", accountId: "acc1" }),
      findLeadByEmail: async (_accountId, email) =>
        email === "prospect@example.com" ? { id: "lead1", campaignId: "camp1" } : null,
    });

    const result = await runInbound(
      { source: "email", payload: EMAIL_REPLY_FIXTURE },
      deps(store, { classifyFn: classify("interested") })
    );

    expect(result).toEqual({ handled: true, action: "reply:interested" });
    expect(store.replies).toHaveLength(1);
    expect(store.replies[0]!.leadId).toBe("lead1");
    expect(store.replies[0]!.channel).toBe("email");
    // from is lowercased
    const reply = store.replies[0]!;
    expect(reply.body).toBe(EMAIL_REPLY_FIXTURE.body);
    expect(store.classifications).toHaveLength(1);
    expect(store.classifications[0]!.verdict.classification).toBe("interested");
    expect(store.canceledSends).toContain("lead1");
    expect(store.repliedLeads.map((r) => r.leadId)).toContain("lead1");
    expect(store.suppressions).toHaveLength(0);
  });
});

describe("runInbound — email reply: not_interested", () => {
  it("adds suppression with source not_interested and leadId", async () => {
    const store = makeStore({
      findMailboxByProviderRef: async () => ({ id: "mbx_id_1", accountId: "acc1" }),
      findLeadByEmail: async () => ({ id: "lead2", campaignId: "camp1" }),
    });

    await runInbound(
      { source: "email", payload: EMAIL_REPLY_FIXTURE },
      deps(store, { classifyFn: classify("not_interested") })
    );

    expect(store.suppressions).toHaveLength(1);
    const [accountId, kind, value, source, leadId] = store.suppressions[0]!;
    expect(accountId).toBe("acc1");
    expect(kind).toBe("email");
    expect(value).toBe("prospect@example.com"); // lowercased
    expect(source).toBe("not_interested");
    expect(leadId).toBe("lead2");
  });
});

describe("runInbound — email reply: unsubscribe classification", () => {
  it("adds suppression with source unsubscribe", async () => {
    const store = makeStore({
      findMailboxByProviderRef: async () => ({ id: "mbx_id_1", accountId: "acc1" }),
      findLeadByEmail: async () => ({ id: "lead3", campaignId: null }),
    });

    await runInbound(
      { source: "email", payload: EMAIL_REPLY_FIXTURE },
      deps(store, { classifyFn: classify("unsubscribe") })
    );

    expect(store.suppressions).toHaveLength(1);
    expect(store.suppressions[0]![3]).toBe("unsubscribe");
  });
});

describe("runInbound — email reply: out_of_office", () => {
  it("stores and classifies reply but does NOT call cancelPendingSends or setLeadReplied", async () => {
    const store = makeStore({
      findMailboxByProviderRef: async () => ({ id: "mbx_id_1", accountId: "acc1" }),
      findLeadByEmail: async () => ({ id: "lead4", campaignId: "camp1" }),
    });

    const result = await runInbound(
      { source: "email", payload: EMAIL_REPLY_FIXTURE },
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

describe("runInbound — bounce", () => {
  it("writes suppression(bounce) + cancelPendingSends when lead found", async () => {
    const store = makeStore({
      findMailboxByProviderRef: async () => ({ id: "mbx_id_1", accountId: "acc1" }),
      findLeadByEmail: async () => ({ id: "lead5", campaignId: "camp1" }),
    });

    const result = await runInbound(
      { source: "email", payload: EMAIL_BOUNCE_FIXTURE },
      deps(store)
    );

    expect(result).toEqual({ handled: true, action: "bounce" });
    expect(store.suppressions).toHaveLength(1);
    expect(store.suppressions[0]![3]).toBe("bounce");
    expect(store.suppressions[0]![2]).toBe("bounced@example.com"); // lowercased
    expect(store.canceledSends).toContain("lead5");
  });

  it("still writes suppression when no matching lead found", async () => {
    const store = makeStore({
      findMailboxByProviderRef: async () => ({ id: "mbx_id_1", accountId: "acc1" }),
      findLeadByEmail: async () => null,
    });

    const result = await runInbound(
      { source: "email", payload: EMAIL_BOUNCE_FIXTURE },
      deps(store)
    );

    expect(result).toEqual({ handled: true, action: "bounce" });
    expect(store.suppressions).toHaveLength(1);
    expect(store.canceledSends).toHaveLength(0);
  });
});

describe("runInbound — complaint", () => {
  it("writes suppression(complaint) + pauseMailbox + cancelPendingSends", async () => {
    const store = makeStore({
      findMailboxByProviderRef: async () => ({ id: "mbx_id_1", accountId: "acc1" }),
      findLeadByEmail: async () => ({ id: "lead6", campaignId: "camp1" }),
    });

    const result = await runInbound(
      { source: "email", payload: EMAIL_COMPLAINT_FIXTURE },
      deps(store)
    );

    expect(result).toEqual({ handled: true, action: "complaint" });
    expect(store.suppressions).toHaveLength(1);
    expect(store.suppressions[0]![3]).toBe("complaint");
    expect(store.pausedMailboxes).toContain("mbx_id_1");
    expect(store.canceledSends).toContain("lead6");
  });
});

describe("runInbound — unsubscribe event", () => {
  it("writes suppression(unsubscribe) for recipient", async () => {
    const store = makeStore({
      findMailboxByProviderRef: async () => ({ id: "mbx_id_1", accountId: "acc1" }),
      findLeadByEmail: async () => null,
    });

    const result = await runInbound(
      { source: "email", payload: EMAIL_UNSUBSCRIBE_FIXTURE },
      deps(store)
    );

    expect(result).toEqual({ handled: true, action: "unsubscribe" });
    expect(store.suppressions).toHaveLength(1);
    expect(store.suppressions[0]![2]).toBe("unsub@example.com");
    expect(store.suppressions[0]![3]).toBe("unsubscribe");
  });
});

describe("runInbound — warmup_update", () => {
  it("ready/40 → updateMailboxWarmup(id, 'active', 40)", async () => {
    const store = makeStore({
      findMailboxByProviderRef: async () => ({ id: "mbx_id_1", accountId: "acc1" }),
    });

    const result = await runInbound(
      { source: "email", payload: EMAIL_WARMUP_FIXTURE },
      deps(store)
    );

    expect(result).toEqual({ handled: true, action: "warmup_update" });
    expect(store.warmupUpdates).toHaveLength(1);
    expect(store.warmupUpdates[0]).toEqual({ mailboxId: "mbx_id_1", status: "active", dailyCap: 40 });
  });

  it("warming phase → status 'warming'", async () => {
    const store = makeStore({
      findMailboxByProviderRef: async () => ({ id: "mbx_id_1", accountId: "acc1" }),
    });

    const warmingFixture = { ...EMAIL_WARMUP_FIXTURE, phase: "warming", daily_cap: 10 };

    await runInbound(
      { source: "email", payload: warmingFixture },
      deps(store)
    );

    expect(store.warmupUpdates[0]!.status).toBe("warming");
    expect(store.warmupUpdates[0]!.dailyCap).toBe(10);
  });
});

describe("runInbound — unknown mailbox ref", () => {
  it("returns handled false, zero store writes", async () => {
    const store = makeStore({
      findMailboxByProviderRef: async () => null,
    });
    const insertReplySpy = vi.fn();
    (store as unknown as Record<string, unknown>).insertReply = insertReplySpy;

    const result = await runInbound(
      { source: "email", payload: EMAIL_REPLY_FIXTURE },
      deps(store)
    );

    expect(result).toEqual({ handled: false, action: "unknown mailbox" });
    expect(insertReplySpy).not.toHaveBeenCalled();
    expect(store.suppressions).toHaveLength(0);
    expect(store.canceledSends).toHaveLength(0);
  });
});

describe("runInbound — LinkedIn reply", () => {
  it("matched via normalizeLinkedInUrl, suppression kind 'linkedin' on not_interested", async () => {
    const normalizedUrl = "https://linkedin.com/in/prospect-smith";
    const store = makeStore({
      findLinkedInAccountByProviderRef: async () => ({ id: "li_id_1", accountId: "acc2" }),
      findLeadByLinkedInUrl: async (_accountId, url) =>
        url === normalizedUrl ? { id: "lead7", campaignId: "camp2" } : null,
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
    expect(store.suppressions[0]![1]).toBe("linkedin");
    expect(store.suppressions[0]![2]).toBe(normalizedUrl);
    expect(store.suppressions[0]![3]).toBe("not_interested");
    expect(store.suppressions[0]![4]).toBe("lead7");
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

describe("runInbound — reply-pause gate", () => {
  it("pauses the sequence and notifies on a genuine (interested) reply", async () => {
    const store = makeStore({
      findMailboxByProviderRef: async () => ({ id: "mbx_id_1", accountId: "acc1" }),
      findLeadByEmail: async () => ({ id: "lead-id", campaignId: "camp1" }),
    });

    await runInbound(
      { source: "email", payload: EMAIL_REPLY_FIXTURE },
      deps(store, { classifyFn: classify("interested") })
    );

    expect(store.pausedSequences).toContainEqual({ leadId: "lead-id", stop: false });
    expect(store.notifications).toHaveLength(1);
    expect(store.notifications[0]).toEqual(
      expect.objectContaining({ accountId: "acc1", leadId: "lead-id", kind: "reply" })
    );
  });

  it("stops the sequence on a not_interested reply", async () => {
    const store = makeStore({
      findMailboxByProviderRef: async () => ({ id: "mbx_id_1", accountId: "acc1" }),
      findLeadByEmail: async () => ({ id: "lead-id", campaignId: "camp1" }),
    });

    await runInbound(
      { source: "email", payload: EMAIL_REPLY_FIXTURE },
      deps(store, { classifyFn: classify("not_interested") })
    );

    expect(store.pausedSequences).toContainEqual({ leadId: "lead-id", stop: true });
    expect(store.notifications).toHaveLength(1);
    expect(store.notifications[0]).toEqual(
      expect.objectContaining({ kind: "reply" })
    );
  });

  it("does NOT pause or notify on an out_of_office reply", async () => {
    const store = makeStore({
      findMailboxByProviderRef: async () => ({ id: "mbx_id_1", accountId: "acc1" }),
      findLeadByEmail: async () => ({ id: "lead-id", campaignId: "camp1" }),
    });

    await runInbound(
      { source: "email", payload: EMAIL_REPLY_FIXTURE },
      deps(store, { classifyFn: classify("out_of_office") })
    );

    expect(store.pausedSequences).toHaveLength(0);
    expect(store.notifications).toHaveLength(0);
  });
});

describe("runInbound — junk payloads", () => {
  it("email junk payload → handled false, no writes", async () => {
    const store = makeStore({
      findMailboxByProviderRef: async () => ({ id: "mbx_id_1", accountId: "acc1" }),
    });

    const result = await runInbound(
      { source: "email", payload: { garbage: "data" } },
      deps(store)
    );

    expect(result).toEqual({ handled: false, action: "unparseable" });
    expect(store.replies).toHaveLength(0);
    expect(store.suppressions).toHaveLength(0);
  });

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

// ---------------------------------------------------------------------------
// iMessage inbound fixtures (InMemoryMessageInfra format)
// ---------------------------------------------------------------------------

const IMESSAGE_REPLY_FIXTURE = {
  event_type: "reply",
  from: "+1 555 777 8888",  // spacing stripped by normalizePhone
  body: "Not interested, thanks.",
  received_at: "2026-06-15T09:00:00.000Z",
  message_id: "lm_msg_001",
};

const IMESSAGE_DELIVERY_FIXTURE = {
  event_type: "delivery",
  message_id: "lm_msg_002",
  delivered: true,
  send_ref: "scheduled_send_id_abc",
};

describe("runInbound — imessage reply: not_interested writes phone suppression", () => {
  it("matched lead via findLeadByPhone (global, no accountId), suppression kind 'phone' on not_interested", async () => {
    const normalizedPhone = "+15557778888";
    const store = makeStore({
      findLeadByPhone: async (phone) =>
        phone === normalizedPhone
          ? { id: "lead_im_1", accountId: "acc_im_1", campaignId: "camp_im_1" }
          : null,
    });

    // No accountId in the payload — the webhook carries none for iMessage
    const result = await runInbound(
      { source: "imessage", payload: IMESSAGE_REPLY_FIXTURE },
      deps(store, { classifyFn: classify("not_interested") })
    );

    expect(result).toEqual({ handled: true, action: "reply:not_interested" });
    expect(store.replies).toHaveLength(1);
    expect(store.replies[0]!.channel).toBe("imessage");
    expect(store.replies[0]!.leadId).toBe("lead_im_1");
    // accountId resolved from the lead, not the payload
    expect(store.replies[0]!.accountId).toBe("acc_im_1");
    expect(store.suppressions).toHaveLength(1);
    const [accId, kind, value, source, leadId] = store.suppressions[0]!;
    expect(accId).toBe("acc_im_1");
    expect(kind).toBe("phone"); // imessage suppression stored under 'phone' (rule 11)
    expect(value).toBe(normalizedPhone);
    expect(source).toBe("not_interested");
    expect(leadId).toBe("lead_im_1");
    expect(store.canceledSends).toContain("lead_im_1");
    expect(store.pausedSequences).toContainEqual({ leadId: "lead_im_1", stop: true });
  });
});

describe("runInbound — imessage reply: unsubscribe", () => {
  it("suppression kind 'phone' with source 'unsubscribe'", async () => {
    const store = makeStore({
      findLeadByPhone: async () => ({ id: "lead_im_2", accountId: "acc_im_1", campaignId: null }),
    });

    await runInbound(
      { source: "imessage", payload: IMESSAGE_REPLY_FIXTURE },
      deps(store, { classifyFn: classify("unsubscribe") })
    );

    expect(store.suppressions).toHaveLength(1);
    expect(store.suppressions[0]![0]).toBe("acc_im_1");
    expect(store.suppressions[0]![1]).toBe("phone");
    expect(store.suppressions[0]![3]).toBe("unsubscribe");
  });
});

describe("runInbound — imessage delivery: no-op handled:true", () => {
  it("delivery event returns handled:true, action:'delivery', no store writes", async () => {
    const store = makeStore();

    // delivery events don't need an accountId — no phone lookup occurs
    const result = await runInbound(
      { source: "imessage", payload: IMESSAGE_DELIVERY_FIXTURE },
      deps(store)
    );

    expect(result).toEqual({ handled: true, action: "delivery" });
    expect(store.replies).toHaveLength(0);
    expect(store.suppressions).toHaveLength(0);
  });
});

describe("runInbound — imessage: no matching lead (global phone lookup returns null)", () => {
  it("returns handled:false when findLeadByPhone finds no iMessage history for the phone", async () => {
    const store = makeStore({
      findLeadByPhone: async () => null,
    });

    // No accountId in the payload — tenant resolution is purely via findLeadByPhone
    const result = await runInbound(
      { source: "imessage", payload: IMESSAGE_REPLY_FIXTURE },
      deps(store)
    );

    expect(result).toEqual({ handled: false, action: "no matching lead" });
    expect(store.replies).toHaveLength(0);
    expect(store.suppressions).toHaveLength(0);
  });
});

describe("runInbound — imessage: no matching lead (phone has outbound history but different number)", () => {
  it("returns handled:false when phone doesn't match any lead with iMessage history", async () => {
    const store = makeStore({
      findLeadByPhone: async (phone) =>
        // only matches a different number
        phone === "+10000000000" ? { id: "other_lead", accountId: "other_acc", campaignId: null } : null,
    });

    const result = await runInbound(
      { source: "imessage", payload: IMESSAGE_REPLY_FIXTURE },
      deps(store)
    );

    expect(result).toEqual({ handled: false, action: "no matching lead" });
    expect(store.replies).toHaveLength(0);
    expect(store.suppressions).toHaveLength(0);
  });
});
