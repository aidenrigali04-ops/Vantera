import { describe, expect, it, vi } from "vitest";
import { SmartleadEmailInfra } from "./smartlead";

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
  new SmartleadEmailInfra({ apiKey: "sk_test", webhookSecret: "whsec", fetchFn: fetchMock(responses) });

describe("SmartleadEmailInfra", () => {
  describe("send", () => {
    it("posts to the per-mailbox send endpoint and maps to SendResult", async () => {
      const fetchFn = fetchMock({
        "/email-accounts/mbx_1/send": { message_id: "msg_abc", sent_at: "2026-06-11T10:00:00Z" },
      });
      const adapter = new SmartleadEmailInfra({ apiKey: "sk_test", webhookSecret: "whsec", fetchFn });
      const result = await adapter.send({
        mailboxId: "mbx_1",
        to: "lead@example.com",
        subject: "Hello",
        body: "Hi there",
        campaignId: "camp-1",
        leadId: "lead-1",
      });
      expect(result).toEqual({ messageId: "msg_abc", sentAt: "2026-06-11T10:00:00Z" });

      const [url, init] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
      expect(url).toContain("/email-accounts/mbx_1/send");
      const body = JSON.parse(init.body as string);
      expect(body.to).toBe("lead@example.com");
      expect(body.subject).toBe("Hello");
      expect(body.body).toBe("Hi there");
      // no unsubscribeUrl → no List-Unsubscribe header
      expect(body.custom_headers).toBeUndefined();
    });

    it("adds List-Unsubscribe headers when unsubscribeUrl is provided", async () => {
      const fetchFn = fetchMock({
        "/email-accounts/mbx_1/send": { message_id: "msg_xyz", sent_at: "2026-06-11T10:01:00Z" },
      });
      const adapter = new SmartleadEmailInfra({ apiKey: "sk_test", webhookSecret: "whsec", fetchFn });
      await adapter.send({
        mailboxId: "mbx_1",
        to: "lead@example.com",
        subject: "Unsubscribe test",
        body: "body",
        campaignId: "camp-1",
        leadId: "lead-1",
        unsubscribeUrl: "https://unsub.example.com/out?id=abc",
      });

      const [, init] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string);
      expect(body.custom_headers).toEqual({
        "List-Unsubscribe": "<https://unsub.example.com/out?id=abc>",
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      });
    });
  });

  describe("warmupStatus", () => {
    it("maps COMPLETED to ready, anything else to warming, and returns dailyCap", async () => {
      const readyInfra = infra({
        "/email-accounts/mbx_2/warmup-stats": { warmup_status: "COMPLETED", max_email_per_day: 50 },
      });
      const ready = await readyInfra.warmupStatus("mbx_2");
      expect(ready).toEqual({ mailboxId: "mbx_2", phase: "ready", dailyCap: 50 });

      const warmingInfra = infra({
        "/email-accounts/mbx_3/warmup-stats": { warmup_status: "ONGOING", max_email_per_day: 15 },
      });
      const warming = await warmingInfra.warmupStatus("mbx_3");
      expect(warming).toEqual({ mailboxId: "mbx_3", phase: "warming", dailyCap: 15 });
    });
  });

  describe("provision", () => {
    it("calls the provisioning endpoint and maps to Mailbox[]", async () => {
      const fetchFn = fetchMock({
        "/smart-senders/order": {
          accounts: [
            { id: 101, email: "sdr1@domain.com", domain: "domain.com" },
            { id: 102, email: "sdr2@domain.com", domain: "domain.com" },
          ],
        },
      });
      const adapter = new SmartleadEmailInfra({ apiKey: "sk_test", webhookSecret: "whsec", fetchFn });
      const mailboxes = await adapter.provision({
        accountId: "acct-1",
        domainCount: 1,
        mailboxesPerDomain: 2,
      });
      expect(mailboxes).toEqual([
        { id: "101", address: "sdr1@domain.com", domain: "domain.com" },
        { id: "102", address: "sdr2@domain.com", domain: "domain.com" },
      ]);
      const [url] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
      expect(url).toContain("/smart-senders/order");
    });
  });

  describe("verifyWebhook", () => {
    it("returns true for matching secret, false for wrong/missing", () => {
      const adapter = new SmartleadEmailInfra({ apiKey: "sk_test", webhookSecret: "whsec", fetchFn: fetch });
      expect(adapter.verifyWebhook({ "x-smartlead-secret": "whsec" }, "{}")).toBe(true);
      expect(adapter.verifyWebhook({ "x-smartlead-secret": "wrong" }, "{}")).toBe(false);
      expect(adapter.verifyWebhook({}, "{}")).toBe(false);
    });
  });

  describe("parseEventWebhook", () => {
    const adapter = infra({});

    it("maps EMAIL_REPLY to reply event", () => {
      const event = adapter.parseEventWebhook({
        event_type: "EMAIL_REPLY",
        webhook_id: "wh_1",
        email_account_id: 42,
        from_email: "lead@acme.com",
        reply_body: "Sounds interesting",
        event_timestamp: "2026-06-11T12:00:00Z",
        message_id: "msg_99",
      });
      expect(event).toEqual({
        type: "reply",
        providerEventId: "wh_1",
        mailboxRef: "42",
        from: "lead@acme.com",
        body: "Sounds interesting",
        receivedAt: "2026-06-11T12:00:00Z",
        messageRef: "msg_99",
      });
    });

    it("falls back providerEventId to event_type+event_timestamp when webhook_id is missing", () => {
      const event = adapter.parseEventWebhook({
        event_type: "EMAIL_REPLY",
        email_account_id: 7,
        from_email: "a@b.com",
        reply_body: "hi",
        event_timestamp: "2026-01-01T00:00:00Z",
        message_id: null,
      });
      expect(event).not.toBeNull();
      expect(event!.providerEventId).toBe("EMAIL_REPLY_2026-01-01T00:00:00Z");
    });

    it("maps EMAIL_BOUNCE to bounce", () => {
      const event = adapter.parseEventWebhook({
        event_type: "EMAIL_BOUNCE",
        webhook_id: "wh_2",
        email_account_id: 5,
        to_email: "bounce@example.com",
        event_timestamp: "2026-06-11T12:00:00Z",
      });
      expect(event).toEqual({
        type: "bounce",
        providerEventId: "wh_2",
        mailboxRef: "5",
        recipient: "bounce@example.com",
      });
    });

    it("maps EMAIL_SPAM_COMPLAINT to complaint", () => {
      const event = adapter.parseEventWebhook({
        event_type: "EMAIL_SPAM_COMPLAINT",
        webhook_id: "wh_3",
        email_account_id: 5,
        to_email: "spam@example.com",
        event_timestamp: "2026-06-11T12:00:00Z",
      });
      expect(event).toEqual({
        type: "complaint",
        providerEventId: "wh_3",
        mailboxRef: "5",
        recipient: "spam@example.com",
      });
    });

    it("maps LEAD_UNSUBSCRIBED to unsubscribe using lead_email", () => {
      const event = adapter.parseEventWebhook({
        event_type: "LEAD_UNSUBSCRIBED",
        webhook_id: "wh_4",
        email_account_id: 9,
        lead_email: "unsub@example.com",
        event_timestamp: "2026-06-11T12:00:00Z",
      });
      expect(event).toEqual({
        type: "unsubscribe",
        providerEventId: "wh_4",
        mailboxRef: "9",
        recipient: "unsub@example.com",
      });
    });

    it("maps WARMUP_STATUS to warmup_update", () => {
      const event = adapter.parseEventWebhook({
        event_type: "WARMUP_STATUS",
        webhook_id: "wh_5",
        email_account_id: 3,
        warmup_status: "COMPLETED",
        max_email_per_day: 40,
        event_timestamp: "2026-06-11T12:00:00Z",
      });
      expect(event).toEqual({
        type: "warmup_update",
        providerEventId: "wh_5",
        mailboxRef: "3",
        phase: "ready",
        dailyCap: 40,
      });
    });

    it("returns null for unknown event types and malformed payloads", () => {
      expect(adapter.parseEventWebhook({ event_type: "UNKNOWN_EVENT" })).toBeNull();
      expect(adapter.parseEventWebhook(null)).toBeNull();
      expect(adapter.parseEventWebhook("string")).toBeNull();
    });
  });

  describe("error handling — Fix 2", () => {
    it("throws with status and body detail on non-ok response", async () => {
      const adapter = new SmartleadEmailInfra({
        apiKey: "sk_test",
        webhookSecret: "whsec",
        fetchFn: fetchError(422, "validation failed: to is required"),
      });
      await expect(
        adapter.send({ mailboxId: "mbx_1", to: "x@x.com", subject: "s", body: "b", campaignId: "c", leadId: "l" })
      ).rejects.toThrow(/422/);
      await expect(
        adapter.send({ mailboxId: "mbx_1", to: "x@x.com", subject: "s", body: "b", campaignId: "c", leadId: "l" })
      ).rejects.toThrow(/validation failed/);
    });
  });

  describe("response shape guards — Fix 3", () => {
    it("send rejects when response is missing message_id", async () => {
      const adapter = new SmartleadEmailInfra({
        apiKey: "sk_test",
        webhookSecret: "whsec",
        fetchFn: fetchMock({ "/email-accounts/mbx_1/send": {} }),
      });
      await expect(
        adapter.send({ mailboxId: "mbx_1", to: "x@x.com", subject: "s", body: "b", campaignId: "c", leadId: "l" })
      ).rejects.toThrow(/missing message_id/);
    });

    it("provision rejects when response is missing accounts array", async () => {
      const adapter = new SmartleadEmailInfra({
        apiKey: "sk_test",
        webhookSecret: "whsec",
        fetchFn: fetchMock({ "/smart-senders/order": {} }),
      });
      await expect(
        adapter.provision({ accountId: "a", domainCount: 1, mailboxesPerDomain: 1 })
      ).rejects.toThrow(/missing accounts/);
    });

    it("provision rejects when an account entry is missing id", async () => {
      const adapter = new SmartleadEmailInfra({
        apiKey: "sk_test",
        webhookSecret: "whsec",
        fetchFn: fetchMock({
          "/smart-senders/order": { accounts: [{ email: "sdr@d.com", domain: "d.com" }] },
        }),
      });
      await expect(
        adapter.provision({ accountId: "a", domainCount: 1, mailboxesPerDomain: 1 })
      ).rejects.toThrow(/missing id/);
    });
  });

  describe("warmupStatus dailyCap guard — Fix 4", () => {
    it("returns dailyCap 0 when max_email_per_day is null", async () => {
      const adapter = infra({
        "/email-accounts/mbx_null/warmup-stats": { warmup_status: "ONGOING", max_email_per_day: null },
      });
      const status = await adapter.warmupStatus("mbx_null");
      expect(status).toEqual({ mailboxId: "mbx_null", phase: "warming", dailyCap: 0 });
    });
  });
});
