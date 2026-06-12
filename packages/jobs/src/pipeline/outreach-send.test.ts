import { describe, expect, it } from "vitest";
import { InMemoryEmailInfra } from "@vantera/email-infra";
import { InMemoryLinkedInInfra } from "@vantera/linkedin-infra";
import { runOutreachSend } from "./outreach-send";
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
    lead: { email: "prospect@example.com", linkedinUrl: null },
    ...overrides,
  };
}

class FakeOutreachStore implements OutreachSendStore {
  ctx: SendContext | null = null;
  killSwitch = false;
  suppressedSet = new Set<string>(); // "email:value" or "linkedin:value"
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
  outreachRecords: {
    accountId: string;
    campaignId: string;
    leadId: string;
    scheduledSendId: string;
    channel: "email" | "linkedin";
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
  async isSuppressed(_accountId: string, kind: "email" | "linkedin", value: string) {
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
    channel: "email" | "linkedin";
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

function makeDeps(store: FakeOutreachStore): OutreachSendDeps & {
  emailInfra: InMemoryEmailInfra;
  linkedinInfra: InMemoryLinkedInInfra;
} {
  const emailInfra = new InMemoryEmailInfra();
  // Provision the mailbox so the fake doesn't throw on unknown mailbox id
  emailInfra.provision({ accountId: "acc1", domainCount: 1, mailboxesPerDomain: 1 });
  // We need to sync the providerRef used in the store with what the fake knows.
  // The InMemoryEmailInfra uses sequential ids (mbx_1, mbx_2, ...).
  // Override the store's mailbox to use the id the fake assigned.
  // Actually we'll rely on the fake's first provisioned mailbox.
  const linkedinInfra = new InMemoryLinkedInInfra();
  return { store, emailInfra, linkedinInfra, appUrl: "https://app.vantera.io" };
}

// ─── tests ───────────────────────────────────────────────────────────────────

describe("runOutreachSend — rule 11: suppression gate", () => {
  it("NEVER sends to a suppressed lead — rule 11", async () => {
    const store = new FakeOutreachStore();
    store.ctx = makeCtx({ lead: { email: "prospect@example.com", linkedinUrl: null } });
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
      lead: { email: null, linkedinUrl: "https://linkedin.com/in/prospect" },
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
      lead: { email: null, linkedinUrl: "https://linkedin.com/in/prospect" },
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
    store.ctx = makeCtx({ lead: { email: null, linkedinUrl: null } });
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
