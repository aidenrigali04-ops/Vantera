import { describe, expect, it } from "vitest";
import { CONNECTION_NOTE_MAX_CHARS } from "@vantera/agent-brains";
import { InMemoryLinkedInInfra } from "@vantera/linkedin-infra";
import { LINKEDIN_NOTE_MAX, runOutreachSend, sanitizeSendError } from "./outreach-send";
import { MIN_LEAD_MESSAGE_GAP_MS } from "./send-dispatch";
import type { OutreachSendDeps, OutreachSendStore, SendContext } from "./types";

// ─── helpers ─────────────────────────────────────────────────────────────────

function makeCtx(overrides: Partial<SendContext> = {}): SendContext {
  return {
    id: "send1",
    accountId: "acc1",
    campaignId: "camp1",
    leadId: "lead1",
    channel: "linkedin",
    linkedinStage: "invite",
    status: "scheduled",
    subject: null,
    body: "Hi, saw your work at Acme.",
    campaignStatus: "active",
    accountPaused: false,
    lead: { linkedinUrl: "https://linkedin.com/in/prospect" },
    ...overrides,
  };
}

class FakeOutreachStore implements OutreachSendStore {
  ctx: SendContext | null = null;
  killSwitch = false;
  suppressedSet = new Set<string>(); // "linkedin:value"
  claimed = true; // claimSending returns this
  reverted: string[] = [];
  sent: string[] = [];
  failed: { id: string; error: string }[] = [];
  suppressed: string[] = [];
  linkedInIdentity: { id: string; providerRef: string; status: string } | null = {
    id: "li1",
    providerRef: "li_provider_1",
    status: "active",
  };
  outreachRecords: {
    accountId: string;
    campaignId: string;
    leadId: string;
    scheduledSendId: string;
    channel: "linkedin";
    linkedinAccountId?: string;
    messageRef: string | null;
  }[] = [];
  leadInvited: { leadId: string; at: Date }[] = [];
  campaignLeadStatuses = new Map<string, string>();

  async getSendContext(_sendId: string) {
    return this.ctx;
  }
  async isKillSwitchOn() {
    return this.killSwitch;
  }
  async isSuppressed(_accountId: string, kind: "linkedin", value: string) {
    return this.suppressedSet.has(`${kind}:${value}`);
  }
  async claimSending(_sendId: string) {
    return this.claimed;
  }
  async revertToApproved(sendId: string) {
    this.reverted.push(sendId);
  }
  async markSent(sendId: string) {
    this.sent.push(sendId);
  }
  async markFailed(sendId: string, error: string) {
    this.failed.push({ id: sendId, error });
  }
  async markSuppressed(sendId: string) {
    this.suppressed.push(sendId);
  }
  async getLeadAssignedIdentity(_leadId: string) {
    return this.linkedInIdentity;
  }
  async recordOutreachSend(rec: {
    accountId: string;
    campaignId: string;
    leadId: string;
    scheduledSendId: string;
    channel: "linkedin";
    linkedinAccountId?: string;
    messageRef: string | null;
  }) {
    this.outreachRecords.push(rec);
  }
  async setLeadInvited(leadId: string, at: Date) {
    this.leadInvited.push({ leadId, at });
  }
  savedProviderRefs: { leadId: string; providerRef: string }[] = [];
  async saveLeadProviderRef(leadId: string, providerRef: string) {
    this.savedProviderRefs.push({ leadId, providerRef });
  }
  async setCampaignLeadStatus(campaignId: string, leadId: string, status: string) {
    this.campaignLeadStatuses.set(`${campaignId}:${leadId}`, status);
  }
  guardFacts: {
    lastMessageDeliveredAt: Date | null;
    lastReplyAt: Date | null;
    duplicateBodyDelivered: boolean;
  } = { lastMessageDeliveredAt: null, lastReplyAt: null, duplicateBodyDelivered: false };
  guardFactsCalls: { leadId: string; body: string | null }[] = [];
  async getLeadMessageGuardFacts(leadId: string, body: string | null) {
    this.guardFactsCalls.push({ leadId, body });
    return this.guardFacts;
  }
  canceled: { id: string; error: string }[] = [];
  async cancelSend(sendId: string, error: string) {
    this.canceled.push({ id: sendId, error });
  }
}

