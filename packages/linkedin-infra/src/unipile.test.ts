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
        success: "https://app.test/settings/senders?connected=1",
        failure: "https://app.test/settings/senders?connected=failed",
      });
      expect(captured.body.success_redirect_url).toBe("https://app.test/settings/senders?connected=1");
      expect(captured.body.failure_redirect_url).toBe("https://app.test/settings/senders?connected=failed");
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

  describe("listAccounts", () => {
    it("maps connected LinkedIn accounts (id→providerRef, name→displayName, publicIdentifier→profileUrl, sources→status) and filters non-LinkedIn", async () => {
      const adapter = infra({
        "/api/v1/accounts": {
          object: "AccountList",
          items: [
            {
              object: "Account", id: "acc_1", type: "LINKEDIN", name: "Jane Doe",
              connection_params: { im: { publicIdentifier: "jane-doe-123" } },
              sources: [{ id: "acc_1_MESSAGING", status: "OK" }],
            },
            {
              object: "Account", id: "acc_2", type: "LINKEDIN", name: "Bob",
              connection_params: { im: { publicIdentifier: "bob-9" } },
              sources: [{ id: "x", status: "CREDENTIALS" }],
            },
            { object: "Account", id: "mail_1", type: "GOOGLE", name: "Mailbox" },
          ],
        },
      });
      await expect(adapter.listAccounts()).resolves.toEqual([
        { providerRef: "acc_1", displayName: "Jane Doe", profileUrl: "https://www.linkedin.com/in/jane-doe-123", status: "active" },
        { providerRef: "acc_2", displayName: "Bob", profileUrl: "https://www.linkedin.com/in/bob-9", status: "restricted" },
      ]);
    });

    it("returns [] when the workspace has no accounts", async () => {
      const adapter = infra({ "/api/v1/accounts": { object: "AccountList", items: [] } });
      await expect(adapter.listAccounts()).resolves.toEqual([]);
    });

    it("marks a DISCONNECTED source as disconnected and a missing publicIdentifier as null profileUrl", async () => {
      const adapter = infra({
        "/api/v1/accounts": {
          items: [{ id: "acc_3", type: "LINKEDIN", name: "Zoe", connection_params: { im: {} }, sources: [{ status: "DISCONNECTED" }] }],
        },
      });
      await expect(adapter.listAccounts()).resolves.toEqual([
        { providerRef: "acc_3", displayName: "Zoe", profileUrl: null, status: "disconnected" },
      ]);
    });

    // A just-created account has no sources yet: the provider hasn't finished the initial
    // sync. Reporting that as "disconnected" is a claim we can't support -- and it strands a
    // user who just connected, because the onboarding gate only counts connecting|active.
    it("reports an account whose sources have not synced yet as connecting, not disconnected", async () => {
      for (const sources of [undefined, []]) {
        const adapter = infra({
          "/api/v1/accounts": {
            items: [{ id: "acc_new", type: "LINKEDIN", name: "Fresh", connection_params: { im: { publicIdentifier: "fresh-1" } }, sources }],
          },
        });
        await expect(adapter.listAccounts()).resolves.toEqual([
          { providerRef: "acc_new", displayName: "Fresh", profileUrl: "https://www.linkedin.com/in/fresh-1", status: "connecting" },
        ]);
      }
    });
  });

  describe("deleteConnectedAccount", () => {
    it("DELETEs the provider account by ref", async () => {
      const fetchFn = fetchMock({ "/api/v1/accounts/acc_1": { object: "AccountDeleted" } });
      const adapter = new UnipileLinkedInInfra({
        apiKey: "key_test",
        dsn: "api.unipile.example.com:13000",
        webhookSecret: "whsec_li",
        fetchFn,
      });
      await adapter.deleteConnectedAccount("acc_1");
      const [url, init] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
      expect(url).toContain("/api/v1/accounts/acc_1");
      expect(init.method).toBe("DELETE");
    });

    it("treats an already-removed account (404) as success", async () => {
      const adapter = new UnipileLinkedInInfra({
        apiKey: "k",
        dsn: "api.unipile.example.com:13000",
        webhookSecret: "s",
        fetchFn: fetchError(404, "not found"),
      });
      await expect(adapter.deleteConnectedAccount("gone")).resolves.toBeUndefined();
    });

    it("propagates a non-404 provider error", async () => {
      const adapter = new UnipileLinkedInInfra({
        apiKey: "k",
        dsn: "api.unipile.example.com:13000",
        webhookSecret: "s",
        fetchFn: fetchError(500, "server error"),
      });
      await expect(adapter.deleteConnectedAccount("x")).rejects.toThrow(/500/);
    });
  });

  describe("sendInvite", () => {
    it("resolves a public slug to the member provider_id, then invites with it", async () => {
      // Unipile's /users/invite wants the Provider internal id (ACoAA…), NOT the public vanity
      // slug — passing the slug 400s. The id is read from the user-profile endpoint first.
      const fetchFn = fetchMock({
        "/users/janedoe": { object: "UserProfile", public_identifier: "janedoe", provider_id: "ACoAA_jane" },
        "/users/invite": { invitation_id: "inv_abc", sent_at: "2026-06-11T10:00:00Z" },
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
      expect(result).toEqual({
        id: "inv_abc",
        sentAt: "2026-06-11T10:00:00Z",
        prospectProviderRef: "ACoAA_jane",
      });

      const calls = (fetchFn as ReturnType<typeof vi.fn>).mock.calls;
      expect(String(calls[0]![0])).toContain("/api/v1/users/janedoe"); // GET resolution first
      const [inviteUrl, init] = calls[1] as [string, RequestInit];
      expect(inviteUrl).toContain("/api/v1/users/invite");
      const body = JSON.parse(init.body as string);
      expect(body.account_id).toBe("conn-1");
      expect(body.provider_id).toBe("ACoAA_jane"); // the resolved provider_id, NOT the public slug
      expect(body.profile_url).toBeUndefined();
      expect(body.message).toBeUndefined(); // note-LESS request — LinkedIn caps invite notes
    });

    it("skips the lookup when the url already carries the provider_id (member-id url)", async () => {
      const fetchFn = fetchMock({
        "/users/invite": { invitation_id: "inv_2", sent_at: "2026-06-11T10:00:00Z" },
      });
      const adapter = new UnipileLinkedInInfra({
        apiKey: "key_test",
        dsn: "api.unipile.example.com:13000",
        webhookSecret: "whsec_li",
        fetchFn,
      });
      await adapter.sendInvite({ connectedAccountId: "conn-1", profileUrl: "https://www.linkedin.com/in/ACoAA_jane" });

      const calls = (fetchFn as ReturnType<typeof vi.fn>).mock.calls;
      expect(calls).toHaveLength(1); // no GET resolution — straight to the invite
      const body = JSON.parse((calls[0]![1] as RequestInit).body as string);
      expect(body.provider_id).toBe("ACoAA_jane");
    });

    it("throws when a public slug cannot be resolved to a provider_id", async () => {
      const fetchFn = fetchMock({
        "/users/ghost": { object: "UserProfile", public_identifier: "ghost" }, // no provider_id
      });
      const adapter = new UnipileLinkedInInfra({
        apiKey: "key_test",
        dsn: "api.unipile.example.com:13000",
        webhookSecret: "whsec_li",
        fetchFn,
      });
      await expect(adapter.sendInvite({ connectedAccountId: "c", profileUrl: "https://linkedin.com/in/ghost" }))
        .rejects.toThrow(/provider_id/);
    });
  });

  describe("sendMessage", () => {
    it("resolves the slug to a provider_id, then starts a chat with it", async () => {
      const fetchFn = fetchMock({
        "/users/johndoe": { object: "UserProfile", public_identifier: "johndoe", provider_id: "ACoAA_john" },
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
      expect(result).toEqual({
        id: "msg_xyz",
        sentAt: "2026-06-11T11:00:00Z",
        prospectProviderRef: "ACoAA_john",
      });

      const calls = (fetchFn as ReturnType<typeof vi.fn>).mock.calls;
      const chatCall = calls.find((c) => String(c[0]).includes("/api/v1/chats"))!;
      const body = JSON.parse((chatCall[1] as RequestInit).body as string);
      expect(body.account_id).toBe("conn-2");
      expect(body.attendees_ids).toEqual(["ACoAA_john"]); // the resolved provider_id, not the slug
      expect(body.text).toBe("Following up!");
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

  // Reconciled 2026-06-28 against CAPTURED LIVE payloads (Vercel runtime logs). Real Unipile
  // webhooks carry NO event_id; a message is keyed by message_id and the sender is an attendees[]
  // entry. The prior fixtures used assumed shapes and the parser returned null for every real event.
  describe("parseEventWebhook", () => {
    const adapter = infra({});

    // The exact captured message_received shape (provider/member-id URLs, attendees, is_sender).
    const realReply = (over: Record<string, unknown> = {}) => ({
      event: "message_received",
      account_id: "0uuEXoQMSKOiZiTtCb2cgg",
      account_type: "LINKEDIN",
      account_info: { type: "LINKEDIN", feature: "classic", user_id: "ACoAA_OWNER" },
      webhook_name: "vantera-linkedin-messaging",
      chat_id: "1pVHl3kUWG6CORRtlY9fyA",
      attendees: [
        {
          attendee_id: "yq0vqte3XVaAOCzZn1SILw",
          attendee_provider_id: "ACoAA_RYAN",
          attendee_name: "Ryan Cunningham",
          attendee_profile_url: "https://www.linkedin.com/in/ACoAA_RYAN",
        },
      ],
      // sender carries no profile_url — resolution must fall back to the matching attendee
      sender: { attendee_id: "yq0vqte3XVaAOCzZn1SILw", attendee_provider_id: "ACoAA_RYAN" },
      message: "Sounds interesting, tell me more",
      message_id: "msg_real_1",
      timestamp: "2026-06-28T09:37:13Z",
      is_sender: false,
      ...over,
    });

    it("maps a real message_received to reply (message_id as id; sender via attendees)", () => {
      const event = adapter.parseEventWebhook(realReply());
      expect(event).toEqual({
        type: "reply",
        providerEventId: "msg_real_1",
        connectedAccountRef: "0uuEXoQMSKOiZiTtCb2cgg",
        fromProfileUrl: "https://www.linkedin.com/in/ACoAA_RYAN",
        // the layered-matching identity: provider id + name ride along (no public slug here)
        fromProviderRef: "ACoAA_RYAN",
        fromPublicIdentifier: null,
        fromName: "Ryan Cunningham",
        body: "Sounds interesting, tell me more",
        receivedAt: "2026-06-28T09:37:13Z",
      });
    });

    it("ignores our own outbound message echoed back (is_sender truthy)", () => {
      expect(adapter.parseEventWebhook(realReply({ is_sender: true }))).toBeNull();
      expect(adapter.parseEventWebhook(realReply({ is_sender: 1 }))).toBeNull();
      expect(adapter.parseEventWebhook(realReply({ is_sender: "true" }))).toBeNull();
    });

    it("falls back to provider_message_id when message_id is absent", () => {
      const event = adapter.parseEventWebhook(realReply({ message_id: undefined, provider_message_id: "pmid_9" }));
      expect(event).toMatchObject({ type: "reply", providerEventId: "pmid_9" });
    });

    it("resolves the sender as the non-self attendee in a 1:1 chat", () => {
      // sender has neither profile_url nor a matching provider id — pick the attendee that isn't us
      const event = adapter.parseEventWebhook(
        realReply({ sender: {}, attendees: [
          { attendee_provider_id: "ACoAA_OWNER", attendee_profile_url: "https://www.linkedin.com/in/ACoAA_OWNER" },
          { attendee_provider_id: "ACoAA_RYAN", attendee_profile_url: "https://www.linkedin.com/in/ACoAA_RYAN" },
        ] })
      );
      expect(event).toMatchObject({ fromProfileUrl: "https://www.linkedin.com/in/ACoAA_RYAN" });
    });

    it("returns null when the message has no resolvable sender or body", () => {
      expect(adapter.parseEventWebhook(realReply({ sender: {}, attendees: [], account_info: {} }))).toBeNull();
      expect(adapter.parseEventWebhook(realReply({ message: "" }))).toBeNull();
    });

    it("maps new_relation to relationship_accepted with a synthesized dedupe id", () => {
      const event = adapter.parseEventWebhook({
        event: "new_relation",
        account_id: "li_acct_2",
        user_profile_url: "https://www.linkedin.com/in/ACoAA_BOB",
      });
      expect(event).toEqual({
        type: "relationship_accepted",
        providerEventId: "relation:li_acct_2:https://www.linkedin.com/in/ACoAA_BOB",
        connectedAccountRef: "li_acct_2",
        profileUrl: "https://www.linkedin.com/in/ACoAA_BOB",
        fromProviderRef: null,
        fromPublicIdentifier: null,
        fromName: null,
      });
    });

    it("resolves new_relation profile url from a public identifier or provider id", () => {
      expect(
        adapter.parseEventWebhook({ event: "new_relation", account_id: "a", user_public_identifier: "jane-doe" })
      ).toMatchObject({ profileUrl: "https://www.linkedin.com/in/jane-doe" });
      expect(
        adapter.parseEventWebhook({ event: "new_relation", account_id: "a", user_provider_id: "ACoAA_X" })
      ).toMatchObject({ profileUrl: "https://www.linkedin.com/in/ACoAA_X" });
    });

    it("maps account_status OK to active with metadata round-trip", () => {
      const event = adapter.parseEventWebhook({
        event: "account_status",
        account_id: "li_acct_3",
        status: "OK",
        profile_url: "https://linkedin.com/in/carol",
        display_name: "Carol Smith",
        name: "acct-uuid-99",
      });
      expect(event).toEqual({
        type: "account_status",
        providerEventId: "status:li_acct_3:OK",
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
        account_id: "li_acct_5",
        status: "DISCONNECTED",
      });
      expect(event).toEqual({
        type: "account_status",
        providerEventId: "status:li_acct_5:DISCONNECTED",
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
        account_id: 12345,
        user_profile_url: "https://www.linkedin.com/in/dave",
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
        const ev = infra.parseEventWebhook({ event: "account_status", account_id: "a1", status, name: "acc_1" });
        expect(ev).toMatchObject({ type: "account_status", status: "restricted" });
      }
    });

    it("still maps OK->active and DISCONNECTED->disconnected", () => {
      const infra = new UnipileLinkedInInfra({ apiKey: "k", dsn: "d", webhookSecret: "s" });
      expect(infra.parseEventWebhook({ event: "account_status", account_id: "a", status: "OK", name: "x" })).toMatchObject({ status: "active" });
      expect(infra.parseEventWebhook({ event: "account_status", account_id: "a", status: "DISCONNECTED", name: "x" })).toMatchObject({ status: "disconnected" });
    });
  });

  // The account-status webhook does NOT use the flat `event` discriminator the fixtures above
  // assume — it arrives wrapped in an `AccountStatus` envelope carrying `message` as the state
  // (documented shape). Parsing the flat form only is what silently dropped every status event.
  describe("parseEventWebhook — real AccountStatus envelope", () => {
    const adapter = infra({});
    const envelope = (message: string, over: Record<string, unknown> = {}) => ({
      AccountStatus: { account_id: "h_EKCy2lRLef5NzHp0iw4A", account_type: "LINKEDIN", message, ...over },
    });

    it("parses the documented envelope instead of discarding it", () => {
      expect(adapter.parseEventWebhook(envelope("CREDENTIALS"))).toEqual({
        type: "account_status",
        providerEventId: "status:h_EKCy2lRLef5NzHp0iw4A:CREDENTIALS",
        connectedAccountRef: "h_EKCy2lRLef5NzHp0iw4A",
        status: "restricted",
        profileUrl: null,
        displayName: null,
        vanteraAccountId: null,
      });
    });

    it("maps the connect-time states to active", () => {
      for (const message of ["OK", "CREATION_SUCCESS", "RECONNECTED", "SYNC_SUCCESS"]) {
        expect(adapter.parseEventWebhook(envelope(message))).toMatchObject({
          type: "account_status",
          status: "active",
        });
      }
    });

    it("maps DELETED to disconnected", () => {
      expect(adapter.parseEventWebhook(envelope("DELETED"))).toMatchObject({ status: "disconnected" });
    });

    it("ignores the transient CONNECTING state rather than flapping the row", () => {
      expect(adapter.parseEventWebhook(envelope("CONNECTING"))).toBeNull();
    });

    it("dedupes LinkedIn's paired SYNC_SUCCESS payloads on one id", () => {
      const classic = adapter.parseEventWebhook(envelope("SYNC_SUCCESS", { product: "classic" }));
      const premium = adapter.parseEventWebhook(envelope("SYNC_SUCCESS", { product: "recruiter" }));
      expect(classic!.providerEventId).toBe(premium!.providerEventId);
    });

    it("still accepts the flat shape, so nothing that already worked regresses", () => {
      expect(
        adapter.parseEventWebhook({ event: "account_status", account_id: "a1", status: "OK" })
      ).toMatchObject({ status: "active" });
    });
  });

  describe("createHostedAuthLink — hosted-auth white-label domain", () => {
    it("rewrites the provider host to the configured custom domain, preserving path + query", async () => {
      const fetchFn = (async () => new Response(JSON.stringify({ url: "https://accounts.unipile.com/abc?token=xyz" }), { status: 200 })) as unknown as typeof fetch;
      const infra = new UnipileLinkedInInfra({ apiKey: "k", dsn: "d", webhookSecret: "s", fetchFn, hostedAuthDomain: "connect.vanterasystem.com" });
      const link = await infra.createHostedAuthLink("acc_1");
      expect(new URL(link.url).host).toBe("connect.vanterasystem.com");
      expect(link.url).toBe("https://connect.vanterasystem.com/abc?token=xyz");
    });

    it("leaves an already-on-domain url unchanged", async () => {
      const fetchFn = (async () => new Response(JSON.stringify({ url: "https://connect.vanterasystem.com/abc" }), { status: 200 })) as unknown as typeof fetch;
      const infra = new UnipileLinkedInInfra({ apiKey: "k", dsn: "d", webhookSecret: "s", fetchFn, hostedAuthDomain: "connect.vanterasystem.com" });
      await expect(infra.createHostedAuthLink("acc_1")).resolves.toMatchObject({ url: "https://connect.vanterasystem.com/abc" });
    });

    it("warns but proceeds (no rewrite) when hostedAuthDomain is unset", async () => {
      const fetchFn = (async () => new Response(JSON.stringify({ url: "https://accounts.unipile.com/abc" }), { status: 200 })) as unknown as typeof fetch;
      const infra = new UnipileLinkedInInfra({ apiKey: "k", dsn: "d", webhookSecret: "s", fetchFn });
      await expect(infra.createHostedAuthLink("acc_1")).resolves.toMatchObject({ url: "https://accounts.unipile.com/abc" });
    });

    // A configured value is a BARE HOSTNAME. Assigning `url.host` a value that isn't one
    // fails silently in the URL spec -- "https://host" parses as the hostname "https", which
    // shipped users a link to https://https/... Every bad value must fall back to the
    // provider URL (which works) rather than emit a link that cannot resolve.
    const linkFor = async (hostedAuthDomain: string) => {
      const fetchFn = (async () => new Response(JSON.stringify({ url: "https://accounts.unipile.com/abc?token=xyz" }), { status: 200 })) as unknown as typeof fetch;
      const infra = new UnipileLinkedInInfra({ apiKey: "k", dsn: "d", webhookSecret: "s", fetchFn, hostedAuthDomain, appUrl: "https://www.vantera.test" });
      return (await infra.createHostedAuthLink("acc_1")).url;
    };

    it("tolerates a value written as a full URL instead of a bare host", async () => {
      expect(await linkFor("https://connect.vantera.test")).toBe("https://connect.vantera.test/abc?token=xyz");
      expect(await linkFor("https://connect.vantera.test/")).toBe("https://connect.vantera.test/abc?token=xyz");
      expect(await linkFor("  connect.vantera.test  ")).toBe("https://connect.vantera.test/abc?token=xyz");
    });

    it("refuses to rewrite onto the app's own host, which would 404 on the token path", async () => {
      // The provider's path is not a route this app serves, so this must not be rewritten.
      expect(await linkFor("www.vantera.test")).toBe("https://accounts.unipile.com/abc?token=xyz");
      expect(await linkFor("https://www.vantera.test")).toBe("https://accounts.unipile.com/abc?token=xyz");
    });

    it("keeps the working provider url when the value is unusable", async () => {
      for (const bad of ["", "   ", "not a host", "http://"]) {
        expect(await linkFor(bad)).toBe("https://accounts.unipile.com/abc?token=xyz");
      }
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
      // member-id url → no resolution lookup, so the error surfaces from the invite POST itself
      await expect(adapter.sendInvite({ connectedAccountId: "c", profileUrl: "https://linkedin.com/in/ACoAA_x" }))
        .rejects.toThrow(/403/);
      await expect(adapter.sendInvite({ connectedAccountId: "c", profileUrl: "https://linkedin.com/in/ACoAA_x" }))
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
      await expect(adapter.sendInvite({ connectedAccountId: "c", profileUrl: "https://linkedin.com/in/ACoAA_x" }))
        .rejects.toThrow(/missing invitation_id/);
    });

    it("sendMessage rejects when response is missing message_id", async () => {
      const adapter = new UnipileLinkedInInfra({
        apiKey: "key_test",
        dsn: "api.unipile.example.com:13000",
        webhookSecret: "whsec_li",
        fetchFn: fetchMock({ "/api/v1/chats": {} }),
      });
      await expect(adapter.sendMessage({ connectedAccountId: "c", profileUrl: "https://linkedin.com/in/ACoAA_x", body: "hi" }))
        .rejects.toThrow(/missing message_id/);
    });

    // The invite/message is ALREADY sent once the provider returns its id — a missing sent_at
    // (Unipile doesn't always echo it) must NOT throw, or a delivered send gets marked failed.
    it("sendInvite does not throw when the provider omits sent_at (invite was sent)", async () => {
      const adapter = new UnipileLinkedInInfra({
        apiKey: "key_test",
        dsn: "api.unipile.example.com:13000",
        webhookSecret: "whsec_li",
        fetchFn: fetchMock({ "/api/v1/users/invite": { invitation_id: "inv_ok" } }),
      });
      const result = await adapter.sendInvite({ connectedAccountId: "c", profileUrl: "https://linkedin.com/in/ACoAA_x" });
      expect(result.id).toBe("inv_ok");
      expect(() => new Date(result.sentAt).toISOString()).not.toThrow();
      expect(Number.isNaN(Date.parse(result.sentAt))).toBe(false);
    });

    it("sendMessage does not throw when the provider omits sent_at (message was sent)", async () => {
      const adapter = new UnipileLinkedInInfra({
        apiKey: "key_test",
        dsn: "api.unipile.example.com:13000",
        webhookSecret: "whsec_li",
        fetchFn: fetchMock({ "/api/v1/chats": { message_id: "msg_ok" } }),
      });
      const result = await adapter.sendMessage({ connectedAccountId: "c", profileUrl: "https://linkedin.com/in/ACoAA_x", body: "hi" });
      expect(result.id).toBe("msg_ok");
      expect(Number.isNaN(Date.parse(result.sentAt))).toBe(false);
    });
  });

  describe("reads (Intent Agent) — real Unipile shapes", () => {
    it("searchPosts maps the Post shape (social_id ref, author public_identifier, parsed_datetime)", async () => {
      const adapter = infra({
        "/linkedin/search": { object: "LinkedinSearch", items: [
          { type: "POST", social_id: "urn:li:ugcPost:99", id: "88", share_url: "https://li/p1", text: "onboarding churn pain", date: "2d", parsed_datetime: "2026-06-19T23:35:37.248Z", author: { public_identifier: "ann-r", id: "ACoAA_ann", name: "Ann", headline: "RevOps" } },
        ] },
      });
      const posts = await adapter.searchPosts({ connectedAccountId: "c1", query: "churn", limit: 10 });
      expect(posts).toEqual([
        { postRef: "urn:li:ugcPost:99", authorProfileUrl: "https://www.linkedin.com/in/ann-r", authorName: "Ann", authorHeadline: "RevOps", text: "onboarding churn pain", postedAt: "2026-06-19T23:35:37.248Z", url: "https://li/p1" },
      ]);
    });

    it("listProfilePosts resolves the slug to provider_id, then reads that user's posts", async () => {
      const adapter = infra({
        "/users/creator?": { object: "UserProfile", public_identifier: "creator", provider_id: "ACoAA_creator" },
        "/posts?account_id": { object: "PostList", items: [{ social_id: "urn:li:activity:9", text: "hiring an SDR", author: { public_identifier: "creator", id: "ACoAA_creator", name: "Cara" } }] },
      });
      const posts = await adapter.listProfilePosts({ connectedAccountId: "c1", profileUrl: "https://www.linkedin.com/in/creator", limit: 5 });
      expect(posts.map((p) => p.postRef)).toEqual(["urn:li:activity:9"]);
      expect(posts[0]!.authorProfileUrl).toBe("https://www.linkedin.com/in/creator");
    });

    it("listPostEngagers maps reactions (author) + comments (author_details), comment wins the dedup", async () => {
      const adapter = infra({
        "/reactions": { object: "PostReactionList", items: [
          { object: "PostReaction", value: "LIKE", author: { id: "ACoAA_x", type: "INDIVIDUAL", name: "Xan", headline: "CX", profile_url: "https://www.linkedin.com/in/ACoAA_x" } },
        ] },
        "/comments": { object: "CommentList", items: [
          { object: "Comment", id: "cmt1", author: "Xan", author_details: { id: "ACoAA_x", headline: "CX", profile_url: "https://www.linkedin.com/in/ACoAA_x" }, text: "me too" },
        ] },
      });
      const engagers = await adapter.listPostEngagers({ connectedAccountId: "c1", postRef: "urn:li:activity:7", limit: 10 });
      expect(engagers).toEqual([
        { profileUrl: "https://www.linkedin.com/in/ACoAA_x", name: "Xan", headline: "CX", kind: "comment", text: "me too" },
      ]);
    });

    it("getProfile maps the UserProfile shape (no profile_url field; builds from public_identifier; no company)", async () => {
      const adapter = infra({
        "/users/lee": { object: "UserProfile", public_identifier: "lee", provider_id: "ACoAA_lee", first_name: "Lee", last_name: "Park", headline: "Head of CX", location: "Austin" },
      });
      const profile = await adapter.getProfile({ connectedAccountId: "c1", profileUrl: "https://www.linkedin.com/in/lee" });
      expect(profile).toEqual({
        profileUrl: "https://www.linkedin.com/in/lee", firstName: "Lee", lastName: "Park", headline: "Head of CX", companyName: null, location: "Austin",
      });
    });

    it("getProfile returns null when the provider read fails", async () => {
      const adapter = new UnipileLinkedInInfra({ apiKey: "k", dsn: "api.unipile.example.com:13000", webhookSecret: "w", fetchFn: fetchError(404, "not found") });
      expect(await adapter.getProfile({ connectedAccountId: "c1", profileUrl: "https://linkedin.com/in/ghost" })).toBeNull();
    });
  });

  describe("setupWebhook", () => {
    it("deletes the stale webhook at our URL and recreates one per source WITH the secret header", async () => {
      const HOOK_URL = "https://app.test/api/webhooks/linkedin";
      const posts: any[] = [];
      const deletes: string[] = [];
      const fetchFn = (async (url: string, init?: RequestInit) => {
        const method = init?.method ?? "GET";
        if (url.includes("/api/v1/webhooks/") && method === "DELETE") {
          deletes.push(url.split("/api/v1/webhooks/")[1]!);
          return { ok: true, json: async () => ({}), text: async () => "" };
        }
        if (url.includes("/api/v1/webhooks") && method === "POST") {
          posts.push(JSON.parse(String(init?.body)));
          return { ok: true, json: async () => ({ webhook_id: "wh_new" }), text: async () => "" };
        }
        if (url.includes("/api/v1/webhooks")) {
          // one pre-existing, misconfigured webhook at our URL
          return { ok: true, json: async () => ({ items: [{ id: "wh_old", request_url: HOOK_URL, source: "messaging" }] }), text: async () => "" };
        }
        throw new Error(`unmocked ${method} ${url}`);
      }) as unknown as typeof fetch;

      const adapter = new UnipileLinkedInInfra({ apiKey: "k", dsn: "api.unipile.example.com:13000", webhookSecret: "whsec_li", fetchFn });
      const result = await adapter.setupWebhook(HOOK_URL);

      expect(result.secretConfigured).toBe(true);
      expect(result.deleted).toBe(1);
      expect(deletes).toEqual(["wh_old"]); // the stale one was removed
      // every recreated webhook carries our secret header, so the route's verify will now pass
      for (const body of posts) {
        expect(body.request_url).toBe(HOOK_URL);
        expect(body.headers).toEqual([{ key: "x-unipile-secret", value: "whsec_li" }]);
      }
      expect(posts.map((b) => b.source).sort()).toEqual(["account_status", "messaging", "users"]);
      expect(result.created.every((c) => c.ok)).toBe(true);
    });
  });

  describe("getConnectionState", () => {
    it("reports connected on a 1st-degree network_distance, with the raw value", async () => {
      const adapter = infra({ "/users/ACoAA_x": { object: "UserProfile", network_distance: "DISTANCE_1" } });
      expect(await adapter.getConnectionState({ connectedAccountId: "c", profileUrl: "https://linkedin.com/in/ACoAA_x" }))
        .toEqual({ connected: true, distance: "DISTANCE_1" });
    });

    it("reports not-connected on 2nd-degree, and on a failed read", async () => {
      const second = infra({ "/users/ACoAA_y": { object: "UserProfile", network_distance: "DISTANCE_2" } });
      expect(await second.getConnectionState({ connectedAccountId: "c", profileUrl: "https://linkedin.com/in/ACoAA_y" }))
        .toEqual({ connected: false, distance: "DISTANCE_2" });
      const errAdapter = new UnipileLinkedInInfra({ apiKey: "k", dsn: "api.unipile.example.com:13000", webhookSecret: "w", fetchFn: fetchError(404, "nope") });
      expect(await errAdapter.getConnectionState({ connectedAccountId: "c", profileUrl: "https://linkedin.com/in/ghost" }))
        .toEqual({ connected: false, distance: null });
    });
  });

  describe("probeWebhook", () => {
    it("POSTs an empty event to OUR route with the secret header; non-401 ⇒ verified", async () => {
      let captured: { url?: string; init?: RequestInit } = {};
      const fetchFn = (async (url: string, init?: RequestInit) => {
        captured = { url, init };
        return { status: 200, ok: true, json: async () => ({}), text: async () => "ignored" };
      }) as unknown as typeof fetch;
      const adapter = new UnipileLinkedInInfra({ apiKey: "k", dsn: "api.unipile.example.com:13000", webhookSecret: "whsec_li", fetchFn });

      const r = await adapter.probeWebhook("https://app.test/api/webhooks/linkedin");
      expect(r).toEqual({ status: 200, verified: true });
      expect(captured.url).toBe("https://app.test/api/webhooks/linkedin");
      expect(captured.init?.method).toBe("POST");
      expect((captured.init?.headers as Record<string, string>)["x-unipile-secret"]).toBe("whsec_li");
      expect(captured.init?.body).toBe("{}");
    });

    it("reports verified:false on a 401 (secret mismatch)", async () => {
      const fetchFn = (async () => ({ status: 401, ok: false, json: async () => ({}), text: async () => "invalid signature" })) as unknown as typeof fetch;
      const adapter = new UnipileLinkedInInfra({ apiKey: "k", dsn: "api.unipile.example.com:13000", webhookSecret: "x", fetchFn });
      expect(await adapter.probeWebhook("https://app.test/api/webhooks/linkedin")).toEqual({ status: 401, verified: false });
    });
  });
});

describe("isLinkedInInfraConfigured", () => {
  it("is false when any of the three provider vars is missing, true when all are set", async () => {
    const { isLinkedInInfraConfigured } = await import("./unipile");
    const saved = { ...process.env };
    try {
      delete process.env.UNIPILE_API_KEY;
      process.env.UNIPILE_DSN = "api.test";
      process.env.UNIPILE_WEBHOOK_SECRET = "s";
      expect(isLinkedInInfraConfigured()).toBe(false);
      process.env.UNIPILE_API_KEY = "k";
      expect(isLinkedInInfraConfigured()).toBe(true);
    } finally {
      process.env = saved;
    }
  });
});
