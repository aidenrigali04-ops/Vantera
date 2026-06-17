import { describe, expect, it } from "vitest";
import { CONNECTION_NOTE_MAX_CHARS } from "@vantera/agent-brains";
import { InMemoryEmailInfra } from "@vantera/email-infra";
import { InMemoryLinkedInInfra } from "@vantera/linkedin-infra";
import { InMemoryMessageInfra } from "@vantera/imessage-infra";
import { LINKEDIN_NOTE_MAX, runOutreachSend, sanitizeSendError } from "./outreach-send";
import type { OutreachSendDeps, OutreachSendStore, SendContext } from "./types";
import type { SenderAddress } from "./email-footer";

// ─── helpers ─────────────────────────────────────────────────────────────────

const TEST_ADDRESS: SenderAddress = {
  line1: "123 Main St",
  city: "Austin",
  region: "TX",
  postal: "78701",
  country: "US",
};

function makeCtx(overrides: Partial<SendContext> = {}): SendContext {
  return {
    id: "send1",
    accountId: "acc1",
    campaignId: "camp1",
    leadId: "lead1",
    channel: "email",
    linkedinStage: null,
    status: "scheduled",
    subject: "Hello there",
    body: "Hi, saw your work at Acme.",
    campaignStatus: "active",
    accountPaused: false,
    senderAddress: TEST_ADDRESS,
    senderName: "Jordan Lee",
    lead: { email: "prospect@example.com", linkedinUrl: null, phone: null },
    ...overrides,
  };
}