function makeDeps(store: FakeOutreachStore): OutreachSendDeps & {
  linkedinInfra: InMemoryLinkedInInfra;
} {
  const linkedinInfra = new InMemoryLinkedInInfra();
  return { store, linkedinInfra };
}

// ─── tests ───────────────────────────────────────────────────────────────────

describe("runOutreachSend — rule 11: suppression gate", () => {
  it("NEVER sends to a suppressed lead — rule 11", async () => {
    const store = new FakeOutreachStore();
    store.ctx = makeCtx();
    store.suppressedSet.add("linkedin:https://linkedin.com/in/prospect");
    const deps = makeDeps(store);

    const outcome = await runOutreachSend({ sendId: "send1" }, deps);

    expect(outcome).toBe("suppressed");
    expect(deps.linkedinInfra.sentInvites).toHaveLength(0);
    expect(store.suppressed).toContain("send1");
    expect(store.campaignLeadStatuses.get("camp1:lead1")).toBe("suppressed");
  });
});

describe("runOutreachSend — send-boundary per-lead re-check (fresh facts, not the claim's)", () => {
  const NOW = new Date("2026-07-07T22:06:00Z");
  const msgCtx = () =>
    makeCtx({ linkedinStage: "message", body: "Thanks for the reply — happy to share more." });

  it("cancels (never sends) a message whose exact body was already delivered to the lead", async () => {
    const store = new FakeOutreachStore();
    store.ctx = msgCtx();
    store.guardFacts = {
      lastMessageDeliveredAt: new Date(NOW.getTime() - 60_000),
      lastReplyAt: null,
      duplicateBodyDelivered: true,
    };
    const deps = { ...makeDeps(store), now: () => NOW };

    const outcome = await runOutreachSend({ sendId: "send1" }, deps);

    expect(outcome).toBe("canceled");
    expect(deps.linkedinInfra.sentMessages).toHaveLength(0);
    expect(store.canceled.map((c) => c.id)).toContain("send1");
    expect(store.canceled[0]?.error).toMatch(/duplicate/);
  });

  it("parks a message when another message delivered inside the per-lead gap (no fresher reply)", async () => {
    const store = new FakeOutreachStore();
    store.ctx = msgCtx();
    store.guardFacts = {
      lastMessageDeliveredAt: new Date(NOW.getTime() - MIN_LEAD_MESSAGE_GAP_MS / 2),
      lastReplyAt: new Date(NOW.getTime() - MIN_LEAD_MESSAGE_GAP_MS), // replied BEFORE that delivery
      duplicateBodyDelivered: false,
    };
    const deps = { ...makeDeps(store), now: () => NOW };

    const outcome = await runOutreachSend({ sendId: "send1" }, deps);

    expect(outcome).toBe("parked");
    expect(deps.linkedinInfra.sentMessages).toHaveLength(0);
    expect(store.reverted).toContain("send1");
  });

  it("sends when the lead replied after our last delivery (answering promptly is human)", async () => {
    const store = new FakeOutreachStore();
    store.ctx = msgCtx();
    const lastDelivered = new Date(NOW.getTime() - 30 * 60_000);
    store.guardFacts = {
      lastMessageDeliveredAt: lastDelivered,
      lastReplyAt: new Date(lastDelivered.getTime() + 5 * 60_000),
      duplicateBodyDelivered: false,
    };
    const deps = { ...makeDeps(store), now: () => NOW };

    const outcome = await runOutreachSend({ sendId: "send1" }, deps);

    expect(outcome).toBe("sent");
    expect(deps.linkedinInfra.sentMessages).toHaveLength(1);
  });

  it("sends normally once the delivered gap has elapsed", async () => {
    const store = new FakeOutreachStore();
    store.ctx = msgCtx();
    store.guardFacts = {
      lastMessageDeliveredAt: new Date(NOW.getTime() - MIN_LEAD_MESSAGE_GAP_MS - 60_000),
      lastReplyAt: null,
      duplicateBodyDelivered: false,
    };
    const deps = { ...makeDeps(store), now: () => NOW };

    const outcome = await runOutreachSend({ sendId: "send1" }, deps);

    expect(outcome).toBe("sent");
  });

  it("invite sends never consult the message guard (first touch has no thread to pace against)", async () => {
    const store = new FakeOutreachStore();
    store.ctx = makeCtx({ linkedinStage: "invite" });
    store.guardFacts = {
      lastMessageDeliveredAt: new Date(NOW.getTime() - 60_000),
      lastReplyAt: null,
      duplicateBodyDelivered: true,
    };
    const deps = { ...makeDeps(store), now: () => NOW };

    const outcome = await runOutreachSend({ sendId: "send1" }, deps);

    expect(outcome).toBe("sent");
    expect(store.guardFactsCalls).toHaveLength(0);
  });
});

