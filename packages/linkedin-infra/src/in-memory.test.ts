import { describe, expect, it } from "vitest";
import { InMemoryLinkedInInfra } from "./in-memory";

describe("InMemoryLinkedInInfra", () => {
  it("issues hosted auth links per account", async () => {
    const infra = new InMemoryLinkedInInfra();
    const link = await infra.createHostedAuthLink("acct-1");
    expect(link.url).toContain("acct-1");
    expect(Date.parse(link.expiresAt)).toBeGreaterThan(Date.now());
  });

  it("createHostedAuthLink accepts optional redirects and returns a url", async () => {
    const infra = new InMemoryLinkedInInfra();
    const link = await infra.createHostedAuthLink("acct-1", {
      success: "https://app.test/s?connected=1",
      failure: "https://app.test/s?connected=failed",
    });
    expect(link.url).toContain("acct-1");
    expect(typeof link.expiresAt).toBe("string");
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

  it("rejects malformed webhook payloads", () => {
    expect(new InMemoryLinkedInInfra().parseEventWebhook("nope")).toBeNull();
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
      expect(
        infra.parseEventWebhook({ event_id: "le_4", event_type: "account_status", connected_account: "li_acc_1", status: "disconnected" })
      ).toEqual({ type: "account_status", providerEventId: "le_4", connectedAccountRef: "li_acc_1", status: "disconnected", profileUrl: null, displayName: null, vanteraAccountId: null });
      expect(infra.parseEventWebhook({})).toBeNull();
    });
  });
});

describe("InMemoryLinkedInInfra reads (Intent Agent)", () => {
  function seeded() {
    const infra = new InMemoryLinkedInInfra();
    infra.posts.push(
      { postRef: "p1", authorProfileUrl: "https://linkedin.com/in/author", authorName: "Ann", authorHeadline: "RevOps lead", text: "We're drowning in onboarding churn", postedAt: null, url: null },
      { postRef: "p2", authorProfileUrl: "https://linkedin.com/in/other", authorName: "Bo", authorHeadline: null, text: "Loving the weather", postedAt: null, url: null }
    );
    infra.engagersByPost.set("p1", [
      { profileUrl: "https://linkedin.com/in/liker", name: "Lee", headline: "Head of CX", kind: "reaction" },
      { profileUrl: "https://linkedin.com/in/commenter", name: "Cam", headline: "VP Success", kind: "comment", text: "same here" },
    ]);
    infra.profiles.set("https://linkedin.com/in/liker", {
      profileUrl: "https://linkedin.com/in/liker", firstName: "Lee", lastName: "Park", headline: "Head of CX", companyName: "Acme", location: "Austin",
    });
    return infra;
  }

  it("searchPosts matches on post text, respecting the limit", async () => {
    const infra = seeded();
    const hits = await infra.searchPosts({ connectedAccountId: "c1", query: "churn", limit: 10 });
    expect(hits.map((p) => p.postRef)).toEqual(["p1"]);
    expect(await infra.searchPosts({ connectedAccountId: "c1", query: "the", limit: 1 })).toHaveLength(1);
  });

  it("listProfilePosts returns only that author's posts", async () => {
    const infra = seeded();
    const posts = await infra.listProfilePosts({ connectedAccountId: "c1", profileUrl: "https://linkedin.com/in/author", limit: 10 });
    expect(posts.map((p) => p.postRef)).toEqual(["p1"]);
  });

  it("listPostEngagers returns reactors and commenters for a post", async () => {
    const infra = seeded();
    const engagers = await infra.listPostEngagers({ connectedAccountId: "c1", postRef: "p1", limit: 10 });
    expect(engagers.map((e) => e.kind)).toEqual(["reaction", "comment"]);
    expect(await infra.listPostEngagers({ connectedAccountId: "c1", postRef: "nope", limit: 10 })).toEqual([]);
  });

  it("getProfile resolves a seeded profile, else null", async () => {
    const infra = seeded();
    expect(await infra.getProfile({ connectedAccountId: "c1", profileUrl: "https://linkedin.com/in/liker" })).toMatchObject({ firstName: "Lee", companyName: "Acme" });
    expect(await infra.getProfile({ connectedAccountId: "c1", profileUrl: "https://linkedin.com/in/ghost" })).toBeNull();
  });
});
