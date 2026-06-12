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

  describe("webhook events", () => {
    const infra = new InMemoryLinkedInInfra("li-secret");

    it("verifies the shared secret", () => {
      expect(infra.verifyWebhook({ "x-webhook-secret": "li-secret" }, "{}")).toBe(true);
      expect(infra.verifyWebhook({ "x-webhook-secret": "bad" }, "{}")).toBe(false);
    });

    it("parses reply, relationship and account events", () => {
      expect(
        infra.parseEventWebhook({
          event_id: "le_1", event_type: "reply", connected_account: "li_acc_1",
          from_profile_url: "https://linkedin.com/in/jane", body: "sure", received_at: "2026-06-11T11:00:00Z",
        })
      ).toEqual({
        type: "reply", providerEventId: "le_1", connectedAccountRef: "li_acc_1",
        fromProfileUrl: "https://linkedin.com/in/jane", body: "sure", receivedAt: "2026-06-11T11:00:00Z",
      });
      expect(
        infra.parseEventWebhook({ event_id: "le_2", event_type: "relationship_accepted", connected_account: "li_acc_1", profile_url: "https://linkedin.com/in/jane" })
      ).toEqual({ type: "relationship_accepted", providerEventId: "le_2", connectedAccountRef: "li_acc_1", profileUrl: "https://linkedin.com/in/jane" });
      expect(
        infra.parseEventWebhook({ event_id: "le_3", event_type: "account_status", connected_account: "li_acc_1", status: "active", profile_url: null, display_name: "Jane Doe", metadata_account_id: "acct-uuid" })
      ).toEqual({ type: "account_status", providerEventId: "le_3", connectedAccountRef: "li_acc_1", status: "active", profileUrl: null, displayName: "Jane Doe", vanteraAccountId: "acct-uuid" });
      expect(infra.parseEventWebhook({})).toBeNull();
    });
  });
});