describe("runOutreachSend — dead sender connection", () => {
  it("a provider disconnected_account error PARKS the send (never a red failure) and reports it", async () => {
    const store = new FakeOutreachStore();
    store.ctx = makeCtx({ linkedinStage: "message", body: "hello" });
    const deps = makeDeps(store);
    deps.linkedinInfra.sendMessage = async () => {
      throw new Error("provider message failed (401): errors/disconnected_account");
    };

    const outcome = await runOutreachSend({ sendId: "send1" }, deps);

    expect(outcome).toBe("sender_disconnected");
    expect(store.reverted).toContain("send1"); // parked — retries after reconnect
    expect(store.failed).toHaveLength(0); // never shown to the user as a failed send
  });
});

describe("runOutreachSend — kill switch / pause / inactive", () => {
  it("kill switch on after dispatch → 'parked', nothing sent, row reverted to approved", async () => {
    const store = new FakeOutreachStore();
    store.ctx = makeCtx();
    store.killSwitch = true;
    const deps = makeDeps(store);

    const outcome = await runOutreachSend({ sendId: "send1" }, deps);

    expect(outcome).toBe("parked");
    expect(deps.linkedinInfra.sentInvites).toHaveLength(0);
    expect(store.reverted).toContain("send1");
  });

  it("account paused → 'parked'", async () => {
    const store = new FakeOutreachStore();
    store.ctx = makeCtx({ accountPaused: true });
    const deps = makeDeps(store);

    const outcome = await runOutreachSend({ sendId: "send1" }, deps);

    expect(outcome).toBe("parked");
    expect(store.reverted).toContain("send1");
  });

  it("campaign not active → 'parked'", async () => {
    const store = new FakeOutreachStore();
    store.ctx = makeCtx({ campaignStatus: "paused" });
    const deps = makeDeps(store);

    const outcome = await runOutreachSend({ sendId: "send1" }, deps);

    expect(outcome).toBe("parked");
    expect(store.reverted).toContain("send1");
  });
});

describe("runOutreachSend — linkedin identity gating", () => {
  it("parks when there is no active LinkedIn identity", async () => {
    const store = new FakeOutreachStore();
    store.ctx = makeCtx();
    store.linkedInIdentity = null;
    const deps = makeDeps(store);

    const outcome = await runOutreachSend({ sendId: "send1" }, deps);

    expect(outcome).toBe("parked");
    expect(deps.linkedinInfra.sentInvites).toHaveLength(0);
    expect(store.reverted).toContain("send1");
  });

  it("parks when the LinkedIn identity is restricted (not active)", async () => {
    const store = new FakeOutreachStore();
    store.ctx = makeCtx();
    store.linkedInIdentity = { id: "li1", providerRef: "li_provider_1", status: "restricted" };
    const deps = makeDeps(store);

    const outcome = await runOutreachSend({ sendId: "send1" }, deps);

    expect(outcome).toBe("parked");
    expect(store.reverted).toContain("send1");
  });
});

describe("send caps — single source of truth", () => {
  it("the LinkedIn note send cap equals the copy-brain generation cap so an approved note is never truncated mid-word", () => {
    expect(LINKEDIN_NOTE_MAX).toBe(CONNECTION_NOTE_MAX_CHARS);
  });
});

