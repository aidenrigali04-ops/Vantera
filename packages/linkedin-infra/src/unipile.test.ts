import { describe, expect, it, vi } from "vitest";
import { UnipileLinkedInInfra } from "./unipile";

const fetchMock = (responses: Record<string, unknown>) =>
  vi.fn(async (url: string) => ({
    ok: true,
    json: async () => {
      const key = Object.keys(responses).find((k) => url.includes(k));
      if (!key) throw new Error(`unmocked url: ${url}`);
      return responses[key];
    },
  })) as unknown as typeof fetch;

const infra = (responses: Record<string, unknown>) =>
  new UnipileLinkedInInfra({
    apiKey: "key_test",
    dsn: "api.unipile.example.com:13000",
    webhookSecret: "whsec_li",
    fetchFn: fetchMock(responses),
  });

describe("UnipileLinkedInInfra", () => {
  describe("createHostedAuthLink", () => {
    it("posts to the hosted link endpoint with LINKEDIN provider and accountId as name", async () => {
      const fetchFn = fetchMock({
        "/api/v1/hosted/accounts/link": {
          url: "https://auth.unipile.example.com/link/abc",
          expires_at: "2026-06-11T13:00:00Z",
        },
      });
      const adapter = new UnipileLinkedInInfra({
        apiKey: "key_test",
        dsn: "api.unipile.example.com:13000",
        webhookSecret: "whsec_li",
        fetchFn,
      });
      const link = await adapter.createHostedAuthLink("acct-1");
      expect(link).toEqual({ url: "https://auth.unipile.example.com/link/abc", expiresAt: "2026-06-11T13:00:00Z" });

      const [, init] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string);
      expect(body.providers).toContain("LINKEDIN");
      expect(body.name).toBe("acct-1");
    });
  });

  describe("sendInvite", () => {
    it("posts to the invite endpoint and returns SendOutcome", async () => {
      const fetchFn = fetchMock({
        "/api/v1/users/invite": { invitation_id: "inv_abc", sent_at: "2026-06-11T10:00:00Z" },
      });
      const adapter = new UnipileLinkedInInfra({
        apiKey: "key_test",
        dsn: "api.unipile.example.com:13000",
        webhookSecret: "whsec_li",
        fetchFn,
      });
      const result = await adapter.sendInvite({
        connectedAccountId: "conn-1",
        profileUrl: "https://linkedin.com/in/janedoe",
        note: "Hi Jane",
      });
      expect(result).toEqual({ id: "inv_abc", sentAt: "2026-06-11T10:00:00Z" });

      const [, init] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string);
      expect(body.account_id).toBe("conn-1");
      expect(body.profile_url).toBe("https://linkedin.com/in/janedoe");
      expect(body.message).toBe("Hi Jane");
    });
  });

  describe("sendMessage", () => {
    it("posts to the chats endpoint and returns SendOutcome", async () => {
      const fetchFn = fetchMock({
        "/api/v1/chats": { message_id: "msg_xyz", sent_at: "2026-06-11T11:00:00Z" },
      });
      const adapter = new UnipileLinkedInInfra({
        apiKey: "key_test",
        dsn: "api.unipile.example.com:13000",
        webhookSecret: "whsec_li",
        fetchFn,
      });
      const result = await adapter.sendMessage({
        connectedAccountId: "conn-2",
        profileUrl: "https://linkedin.com/in/johndoe",
        body: "Following up!",
      });
      expect(result).toEqual({ id: "msg_xyz", sentAt: "2026-06-11T11:00:00Z" });

      const [, init] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string);
      expect(body.account_id).toBe("conn-2");
      expect(body.profile_url).toBe("https://linkedin.com/in/johndoe");
      expect(body.message).toBe("Following up!");
    });
  });

  describe("verifyWebhook", () => {
    it("returns true for matching secret, false for wrong/missing using timing-safe compare", () => {
      const adapter = new UnipileLinkedInInfra({
        apiKey: "key_test",
        dsn: "api.unipile.example.com:13000",
        webhookSecret: "whsec_li",
        fetchFn: fetch,
      });
      expect(adapter.verifyWebhook({ "x-unipile-secret": "whsec_li" }, "{}")).toBe(true);
      expect(adapter.verifyWebhook({ "x-unipile-secret": "wrong_secret" }, "{}")).toBe(false);
      expect(adapter.verifyWebhook({}, "{}")).toBe(false);
    });
  });

  describe("parseEventWebhook", () => {
    const adapter = infra({});

    it("maps message_received to reply", () => {
      const event = adapter.parseEventWebhook({
        event: "message_received",
        event_id: "ev_1",
        account_id: "li_acct_1",
        sender: { profile_url: "https://linkedin.com/in/jane" },
        message: "I'm interested",
        timestamp: "2026-06-11T12:00:00Z",
      });
      expect(event).toEqual({
        type: "reply",
        providerEventId: "ev_1",
        connectedAccountRef: "li_acct_1",
        fromProfileUrl: "https://linkedin.com/in/jane",
        body: "I'm interested",
        receivedAt: "2026-06-11T12:00:00Z",
      });
    });

    it("maps new_relation to relationship_accepted", () => {
      const event = adapter.parseEventWebhook({
        event: "new_relation",
        event_id: "ev_2",
        account_id: "li_acct_2",
        user_profile_url: "https://linkedin.com/in/bob",
      });
      expect(event).toEqual({
        type: "relationship_accepted",
        providerEventId: "ev_2",
        connectedAccountRef: "li_acct_2",
        profileUrl: "https://linkedin.com/in/bob",
      });
    });

    it("maps account_status OK to active with metadata round-trip", () => {
      const event = adapter.parseEventWebhook({
        event: "account_status",
        event_id: "ev_3",
        account_id: "li_acct_3",
        status: "OK",
        profile_url: "https://linkedin.com/in/carol",
        display_name: "Carol Smith",
        name: "acct-uuid-99",
      });
      expect(event).toEqual({
        type: "account_status",
        providerEventId: "ev_3",
        connectedAccountRef: "li_acct_3",
        status: "active",
        profileUrl: "https://linkedin.com/in/carol",
        displayName: "Carol Smith",
        vanteraAccountId: "acct-uuid-99",
      });
    });

    it("maps account_status CREATION_SUCCESS to active", () => {
      const event = adapter.parseEventWebhook({
        event: "account_status",
        event_id: "ev_4",
        account_id: "li_acct_4",
        status: "CREATION_SUCCESS",
        name: "acct-uuid-88",
      });
      expect(event).not.toBeNull();
      expect(event!.type).toBe("account_status");
      const ev = event as Extract<typeof event, { type: "account_status" }>;
      expect(ev.status).toBe("active");
      expect(ev.vanteraAccountId).toBe("acct-uuid-88");
    });

    it("maps account_status DISCONNECTED to disconnected", () => {
      const event = adapter.parseEventWebhook({
        event: "account_status",
        event_id: "ev_5",
        account_id: "li_acct_5",
        status: "DISCONNECTED",
      });
      expect(event).toEqual({
        type: "account_status",
        providerEventId: "ev_5",
        connectedAccountRef: "li_acct_5",
        status: "disconnected",
        profileUrl: null,
        displayName: null,
        vanteraAccountId: null,
      });
    });

    it("maps account_id to connectedAccountRef as string", () => {
      const event = adapter.parseEventWebhook({
        event: "new_relation",
        event_id: "ev_6",
        account_id: 12345,
        user_profile_url: "https://linkedin.com/in/dave",
      });
      expect(event).not.toBeNull();
      expect(event!.connectedAccountRef).toBe("12345");
    });

    it("returns null for unknown event types and malformed payloads", () => {
      expect(adapter.parseEventWebhook({ event: "unknown_event" })).toBeNull();
      expect(adapter.parseEventWebhook(null)).toBeNull();
      expect(adapter.parseEventWebhook("junk")).toBeNull();
      expect(adapter.parseEventWebhook({})).toBeNull();
    });
  });
});
