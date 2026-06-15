import { describe, expect, it, vi } from "vitest";
import { LoopMessageInfra, createMessageInfraFromEnv } from "./loopmessage";
import { InMemoryMessageInfra } from "./in-memory";

// ---------------------------------------------------------------------------
// Fake fetch helpers
// ---------------------------------------------------------------------------

function makeFakeFetch(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
}

const defaultCfg = {
  authKey: "auth-key-123",
  secretKey: "secret-key-456",
  webhookSecret: "webhook-secret-abc",
};

// ---------------------------------------------------------------------------
// sendMessage
// ---------------------------------------------------------------------------

describe("LoopMessageInfra.sendMessage", () => {
  it("POSTs to the send URL with the correct auth headers and body shape, returning providerMessageId + sentAt", async () => {
    const fakeFetch = makeFakeFetch(200, { message_id: "lm_abc123" });
    const infra = new LoopMessageInfra({ ...defaultCfg, fetchImpl: fakeFetch as typeof fetch });

    const handle = await infra.sendMessage({
      fromIdentity: "VanteraBot",
      toPhone: "+15555550100",
      body: "Hi there!",
      sendRef: "send-row-001",
    });

    expect(fakeFetch).toHaveBeenCalledOnce();
    const [url, init] = fakeFetch.mock.calls[0] as [string, RequestInit];

    // URL
    expect(url).toContain("loopmessage.com"); // CONFIRM ON ACTIVATION

    // Auth headers
    const headers = init.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("auth-key-123"); // CONFIRM ON ACTIVATION
    expect(headers["Loop-Secret-Key"]).toBe("secret-key-456"); // CONFIRM ON ACTIVATION
    expect(headers["Content-Type"]).toBe("application/json");

    // Body fields
    const sentBody = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(sentBody["recipient"]).toBe("+15555550100"); // CONFIRM ON ACTIVATION
    expect(sentBody["text"]).toBe("Hi there!"); // CONFIRM ON ACTIVATION
    expect(sentBody["sender_name"]).toBe("VanteraBot"); // CONFIRM ON ACTIVATION
    expect(sentBody["passthrough"]).toBe("send-row-001"); // CONFIRM ON ACTIVATION

    // Return shape
    expect(handle.providerMessageId).toBe("lm_abc123");
    expect(typeof handle.sentAt).toBe("string");
    expect(new Date(handle.sentAt).getTime()).toBeGreaterThan(0);
  });

  it("throws when the provider returns a non-2xx status", async () => {
    const fakeFetch = makeFakeFetch(422, { error: "bad request" });
    const infra = new LoopMessageInfra({ ...defaultCfg, fetchImpl: fakeFetch as typeof fetch });
    await expect(
      infra.sendMessage({ fromIdentity: "v", toPhone: "+1", body: "x", sendRef: "r" })
    ).rejects.toThrow("422");
  });

  it("falls back to an empty string providerMessageId when message_id is absent", async () => {
    const fakeFetch = makeFakeFetch(200, {});
    const infra = new LoopMessageInfra({ ...defaultCfg, fetchImpl: fakeFetch as typeof fetch });
    const handle = await infra.sendMessage({ fromIdentity: "v", toPhone: "+1", body: "x", sendRef: "r" });
    expect(handle.providerMessageId).toBe("");
  });
});

// ---------------------------------------------------------------------------
// verifyWebhook (timing-safe)
// ---------------------------------------------------------------------------

