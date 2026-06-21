import { describe, expect, it } from "vitest";
import { handleInboundWebhook, type WebhookHandlerDeps } from "./inbound-webhooks";

function makeDeps(overrides: Partial<WebhookHandlerDeps> = {}) {
  const enqueued: unknown[] = [];
  const deps: WebhookHandlerDeps = {
    verify: () => true,
    extractEventId: () => "evt_1",
    recordEvent: async () => true,
    enqueue: async (p) => {
      enqueued.push(p);
    },
    ...overrides,
  };
  return { deps, enqueued };
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
  it("200-no-ops duplicate events", async () => {
    const { deps, enqueued } = makeDeps({ recordEvent: async () => false });
    const res = await handleInboundWebhook("linkedin", {}, "{}", deps);
    expect(res.status).toBe(200);
    expect(res.body).toBe("duplicate");
    expect(enqueued).toHaveLength(0);
  });
  it("enqueues processing for fresh verified events", async () => {
    const { deps, enqueued } = makeDeps();
    expect((await handleInboundWebhook("linkedin", {}, '{"a":1}', deps)).status).toBe(200);
    expect(enqueued).toEqual([{ source: "linkedin", payload: { a: 1 } }]);
  });
});