class FakeOutreachStore implements OutreachSendStore {
  ctx: SendContext | null = null;
  killSwitch = false;
  suppressedSet = new Set<string>(); // "email:value" or "linkedin:value" or "phone:value"
  claimed = true; // claimSending returns this
  reverted: string[] = [];
  sent: string[] = [];
  failed: { id: string; error: string }[] = [];
  suppressed: string[] = [];
  mailbox: { id: string; providerRef: string | null; status: string } | null = {
    id: "mbx1",
    providerRef: "mbx_provider_1",
    status: "active",
  };
  linkedInIdentity: { id: string; providerRef: string; status: string } | null = {
    id: "li1",
    providerRef: "li_provider_1",
    status: "active",
  };
  unsubscribeToken = "tok_abc";
  healthEvents: { mailboxId: string; kind: "sent" | "bounce" | "complaint" }[] = [];
  outreachRecords: {
    accountId: string;
    campaignId: string;
    leadId: string;
    scheduledSendId: string;
    channel: "email" | "linkedin" | "imessage";
    mailboxId?: string;
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
  async isSuppressed(_accountId: string, kind: "email" | "linkedin" | "phone", value: string) {
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
  async recordMailboxHealthEvent(mailboxId: string, kind: "sent" | "bounce" | "complaint") {
    this.healthEvents.push({ mailboxId, kind });
  }
  async markFailed(sendId: string, error: string) {
    this.failed.push({ id: sendId, error });
  }
  async markSuppressed(sendId: string) {
    this.suppressed.push(sendId);
  }
  async pickActiveMailbox(_accountId: string) {
    return this.mailbox;
  }
  async getActiveLinkedInIdentity(_accountId: string) {
    return this.linkedInIdentity;
  }
  async createUnsubscribeToken(_accountId: string, _leadId: string, _email: string) {
    return this.unsubscribeToken;
  }
  async recordOutreachSend(rec: {
    accountId: string;
    campaignId: string;
    leadId: string;
    scheduledSendId: string;
    channel: "email" | "linkedin" | "imessage";
    mailboxId?: string;
    linkedinAccountId?: string;
    messageRef: string | null;
  }) {
    this.outreachRecords.push(rec);
  }
  async setLeadInvited(leadId: string, at: Date) {
    this.leadInvited.push({ leadId, at });
  }
  async setCampaignLeadStatus(campaignId: string, leadId: string, status: string) {
    this.campaignLeadStatuses.set(`${campaignId}:${leadId}`, status);
  }
}

function makeDeps(store: FakeOutreachStore, overrides: { imessageSender?: string } = {}): OutreachSendDeps & {
  emailInfra: InMemoryEmailInfra;
  linkedinInfra: InMemoryLinkedInInfra;
  messageInfra: InMemoryMessageInfra;
} {
  const emailInfra = new InMemoryEmailInfra();
  // Provision the mailbox so the fake doesn't throw on unknown mailbox id
  emailInfra.provision({ accountId: "acc1", domainCount: 1, mailboxesPerDomain: 1 });
  // We need to sync the providerRef used in the store with what the fake knows.
  // The InMemoryEmailInfra uses sequential ids (mbx_1, mbx_2, ...).
  // Override the store's mailbox to use the id the fake assigned.
  // Actually we'll rely on the fake's first provisioned mailbox.
  const linkedinInfra = new InMemoryLinkedInInfra();
  const messageInfra = new InMemoryMessageInfra();
  return {
    store, emailInfra, linkedinInfra, messageInfra,
    imessageSender: overrides.imessageSender ?? "+15550001234",
    appUrl: "https://app.vantera.io",
  };
}

// ─── tests ───────────────────────────────────────────────────────────────────

describe("runOutreachSend — rule 11: suppression gate", () => {
  it("NEVER sends to a suppressed lead — rule 11", async () => {
    const store = new FakeOutreachStore();
    store.ctx = makeCtx({ lead: { email: "prospect@example.com", linkedinUrl: null, phone: null } });
    store.suppressedSet.add("email:prospect@example.com");
    const deps = makeDeps(store);

    const outcome = await runOutreachSend({ sendId: "send1" }, deps);

    expect(outcome).toBe("suppressed");
    expect(deps.emailInfra.sentEmails).toHaveLength(0);
    expect(store.suppressed).toContain("send1");
    expect(store.campaignLeadStatuses.get("camp1:lead1")).toBe("suppressed");
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
    expect(deps.emailInfra.sentEmails).toHaveLength(0);
    expect(store.reverted).toContain("send1");
  });

  it("account paused → 'parked'", async () => {
    const store = new FakeOutreachStore();
    store.ctx = makeCtx({ accountPaused: true });
    const deps = makeDeps(store);

    const outcome = await runOutreachSend({ sendId: "send1" }, deps);

    expect(outcome).toBe("parked");
    expect(store.reverted).toContain("send1");
    expect(deps.emailInfra.sentEmails).toHaveLength(0);
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

describe("runOutreachSend — mailbox status gating", () => {
  it("never sends from a warming mailbox", async () => {
    const store = new FakeOutreachStore();
    store.ctx = makeCtx();
    store.mailbox = { id: "mbx1", providerRef: "mbx_provider_1", status: "warming" };
    const deps = makeDeps(store);

    const outcome = await runOutreachSend({ sendId: "send1" }, deps);

    expect(outcome).toBe("parked");
    expect(deps.emailInfra.sentEmails).toHaveLength(0);
    expect(store.reverted).toContain("send1");
  });
});

describe("send caps — single source of truth", () => {
  it("the LinkedIn note send cap equals the copy-brain generation cap so an approved note is never truncated mid-word", () => {
    expect(LINKEDIN_NOTE_MAX).toBe(CONNECTION_NOTE_MAX_CHARS);
  });
});

describe("runOutreachSend — email personalization", () => {
  it("substitutes the {{sender_name}} sign-off placeholder before sending — the prospect never sees the raw token", async () => {
    const store = new FakeOutreachStore();
    store.ctx = makeCtx({
      body: "Saw your launch. Worth a look?\n\nThanks,\n{{sender_name}}",
      senderName: "Jordan Lee",
    });
    store.mailbox = { id: "mbx1", providerRef: "mbx_1", status: "active" };
    const deps = makeDeps(store);

    const outcome = await runOutreachSend({ sendId: "send1" }, deps);

    expect(outcome).toBe("sent");
    const sent = deps.emailInfra.sentEmails[0]!;
    expect(sent.body).toContain("Jordan Lee");
    expect(sent.body).not.toContain("{{sender_name}}");
  });
});

describe("runOutreachSend — email happy path", () => {
  it("email success: body contains unsubscribe URL and sender address; outcome 'sent'; audit record; campaign_lead 'sent'", async () => {
    const store = new FakeOutreachStore();
    const ctx = makeCtx();
    store.ctx = ctx;
    const deps = makeDeps(store);
    // Sync the providerRef to the fake's provisioned mailbox (first provision → mbx_1)
    store.mailbox = { id: "mbx1", providerRef: "mbx_1", status: "active" };

    const outcome = await runOutreachSend({ sendId: "send1" }, deps);

    expect(outcome).toBe("sent");
    expect(deps.emailInfra.sentEmails).toHaveLength(1);
    const sent = deps.emailInfra.sentEmails[0]!;
    expect(sent.body).toContain("/api/unsubscribe/");
    expect(sent.body).toContain("123 Main St"); // sender address line
    expect(sent.unsubscribeUrl).toContain("/api/unsubscribe/");
    expect(store.sent).toContain("send1");
    expect(store.outreachRecords).toHaveLength(1);
    const rec = store.outreachRecords[0]!;
    expect(rec.messageRef).toBeTruthy();
    expect(rec.channel).toBe("email");
    expect(store.campaignLeadStatuses.get("camp1:lead1")).toBe("sent");
    // WS-C: a successful email send rolls the mailbox's sent counter (health denominator)
    expect(store.healthEvents).toContainEqual({ mailboxId: "mbx1", kind: "sent" });
  });
});

describe("runOutreachSend — linkedin stages", () => {
  it("linkedin invite: note truncated to 200 chars, setLeadInvited called, audit record channel linkedin", async () => {
    const store = new FakeOutreachStore();
    const longBody = "A".repeat(250);
    store.ctx = makeCtx({
      channel: "linkedin",
      linkedinStage: "invite",
      body: longBody,
      lead: { email: null, linkedinUrl: "https://linkedin.com/in/prospect", phone: null },
    });
    const deps = makeDeps(store);

    const outcome = await runOutreachSend({ sendId: "send1" }, deps);

    expect(outcome).toBe("sent");
    const invite = deps.linkedinInfra.sentInvites[0]!;
    expect(invite.note?.length).toBeLessThanOrEqual(200);
    expect(store.leadInvited).toHaveLength(1);
    expect(store.leadInvited[0]?.leadId).toBe("lead1");
    expect(store.outreachRecords[0]?.channel).toBe("linkedin");
    expect(store.outreachRecords[0]?.linkedinAccountId).toBe("li1");
    expect(store.outreachRecords[0]?.messageRef).toBeTruthy();
  });

  it("linkedin message stage: sendMessage used", async () => {
    const store = new FakeOutreachStore();
    store.ctx = makeCtx({
      channel: "linkedin",
      linkedinStage: "message",
      body: "Following up on my invite.",
      lead: { email: null, linkedinUrl: "https://linkedin.com/in/prospect", phone: null },
    });
    const deps = makeDeps(store);

    const outcome = await runOutreachSend({ sendId: "send1" }, deps);

    expect(outcome).toBe("sent");
    expect(deps.linkedinInfra.sentMessages).toHaveLength(1);
    expect(deps.linkedinInfra.sentInvites).toHaveLength(0);
    expect(store.leadInvited).toHaveLength(0); // message, not invite
  });
});

describe("runOutreachSend — failure and skip paths", () => {
  it("provider failure (unknown mailbox) → 'failed', markFailed with error", async () => {
    const store = new FakeOutreachStore();
    store.ctx = makeCtx();
    // Use a providerRef that is NOT provisioned in the fake → will throw
    store.mailbox = { id: "mbx1", providerRef: "mbx_unknown_999", status: "active" };
    const deps = makeDeps(store);

    const outcome = await runOutreachSend({ sendId: "send1" }, deps);

    expect(outcome).toBe("failed");
    expect(store.failed).toHaveLength(1);
    expect(store.failed[0]?.error).toBeTruthy();
    expect(deps.emailInfra.sentEmails).toHaveLength(0);
  });

  it("stored failure errors are stripped of provider response detail (white-label)", () => {
    expect(sanitizeSendError(new Error("email provider error 502 on /send: smartlead.ai said no"))).toBe(
      "email provider error 502 on /send"
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
    expect(deps.emailInfra.sentEmails).toHaveLength(0);
    expect(store.sent).toHaveLength(0);
  });

  it("missing contact info → 'failed'", async () => {
    const store = new FakeOutreachStore();
    store.ctx = makeCtx({ lead: { email: null, linkedinUrl: null, phone: null } });
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
    expect(deps.emailInfra.sentEmails).toHaveLength(0);
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
    // A stuck "sending" row is the visible ops signal that bookkeeping needs a manual fix.
    class BookkeepingFailStore extends FakeOutreachStore {
      override async recordOutreachSend(_rec: Parameters<FakeOutreachStore["recordOutreachSend"]>[0]) {
        throw new Error("DB write failed after provider success");
      }
    }
    const store = new BookkeepingFailStore();
    store.ctx = makeCtx();
    store.mailbox = { id: "mbx1", providerRef: "mbx_1", status: "active" };
    const deps = makeDeps(store);

    // The run should reject (bookkeeping error propagates)
    await expect(runOutreachSend({ sendId: "send1" }, deps)).rejects.toThrow(
      "DB write failed after provider success"
    );

    // Provider was called exactly once — the message IS in the inbox
    expect(deps.emailInfra.sentEmails).toHaveLength(1);
    // markFailed MUST NOT have been called — the send is not a failure, it's a bookkeeping gap
    expect(store.failed).toHaveLength(0);
    // Status was never flipped to "sent" (bookkeeping threw before markSent)
    expect(store.sent).toHaveLength(0);
  });

  it("audit row (recordOutreachSend) is written BEFORE markSent — rule 11 audit-first ordering", async () => {
    // recordOutreachSend must be called before markSent so the audit trail
    // is never absent for a row the DB considers "sent".
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
    store.ctx = makeCtx();
    store.mailbox = { id: "mbx1", providerRef: "mbx_1", status: "active" };
    const deps = makeDeps(store);

    await runOutreachSend({ sendId: "send1" }, deps);

    const auditIdx = store.callOrder.indexOf("recordOutreachSend");
    const sentIdx = store.callOrder.indexOf("markSent");
    expect(auditIdx).toBeGreaterThanOrEqual(0);
    expect(sentIdx).toBeGreaterThanOrEqual(0);
    expect(auditIdx).toBeLessThan(sentIdx);
  });
});

describe("runOutreachSend — imessage send", () => {
  it("imessage success: calls messageInfra.sendMessage with correct toPhone + fromIdentity; records channel:imessage + markSent", async () => {
    const store = new FakeOutreachStore();
    store.ctx = makeCtx({
      channel: "imessage",
      linkedinStage: null,
      body: "Hi, wanted to reach out about your SaaS.",
      lead: { email: null, linkedinUrl: null, phone: "+1 555 000 9999" },
    });
    const deps = makeDeps(store);

    const outcome = await runOutreachSend({ sendId: "send1" }, deps);

    expect(outcome).toBe("sent");
    expect(deps.messageInfra.sentMessages).toHaveLength(1);
    const msg = deps.messageInfra.sentMessages[0]!;
    expect(msg.toPhone).toBe("+15550009999"); // normalizePhone strips spaces
    expect(msg.fromIdentity).toBe("+15550001234"); // from imessageSender
    expect(msg.body).toBe("Hi, wanted to reach out about your SaaS.");
    expect(store.sent).toContain("send1");
    expect(store.outreachRecords).toHaveLength(1);
    expect(store.outreachRecords[0]!.channel).toBe("imessage");
    expect(store.outreachRecords[0]!.messageRef).toBeTruthy();
    expect(store.campaignLeadStatuses.get("camp1:lead1")).toBe("sent");
    // email/linkedin infras must NOT have been called
    expect(deps.emailInfra.sentEmails).toHaveLength(0);
    expect(deps.linkedinInfra.sentInvites).toHaveLength(0);
  });

  it("imessage missing phone → 'failed' (markFailed, no send)", async () => {
    const store = new FakeOutreachStore();
    store.ctx = makeCtx({
      channel: "imessage",
      lead: { email: null, linkedinUrl: null, phone: null },
    });
    const deps = makeDeps(store);

    const outcome = await runOutreachSend({ sendId: "send1" }, deps);

    expect(outcome).toBe("failed");
    expect(deps.messageInfra.sentMessages).toHaveLength(0);
    expect(store.failed[0]?.error).toContain("missing contact info");
  });

  it("imessage blank imessageSender → 'parked', no send (graceful missing-sender guard)", async () => {
    const store = new FakeOutreachStore();
    store.ctx = makeCtx({
      channel: "imessage",
      lead: { email: null, linkedinUrl: null, phone: "+15550001111" },
    });
    const deps = makeDeps(store, { imessageSender: "   " });

    const outcome = await runOutreachSend({ sendId: "send1" }, deps);

    expect(outcome).toBe("parked");
    expect(deps.messageInfra.sentMessages).toHaveLength(0);
    expect(store.reverted).toContain("send1");
  });

  it("NEVER sends to a suppressed phone — imessage suppression-at-boundary (rule 11)", async () => {
    const store = new FakeOutreachStore();
    const phone = "+1 555 000 8888";
    const normalizedPhone = "+15550008888"; // normalizePhone strips spaces
    store.ctx = makeCtx({
      channel: "imessage",
      lead: { email: null, linkedinUrl: null, phone },
    });
    // Suppression is stored under kind 'phone' (sequence-touch SUPPRESSION_KIND map: imessage→phone)
    store.suppressedSet.add(`phone:${normalizedPhone}`);
    const deps = makeDeps(store);

    const outcome = await runOutreachSend({ sendId: "send1" }, deps);

    expect(outcome).toBe("suppressed");
    expect(deps.messageInfra.sentMessages).toHaveLength(0); // NEVER sent to suppressed phone
    expect(store.suppressed).toContain("send1");
    expect(store.campaignLeadStatuses.get("camp1:lead1")).toBe("suppressed");
  });
});