describe("LoopMessageInfra.verifyWebhook", () => {
  const infra = new LoopMessageInfra(defaultCfg);

  it("returns true when the authorization header matches the webhook secret", () => {
    expect(infra.verifyWebhook({ authorization: "webhook-secret-abc" }, "{}")).toBe(true);
  });

  it("returns true for the x-loop-secret header alias", () => {
    expect(infra.verifyWebhook({ "x-loop-secret": "webhook-secret-abc" }, "{}")).toBe(true); // CONFIRM ON ACTIVATION
  });

  it("returns false when the secret is wrong", () => {
    expect(infra.verifyWebhook({ authorization: "wrong-secret" }, "{}")).toBe(false);
  });

  it("returns false when no auth header is present", () => {
    expect(infra.verifyWebhook({}, "{}")).toBe(false);
  });

  it("returns false when the secret has a different length (padding attack guard)", () => {
    expect(infra.verifyWebhook({ authorization: "webhook-secret-abc-extra" }, "{}")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// parseEventWebhook
// ---------------------------------------------------------------------------

describe("LoopMessageInfra.parseEventWebhook", () => {
  const infra = new LoopMessageInfra(defaultCfg);

  it("maps a LoopMessage inbound payload (alert_type=message_inbound) → {type:'reply',...}", () => {
    const event = infra.parseEventWebhook({
      alert_type: "message_inbound", // CONFIRM ON ACTIVATION
      message_id: "lm_reply_1",
      recipient: "+15555550100", // CONFIRM ON ACTIVATION
      text: "I'm interested!", // CONFIRM ON ACTIVATION
      received_at: "2026-06-15T12:00:00.000Z",
    });
    expect(event).not.toBeNull();
    expect(event?.type).toBe("reply");
    if (event?.type === "reply") {
      expect(event.fromPhone).toBe("+15555550100");
      expect(event.body).toBe("I'm interested!");
      expect(event.providerMessageId).toBe("lm_reply_1");
      expect(event.receivedAt).toBe("2026-06-15T12:00:00.000Z");
    }
  });

  it("also maps event_type=reply (alternate field name)", () => {
    const event = infra.parseEventWebhook({
      event_type: "reply",
      from: "+15555550200",
      body: "Yes please",
    });
    expect(event?.type).toBe("reply");
    if (event?.type === "reply") {
      expect(event.fromPhone).toBe("+15555550200");
      expect(event.body).toBe("Yes please");
    }
  });

  it("maps a LoopMessage status payload (alert_type=message_sent) → {type:'delivery',...}", () => {
    const event = infra.parseEventWebhook({
      alert_type: "message_sent", // CONFIRM ON ACTIVATION
      message_id: "lm_sent_1",
      passthrough: "send-row-001",
      success: true, // CONFIRM ON ACTIVATION
    });
    expect(event).not.toBeNull();
    expect(event?.type).toBe("delivery");
    if (event?.type === "delivery") {
      expect(event.providerMessageId).toBe("lm_sent_1");
      expect(event.sendRef).toBe("send-row-001");
      expect(event.delivered).toBe(true);
    }
  });

  it("maps success=false as delivered=false", () => {
    const event = infra.parseEventWebhook({
      alert_type: "message_sent",
      message_id: "lm_failed_1",
      success: false,
    });
    expect(event?.type).toBe("delivery");
    if (event?.type === "delivery") {
      expect(event.delivered).toBe(false);
    }
  });

  it("returns null for unknown event types", () => {
    expect(infra.parseEventWebhook({ alert_type: "unknown_event" })).toBeNull();
  });

  it("returns null for null / non-object payloads", () => {
    expect(infra.parseEventWebhook(null)).toBeNull();
    expect(infra.parseEventWebhook("string")).toBeNull();
    expect(infra.parseEventWebhook(42)).toBeNull();
  });

  it("returns null for a reply payload missing both phone fields", () => {
    expect(
      infra.parseEventWebhook({ alert_type: "message_inbound", text: "hi" })
    ).toBeNull();
  });

  it("returns null for a delivery payload missing message_id", () => {
    expect(
      infra.parseEventWebhook({ alert_type: "message_sent", success: true })
    ).toBeNull();
  });

  it("falls back to new Date() for receivedAt when absent", () => {
    const before = Date.now();
    const event = infra.parseEventWebhook({
      alert_type: "message_inbound",
      recipient: "+1",
      text: "hi",
    });
    const after = Date.now();
    if (event?.type === "reply") {
      const ts = new Date(event.receivedAt).getTime();
      expect(ts).toBeGreaterThanOrEqual(before);
      expect(ts).toBeLessThanOrEqual(after);
    }
  });
});

// ---------------------------------------------------------------------------
// createMessageInfraFromEnv
// ---------------------------------------------------------------------------

describe("createMessageInfraFromEnv", () => {
  it("returns LoopMessageInfra when IMESSAGE_PROVIDER=loopmessage", () => {
    const infra = createMessageInfraFromEnv({
      IMESSAGE_PROVIDER: "loopmessage",
      IMESSAGE_AUTH_KEY: "ak",
      IMESSAGE_SECRET_KEY: "sk",
      IMESSAGE_WEBHOOK_SECRET: "ws",
    });
    expect(infra).toBeInstanceOf(LoopMessageInfra);
  });

  it("returns InMemoryMessageInfra by default (no IMESSAGE_PROVIDER)", () => {
    const infra = createMessageInfraFromEnv({});
    expect(infra).toBeInstanceOf(InMemoryMessageInfra);
  });

  it("returns InMemoryMessageInfra for an unknown provider value", () => {
    const infra = createMessageInfraFromEnv({ IMESSAGE_PROVIDER: "sendblue" });
    expect(infra).toBeInstanceOf(InMemoryMessageInfra);
  });
});