describe("runOutreachSend — linkedin stages", () => {
  it("linkedin invite: note truncated to the cap, setLeadInvited called, audit record channel linkedin", async () => {
    const store = new FakeOutreachStore();
    const longBody = "A".repeat(250);
    store.ctx = makeCtx({ channel: "linkedin", linkedinStage: "invite", body: longBody });
    const deps = makeDeps(store);

    const outcome = await runOutreachSend({ sendId: "send1" }, deps);

    expect(outcome).toBe("sent");
    const invite = deps.linkedinInfra.sentInvites[0]!;
    expect(invite.note?.length).toBeLessThanOrEqual(LINKEDIN_NOTE_MAX);
    expect(store.leadInvited).toHaveLength(1);
    expect(store.leadInvited[0]?.leadId).toBe("lead1");
    expect(store.outreachRecords[0]?.channel).toBe("linkedin");
    expect(store.outreachRecords[0]?.linkedinAccountId).toBe("li1");
    expect(store.outreachRecords[0]?.messageRef).toBeTruthy();
    expect(store.campaignLeadStatuses.get("camp1:lead1")).toBe("sent");
  });

  it("linkedin message stage: sendMessage used, not invited", async () => {
    const store = new FakeOutreachStore();
    store.ctx = makeCtx({
      channel: "linkedin",
      linkedinStage: "message",
      body: "Following up on my invite.",
    });
    const deps = makeDeps(store);

    const outcome = await runOutreachSend({ sendId: "send1" }, deps);

    expect(outcome).toBe("sent");
    expect(deps.linkedinInfra.sentMessages).toHaveLength(1);
    expect(deps.linkedinInfra.sentInvites).toHaveLength(0);
    expect(store.leadInvited).toHaveLength(0); // message, not invite
  });

  it("linkedin invite: an 'already_invited_recently' response is treated as SENT, never failed", async () => {
    // The connection request is already pending (a prior send whose bookkeeping we lost, or a
    // duplicate). The invite IS out, so the lead must progress to the follow-up — never a red failure.
    const store = new FakeOutreachStore();
    store.ctx = makeCtx({ channel: "linkedin", linkedinStage: "invite" });
    const deps = makeDeps(store);
    deps.linkedinInfra.sendInvite = async () => {
      throw new Error(
        'linkedin provider error 422 on /api/v1/users/invite: {"status":422,"type":"errors/already_invited_recently","title":"Should delay new invitation to this recipient"}'
      );
    };

    const outcome = await runOutreachSend({ sendId: "send1" }, deps);

    expect(outcome).toBe("sent");
    expect(store.failed).toHaveLength(0); // NOT a failure
    expect(store.leadInvited).toHaveLength(1); // lead progresses to follow-up
    expect(store.outreachRecords[0]?.channel).toBe("linkedin");
    expect(store.outreachRecords[0]?.messageRef).toBeNull(); // original id was never captured
    expect(store.campaignLeadStatuses.get("camp1:lead1")).toBe("sent");
    expect(store.sent).toContain("send1");
  });

  it("linkedin invite: a genuine provider error (e.g. 403) still fails — guard not over-broadened", async () => {
    const store = new FakeOutreachStore();
    store.ctx = makeCtx({ channel: "linkedin", linkedinStage: "invite" });
    const deps = makeDeps(store);
    deps.linkedinInfra.sendInvite = async () => {
      throw new Error("linkedin provider error 403 on /api/v1/users/invite: free account restriction");
    };

    const outcome = await runOutreachSend({ sendId: "send1" }, deps);

    expect(outcome).toBe("failed");
    expect(store.failed).toHaveLength(1);
    expect(store.leadInvited).toHaveLength(0);
  });
});

describe("runOutreachSend — failure and skip paths", () => {
  it("stored failure errors are stripped of provider response detail (white-label)", () => {
    expect(sanitizeSendError(new Error("linkedin provider error 502 on /send: unipile said no"))).toBe(
      "linkedin provider error 502 on /send"
    );
    expect(sanitizeSendError(new Error("missing contact info"))).toBe("missing contact info");
    expect(sanitizeSendError("plain string")).toBe("plain string");
  });

  it("claim lost (claimSending false) → 'skipped', no provider call", async () => {
    const store = new FakeOutreachStore();
    store.ctx = makeCtx();
    store.claimed = false;
    const deps = makeDeps(store);

    const outcome = await runOutreachSend({ sendId: "send1" }, deps);

    expect(outcome).toBe("skipped");
    expect(deps.linkedinInfra.sentInvites).toHaveLength(0);
    expect(store.sent).toHaveLength(0);
  });

  it("missing contact info → 'failed'", async () => {
    const store = new FakeOutreachStore();
    store.ctx = makeCtx({ lead: { linkedinUrl: null } });
    const deps = makeDeps(store);

    const outcome = await runOutreachSend({ sendId: "send1" }, deps);

    expect(outcome).toBe("failed");
    expect(store.failed[0]?.error).toContain("missing contact info");
  });

  it("status not 'scheduled' (e.g. already sent) → 'skipped', no side effects", async () => {
    const store = new FakeOutreachStore();
    store.ctx = makeCtx({ status: "sent" });
    const deps = makeDeps(store);

    const outcome = await runOutreachSend({ sendId: "send1" }, deps);

    expect(outcome).toBe("skipped");
    expect(deps.linkedinInfra.sentInvites).toHaveLength(0);
    expect(store.sent).toHaveLength(0);
    expect(store.failed).toHaveLength(0);
    expect(store.reverted).toHaveLength(0);
  });
});

