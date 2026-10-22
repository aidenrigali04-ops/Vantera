import { describe, expect, it } from "vitest";
import type { LinkedInEvent } from "@vantera/linkedin-infra";
import { handleInboundWebhook, inboundConcurrencyKey, type WebhookHandlerDeps } from "./inbound-webhooks";

function makeDeps(overrides: Partial<WebhookHandlerDeps> = {}) {
  const enqueued: unknown[] = [];
  const enqueueOpts: { idempotencyKey: string; concurrencyKey: string }[] = [];
  const deps: WebhookHandlerDeps = {
    verify: () => true,
    extractEventId: () => "evt_1",
    concurrencyKeyFor: () => "lead_key_1",
    recordEvent: async () => true,
    enqueue: async (p, opts) => {
      enqueued.push(p);
      enqueueOpts.push(opts);
    },
    ...overrides,
  };
  return { deps, enqueued, enqueueOpts };
}

describe("handleInboundWebhook", () => {
  it("rejects forged payloads with 401 and no side effects", async () => {
    const { deps, enqueued } = makeDeps({ verify: () => false });
    const res = await handleInboundWebhook("linkedin", {}, "{}", deps);
    expect(res.status).toBe(401);
    expect(enqueued).toHaveLength(0);
  });
  it("invokes onUnverified for security auditing when the signature fails", async () => {
    let audited = 0;
    const { deps, enqueued } = makeDeps({ verify: () => false, onUnverified: async () => void audited++ });
    const res = await handleInboundWebhook("linkedin", {}, "{}", deps);
    expect(res.status).toBe(401);
    expect(audited).toBe(1);
    expect(enqueued).toHaveLength(0);
  });
  it("400s on unparseable JSON", async () => {
    const { deps } = makeDeps();
    expect((await handleInboundWebhook("linkedin", {}, "not-json", deps)).status).toBe(400);
  });
  it("200-ignores events the adapter can't map (vendors must not retry forever)", async () => {
    const { deps, enqueued } = makeDeps({ extractEventId: () => null });
    const res = await handleInboundWebhook("linkedin", {}, "{}", deps);
    expect(res.status).toBe(200);
    expect(res.body).toBe("ignored");
    expect(enqueued).toHaveLength(0);
  });
  it("surfaces the payload to onUnparsed when it verifies but maps to nothing", async () => {
    const seen: unknown[] = [];
    const { deps, enqueued } = makeDeps({
      extractEventId: () => null,
      onUnparsed: (p) => void seen.push(p),
    });
    const res = await handleInboundWebhook("linkedin", {}, '{"AccountStatus":{"message":"OK"}}', deps);
    expect(res.status).toBe(200);
    expect(seen).toEqual([{ AccountStatus: { message: "OK" } }]);
    expect(enqueued).toHaveLength(0);
  });
  it("re-enqueues a duplicate under the SAME idempotency key (a lost enqueue recovers; a done one dedupes)", async () => {
    // The event row is written before the enqueue. If the enqueue then failed, the provider's
    // retry is a "duplicate" — it must still reach the queue, or the event is lost forever.
    const { deps, enqueued, enqueueOpts } = makeDeps({ recordEvent: async () => false });
    const res = await handleInboundWebhook("linkedin", {}, "{}", deps);
    expect(res.status).toBe(200);
    expect(res.body).toBe("duplicate");
    expect(enqueued).toHaveLength(1);
    expect(enqueueOpts[0]!.idempotencyKey).toBe("inbound:linkedin:evt_1");
  });
  it("enqueues processing for fresh verified events, keyed for idempotency + per-lead serialization", async () => {
    const { deps, enqueued, enqueueOpts } = makeDeps();
    expect((await handleInboundWebhook("linkedin", {}, '{"a":1}', deps)).status).toBe(200);
    expect(enqueued).toEqual([{ source: "linkedin", payload: { a: 1 } }]);
    expect(enqueueOpts).toEqual([{ idempotencyKey: "inbound:linkedin:evt_1", concurrencyKey: "lead_key_1" }]);
  });
  it("an enqueue failure surfaces as a throw (→ 500, so the provider retries)", async () => {
    const { deps } = makeDeps({
      enqueue: async () => {
        throw new Error("queue down");
      },
    });
    await expect(handleInboundWebhook("linkedin", {}, "{}", deps)).rejects.toThrow("queue down");
  });
  it("falls back to the event id when no per-lead key can be derived", async () => {
    const { deps, enqueueOpts } = makeDeps({ concurrencyKeyFor: () => null });
    await handleInboundWebhook("linkedin", {}, "{}", deps);
    expect(enqueueOpts[0]!.concurrencyKey).toBe("evt_1");
  });
});

describe("inboundConcurrencyKey", () => {
  const identity = { fromProviderRef: "ACoAA_P", fromPublicIdentifier: null, fromName: null };
  it("serializes every message in one lead's thread (replies and outbound echoes share a key)", () => {
    const reply: LinkedInEvent = { type: "reply", providerEventId: "m1", connectedAccountRef: "acct", fromProfileUrl: "https://x/in/ACoAA_P", body: "hi", receivedAt: "t", ...identity };
    const echo: LinkedInEvent = { type: "outbound_echo", providerEventId: "m2", connectedAccountRef: "acct", toProfileUrl: "https://x/in/ACoAA_P", body: "yo", sentAt: "t", ...identity };
    expect(inboundConcurrencyKey(reply)).toBe("acct:ACoAA_P");
    expect(inboundConcurrencyKey(echo)).toBe(inboundConcurrencyKey(reply));
  });
  it("uses the normalized profile url when the provider id is missing", () => {
    const reply: LinkedInEvent = { type: "reply", providerEventId: "m1", connectedAccountRef: "acct", fromProfileUrl: "https://X/in/Jane/", body: "hi", receivedAt: "t", fromProviderRef: null, fromPublicIdentifier: null, fromName: null };
    expect(inboundConcurrencyKey(reply)).toBe("acct:https://x/in/jane");
  });
  it("leaves other events unserialized (their own id)", () => {
    const status: LinkedInEvent = { type: "account_status", providerEventId: "status:a:OK:t", connectedAccountRef: "a", status: "active", profileUrl: null, displayName: null, vanteraAccountId: null };
    expect(inboundConcurrencyKey(status)).toBe("status:a:OK:t");
  });
});
