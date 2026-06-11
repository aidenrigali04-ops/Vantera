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

  it("records sends and surfaces replies parsed from webhooks", async () => {
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

    const reply = infra.parseReplyWebhook({
      mailbox_id: mailbox!.id,
      from: "lead@example.com",
      body: "interested",
      received_at: "2026-06-11T00:00:00Z",
    });
    expect(reply).toEqual({
      mailboxId: mailbox!.id,
      from: "lead@example.com",
      body: "interested",
      receivedAt: "2026-06-11T00:00:00Z",
    });
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
    expect(new InMemoryEmailInfra().parseReplyWebhook({ junk: true })).toBeNull();
  });
});