describe("runOutreachSend — state integrity: bookkeeping isolation", () => {
  it("bookkeeping failure after a successful send NEVER marks the row failed — row stays 'sending'", async () => {
    // If bookkeeping throws AFTER the provider delivers the message, markFailed must NOT be called.
    // The row stays in "sending" (the invariant: dispatcher never re-dispatches "sending" rows;
    // a task retry is a no-op because getSendContext's status !== "scheduled" guard fires first).
    class BookkeepingFailStore extends FakeOutreachStore {
      override async recordOutreachSend(_rec: Parameters<FakeOutreachStore["recordOutreachSend"]>[0]) {
        throw new Error("DB write failed after provider success");
      }
    }
    const store = new BookkeepingFailStore();
    store.ctx = makeCtx({ channel: "linkedin", linkedinStage: "invite" });
    const deps = makeDeps(store);

    // The run should reject (bookkeeping error propagates)
    await expect(runOutreachSend({ sendId: "send1" }, deps)).rejects.toThrow(
      "DB write failed after provider success"
    );

    // Provider was called exactly once — the invite IS sent
    expect(deps.linkedinInfra.sentInvites).toHaveLength(1);
    // markFailed MUST NOT have been called — the send is not a failure, it's a bookkeeping gap
    expect(store.failed).toHaveLength(0);
    // Status was never flipped to "sent" (bookkeeping threw before markSent)
    expect(store.sent).toHaveLength(0);
  });

  it("audit row (recordOutreachSend) is written BEFORE markSent — rule 11 audit-first ordering", async () => {
    class OrderTrackingStore extends FakeOutreachStore {
      callOrder: string[] = [];

      override async recordOutreachSend(rec: Parameters<FakeOutreachStore["recordOutreachSend"]>[0]) {
        this.callOrder.push("recordOutreachSend");
        return super.recordOutreachSend(rec);
      }
      override async markSent(sendId: string) {
        this.callOrder.push("markSent");
        return super.markSent(sendId);
      }
    }
    const store = new OrderTrackingStore();
    store.ctx = makeCtx({ channel: "linkedin", linkedinStage: "invite" });
    const deps = makeDeps(store);

    await runOutreachSend({ sendId: "send1" }, deps);

    const auditIdx = store.callOrder.indexOf("recordOutreachSend");
    const sentIdx = store.callOrder.indexOf("markSent");
    expect(auditIdx).toBeGreaterThanOrEqual(0);
    expect(sentIdx).toBeGreaterThanOrEqual(0);
    expect(auditIdx).toBeLessThan(sentIdx);
  });
});

describe("runOutreachSend — reply-attribution key (0043)", () => {
  it("persists the prospect provider_id the send resolved, so inbound webhooks can match", async () => {
    const store = new FakeOutreachStore();
    store.ctx = makeCtx({ channel: "linkedin", linkedinStage: "invite", body: "Hi" });
    const deps = makeDeps(store);
    deps.linkedinInfra.providerRefsByUrl[store.ctx!.lead.linkedinUrl as string] = "ACoAA_TARGET";

    await runOutreachSend({ sendId: "send1" }, deps);

    expect(store.savedProviderRefs).toEqual([{ leadId: "lead1", providerRef: "ACoAA_TARGET" }]);
  });

  it("skips the ref write when the adapter resolved none (fake default)", async () => {
    const store = new FakeOutreachStore();
    store.ctx = makeCtx({ channel: "linkedin", linkedinStage: "message", body: "hello" });
    const deps = makeDeps(store);

    await runOutreachSend({ sendId: "send1" }, deps);

    expect(store.savedProviderRefs).toHaveLength(0);
  });
});
