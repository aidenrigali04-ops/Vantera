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
    text: async () => "",
  })) as unknown as typeof fetch;

/** Returns a fetch mock whose response is !ok with given status and body text. */
const fetchError = (status: number, body: string) =>
  vi.fn(async () => ({
    ok: false,
    status,
    json: async () => { throw new Error("not json"); },
    text: async () => body,
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
        },
      });
      const adapter = new UnipileLinkedInInfra({
        apiKey: "key_test",
        dsn: "api.unipile.example.com:13000",
        webhookSecret: "whsec_li",
        fetchFn,
      });
      const link = await adapter.createHostedAuthLink("acct-1");
      expect(link.url).toBe("https://auth.unipile.example.com/link/abc");
      expect(typeof link.expiresAt).toBe("string");
      expect(Date.parse(link.expiresAt)).toBeGreaterThan(Date.now());

      const [, init] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string);
      expect(body.providers).toContain("LINKEDIN");
      expect(body.name).toBe("acct-1");
    });
  });

  describe("createHostedAuthLink — required fields and redirects", () => {
    function makeInfra(captured: { body?: unknown } = {}) {
      const fetchFn = (async (_url: string, init?: RequestInit) => {
        captured.body = JSON.parse(String(init?.body));
        return new Response(JSON.stringify({ object: "HostedAuthUrl", url: "https://auth.example/x" }), { status: 200 });
      }) as unknown as typeof fetch;
      return new UnipileLinkedInInfra({ apiKey: "k", dsn: "api.unipile.example.com:13000", webhookSecret: "s", fetchFn });
    }

    it("sends all provider-required fields", async () => {
      const captured: { body?: any } = {};
      const infra = makeInfra(captured);
      const link = await infra.createHostedAuthLink("acct-123");
      expect(link.url).toBe("https://auth.example/x");
      expect(captured.body.type).toBe("create");
      expect(captured.body.providers).toEqual(["LINKEDIN"]);
      expect(captured.body.api_url).toBe("https://api.unipile.example.com:13000");
      expect(captured.body.name).toBe("acct-123");
      expect(captured.body.expiresOn).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(link.expiresAt).toBe(captured.body.expiresOn);
    });

    it("includes redirect urls and bypass flag when redirects are given", async () => {
      const captured: { body?: any } = {};
      const infra = makeInfra(captured);
      await infra.createHostedAuthLink("acct-123", {
        success: "https://app.test/settings/channels?connected=1",
        failure: "https://app.test/settings/channels?connected=failed",
      });
      expect(captured.body.success_redirect_url).toBe("https://app.test/settings/channels?connected=1");
      expect(captured.body.failure_redirect_url).toBe("https://app.test/settings/channels?connected=failed");
      expect(captured.body.bypass_success_screen).toBe(true);
    });

    it("omits redirect fields when none are given", async () => {
      const captured: { body?: any } = {};
      const infra = makeInfra(captured);
      await infra.createHostedAuthLink("acct-123");
      expect(captured.body.success_redirect_url).toBeUndefined();
      expect(captured.body.failure_redirect_url).toBeUndefined();
      expect(captured.body.bypass_success_screen).toBeUndefined();
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

  // TODO(Part B): these payloads use the old assumed shapes (event/event_id/status).
  // Real Unipile webhooks carry none of those — to be replaced with captured fixtures
  // when parseEventWebhook is reconciled (plan 2026-06-15, Part B). Until then the
  // parser silently returns null for real payloads.
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

    it("maps checkpoint/credential states to restricted", () => {
      const infra = new UnipileLinkedInInfra({ apiKey: "k", dsn: "d", webhookSecret: "s" });
      for (const status of ["CREDENTIALS", "CHECKPOINT", "PERMISSIONS", "ERROR", "STOPPED", "SYNC_ERROR"]) {
        const ev = infra.parseEventWebhook({ event: "account_status", event_id: "e1", account_id: "a1", status, name: "acc_1" });
        expect(ev).toMatchObject({ type: "account_status", status: "restricted" });
      }
    });

    it("still maps OK->active and DISCONNECTED->disconnected", () => {
      const infra = new UnipileLinkedInInfra({ apiKey: "k", dsn: "d", webhookSecret: "s" });
      expect(infra.parseEventWebhook({ event: "account_status", event_id: "e", account_id: "a", status: "OK", name: "x" })).toMatchObject({ status: "active" });
      expect(infra.parseEventWebhook({ event: "account_status", event_id: "e", account_id: "a", status: "DISCONNECTED", name: "x" })).toMatchObject({ status: "disconnected" });
    });
  });

  describe("createHostedAuthLink — hosted-auth domain assertion", () => {
    it("throws if hostedAuthDomain set and returned url is off-domain", async () => {
      const fetchFn = (async () => new Response(JSON.stringify({ url: "https://accounts.unipile.com/abc" }), { status: 200 })) as unknown as typeof fetch;
      const infra = new UnipileLinkedInInfra({ apiKey: "k", dsn: "d", webhookSecret: "s", fetchFn, hostedAuthDomain: "connect.vanterasystem.com" });
      await expect(infra.createHostedAuthLink("acc_1")).rejects.toThrow(/custom domain/i);
    });

    it("passes when hostedAuthDomain matches the returned url host", async () => {
      const fetchFn = (async () => new Response(JSON.stringify({ url: "https://connect.vanterasystem.com/abc" }), { status: 200 })) as unknown as typeof fetch;
      const infra = new UnipileLinkedInInfra({ apiKey: "k", dsn: "d", webhookSecret: "s", fetchFn, hostedAuthDomain: "connect.vanterasystem.com" });
      await expect(infra.createHostedAuthLink("acc_1")).resolves.toMatchObject({ url: expect.stringContaining("connect.vanterasystem.com") });
    });

    it("warns but proceeds when hostedAuthDomain is unset", async () => {
      const fetchFn = (async () => new Response(JSON.stringify({ url: "https://accounts.unipile.com/abc" }), { status: 200 })) as unknown as typeof fetch;
      const infra = new UnipileLinkedInInfra({ apiKey: "k", dsn: "d", webhookSecret: "s", fetchFn });
      await expect(infra.createHostedAuthLink("acc_1")).resolves.toMatchObject({ url: expect.any(String) });
    });
  });

  describe("error handling — Fix 2", () => {
    it("throws with status and body detail on non-ok response", async () => {
      const adapter = new UnipileLinkedInInfra({
        apiKey: "key_test",
        dsn: "api.unipile.example.com:13000",
        webhookSecret: "whsec_li",
        fetchFn: fetchError(403, "account not authorized"),
      });
      await expect(adapter.sendInvite({ connectedAccountId: "c", profileUrl: "https://linkedin.com/in/x" }))
        .rejects.toThrow(/403/);
      await expect(adapter.sendInvite({ connectedAccountId: "c", profileUrl: "https://linkedin.com/in/x" }))
        .rejects.toThrow(/account not authorized/);
    });
  });

  describe("response shape guards — Fix 3", () => {
    it("createHostedAuthLink rejects when response is missing url", async () => {
      const adapter = new UnipileLinkedInInfra({
        apiKey: "key_test",
        dsn: "api.unipile.example.com:13000",
        webhookSecret: "whsec_li",
        fetchFn: fetchMock({ "/api/v1/hosted/accounts/link": {} }),
      });
      await expect(adapter.createHostedAuthLink("acct-1")).rejects.toThrow(/missing url/);
    });

    it("sendInvite rejects when response is missing invitation_id", async () => {
      const adapter = new UnipileLinkedInInfra({
        apiKey: "key_test",
        dsn: "api.unipile.example.com:13000",
        webhookSecret: "whsec_li",
        fetchFn: fetchMock({ "/api/v1/users/invite": {} }),
      });
      await expect(adapter.sendInvite({ connectedAccountId: "c", profileUrl: "https://linkedin.com/in/x" }))
        .rejects.toThrow(/missing invitation_id/);
    });

    it("sendMessage rejects when response is missing message_id", async () => {
      const adapter = new UnipileLinkedInInfra({
        apiKey: "key_test",
        dsn: "api.unipile.example.com:13000",
        webhookSecret: "whsec_li",
        fetchFn: fetchMock({ "/api/v1/chats": {} }),
      });
      await expect(adapter.sendMessage({ connectedAccountId: "c", profileUrl: "https://linkedin.com/in/x", body: "hi" }))
        .rejects.toThrow(/missing message_id/);
    });
  });
});
