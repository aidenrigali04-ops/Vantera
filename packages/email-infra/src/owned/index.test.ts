import { describe, expect, it } from "vitest";
import { OwnedEmailInfra } from "./index";
import { InMemoryRegistrar } from "./registrar";
import { InMemoryDns } from "./dns";
import { InMemoryMailboxProvisioner } from "./mailbox";
import { InMemoryWarmup } from "./warmup";
import { InMemoryGmailSender } from "./gmail-send";

const build = () => {
  const registrar = new InMemoryRegistrar();
  const dns = new InMemoryDns();
  const mailbox = new InMemoryMailboxProvisioner();
  const warmup = new InMemoryWarmup();
  const sender = new InMemoryGmailSender();
  const infra = new OwnedEmailInfra({
    registrar, dns, mailbox, warmup, sender,
    webhookSecret: "whsec",
    chooseDomains: (accountId, count) => Array.from({ length: count }, (_, i) => `get-${accountId}-${i}.com`),
    localParts: (n) => Array.from({ length: n }, (_, i) => `sdr${i}`),
  });
  return { infra, registrar, dns, mailbox, warmup, sender };
};

describe("OwnedEmailInfra.provision", () => {
  it("buys domains, writes DNS, creates+enrolls mailboxes, returns Mailbox[] keyed by address", async () => {
    const { infra, registrar, dns, mailbox, warmup } = build();
    const result = await infra.provision({ accountId: "acct1", domainCount: 2, mailboxesPerDomain: 2 });

    expect(result).toHaveLength(4);
    expect(result[0]!.id).toBe(result[0]!.address);
    expect(registrar.purchased).toEqual(["get-acct1-0.com", "get-acct1-1.com"]);
    expect(dns.recordsFor("get-acct1-0.com").length).toBeGreaterThan(0);
    expect(mailbox.verifiedDomains).toContain("get-acct1-0.com");
    expect(await warmup.status(result[0]!.address)).toEqual({ phase: "warming", dailyCap: 10 });
  });
});

describe("OwnedEmailInfra.send", () => {
  it("sends via Gmail (userId=address) and sets List-Unsubscribe when provided", async () => {
    const { infra, sender } = build();
    const res = await infra.send({
      mailboxId: "sdr0@get-acct1-0.com", to: "lead@x.com", subject: "Hi", body: "Body",
      campaignId: "c", leadId: "l", unsubscribeUrl: "https://u/x",
    });
    expect(res.messageId).toBeTruthy();
    expect(typeof res.sentAt).toBe("string");
    expect(sender.sent[0]!.from).toBe("sdr0@get-acct1-0.com");
    expect(sender.sent[0]!.headers["List-Unsubscribe"]).toBe("<https://u/x>");
    expect(sender.sent[0]!.headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
  });
});

describe("OwnedEmailInfra.warmupStatus", () => {
  it("maps the warmup snapshot to WarmupStatus", async () => {
    const { infra, warmup } = build();
    await warmup.enroll("sdr0@get-acct1-0.com");
    warmup.markReady("sdr0@get-acct1-0.com", 40);
    expect(await infra.warmupStatus("sdr0@get-acct1-0.com")).toEqual({
      mailboxId: "sdr0@get-acct1-0.com", phase: "ready", dailyCap: 40,
    });
  });
});

describe("OwnedEmailInfra.verifyWebhook / parseEventWebhook", () => {
  it("verifies a matching secret and parses a reply event", () => {
    const { infra } = build();
    expect(infra.verifyWebhook({ "x-webhook-secret": "whsec" }, "{}")).toBe(true);
    expect(infra.verifyWebhook({ "x-webhook-secret": "nope" }, "{}")).toBe(false);
    const ev = infra.parseEventWebhook({
      event_id: "e1", mailbox_ref: "sdr0@get-acct1-0.com", event_type: "reply",
      from: "lead@x.com", body: "yes", received_at: "2026-06-14T00:00:00Z", message_ref: "m1",
    });
    expect(ev).toMatchObject({ type: "reply", mailboxRef: "sdr0@get-acct1-0.com", from: "lead@x.com" });
  });
});
