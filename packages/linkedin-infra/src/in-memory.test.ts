import { describe, expect, it } from "vitest";
import { InMemoryLinkedInInfra } from "./in-memory";

describe("InMemoryLinkedInInfra", () => {
  it("issues hosted auth links per account", async () => {
    const infra = new InMemoryLinkedInInfra();
    const link = await infra.createHostedAuthLink("acct-1");
    expect(link.url).toContain("acct-1");
    expect(Date.parse(link.expiresAt)).toBeGreaterThan(Date.now());
  });

  it("records invites and messages", async () => {
    const infra = new InMemoryLinkedInInfra();
    await infra.sendInvite({
      connectedAccountId: "conn-1",
      profileUrl: "https://linkedin.com/in/lead",
      note: "hi",
    });
    await infra.sendMessage({
      connectedAccountId: "conn-1",
      profileUrl: "https://linkedin.com/in/lead",
      body: "following up",
    });
    expect(infra.sentInvites).toHaveLength(1);
    expect(infra.sentMessages).toHaveLength(1);
  });

  it("parses reply webhooks and rejects malformed payloads", () => {
    const infra = new InMemoryLinkedInInfra();
    expect(
      infra.parseReplyWebhook({
        connected_account_id: "conn-1",
        from_profile_url: "https://linkedin.com/in/lead",
        body: "interested",
        received_at: "2026-06-11T00:00:00Z",
      })
    ).toEqual({
      connectedAccountId: "conn-1",
      fromProfileUrl: "https://linkedin.com/in/lead",
      body: "interested",
      receivedAt: "2026-06-11T00:00:00Z",
    });
    expect(infra.parseReplyWebhook("nope")).toBeNull();
  });
});
