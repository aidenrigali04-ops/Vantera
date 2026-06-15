import { describe, expect, it } from "vitest";
import { InMemoryEmailInfra } from "./in-memory";

describe("InMemoryEmailInfra", () => {
  it("provisions the requested number of mailboxes, warming by default", async () => {
    const infra = new InMemoryEmailInfra();
    const mailboxes = await infra.provision({
      accountId: "acct-1",
      domainCount: 2,
      mailboxesPerDomain: 3,
    });
    expect(mailboxes).toHaveLength(6);
    const first = mailboxes[0]!;
    await expect(infra.warmupStatus(first.id)).resolves.toMatchObject({ phase: "warming" });
  });

  it("records sends", async () => {
    const infra = new InMemoryEmailInfra();
    const [mailbox] = await infra.provision({
      accountId: "acct-1",
      domainCount: 1,
      mailboxesPerDomain: 1,
    });
    const result = await infra.send({
      mailboxId: mailbox!.id,
      to: "lead@example.com",
      subject: "hi",
      body: "hello",
      campaignId: "camp-1",
      leadId: "lead-1",
    });
    expect(result.messageId).toBeTruthy();
    expect(infra.sentEmails).toHaveLength(1);
  });

  it("provision returns per-mailbox smtp creds", async () => {
    const infra = new InMemoryEmailInfra();
    const [mbx] = await infra.provision({ accountId: "acc_1", domainCount: 1, mailboxesPerDomain: 1 });
    expect(mbx!.smtp).toMatchObject({ username: mbx!.address, port: 587 });
    expect(mbx!.smtp!.password).toBeTruthy();
  });

  it("rejects sends from unknown mailboxes", async () => {
    await expect(
      new InMemoryEmailInfra().send({
        mailboxId: "nope",
        to: "lead@example.com",
        subject: "hi",
        body: "hello",
        campaignId: "camp-1",
        leadId: "lead-1",
      })
    ).rejects.toThrowError(/unknown mailbox/);
  });

  it("returns null for malformed webhook payloads", () => {
    expect(new InMemoryEmailInfra().parseEventWebhook({ junk: true })).toBeNull();
  });

  describe("webhook events", () => {
    const infra = new InMemoryEmailInfra("test-secret");

    it("verifies the shared secret header", () => {
      expect(infra.verifyWebhook({ "x-webhook-secret": "test-secret" }, "{}")).toBe(true);
      expect(infra.verifyWebhook({ "x-webhook-secret": "forged" }, "{}")).toBe(false);
      expect(infra.verifyWebhook({}, "{}")).toBe(false);
    });

    it("parses a reply event", () => {
      const event = infra.parseEventWebhook({
        event_id: "evt_1", event_type: "reply", mailbox_ref: "mbx_1",
        from: "prospect@acme.com", body: "tell me more", received_at: "2026-06-11T10:00:00Z",
        message_ref: "msg_9",
      });
      expect(event).toEqual({
        type: "reply", providerEventId: "evt_1", mailboxRef: "mbx_1",
        from: "prospect@acme.com", body: "tell me more",
        receivedAt: "2026-06-11T10:00:00Z", messageRef: "msg_9",
      });
    });

    it("parses bounce/complaint/unsubscribe/warmup events and rejects junk", () => {
      expect(
        infra.parseEventWebhook({ event_id: "evt_2", event_type: "bounce", mailbox_ref: "m", recipient: "a@b.c" })
      ).toEqual({ type: "bounce", providerEventId: "evt_2", mailboxRef: "m", recipient: "a@b.c" });
      expect(
        infra.parseEventWebhook({ event_id: "evt_4", event_type: "complaint", mailbox_ref: "m", recipient: "a@b.c" })
      ).toEqual({ type: "complaint", providerEventId: "evt_4", mailboxRef: "m", recipient: "a@b.c" });
      expect(
        infra.parseEventWebhook({ event_id: "evt_3", event_type: "warmup_update", mailbox_ref: "m", phase: "ready", daily_cap: 40 })
      ).toEqual({ type: "warmup_update", providerEventId: "evt_3", mailboxRef: "m", phase: "ready", dailyCap: 40 });
      expect(infra.parseEventWebhook(null)).toBeNull();
      expect(infra.parseEventWebhook({ event_type: "reply" })).toBeNull();
    });
  });
});
