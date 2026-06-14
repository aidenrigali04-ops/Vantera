import { describe, expect, it } from "vitest";
import { InMemoryMessageInfra } from "./in-memory";

describe("InMemoryMessageInfra", () => {
  it("records sends and returns a provider id", async () => {
    const infra = new InMemoryMessageInfra();
    const handle = await infra.sendMessage({ fromIdentity: "v1", toPhone: "+15555550100", body: "hi", sendRef: "s1" });
    expect(handle.providerMessageId).toBe("msg_1");
    expect(infra.sentMessages).toHaveLength(1);
    expect(infra.sentMessages[0]?.sendRef).toBe("s1");
  });

  it("rejects webhooks without the shared secret", () => {
    const infra = new InMemoryMessageInfra("topsecret");
    expect(infra.verifyWebhook({ "x-webhook-secret": "wrong" }, "{}")).toBe(false);
    expect(infra.verifyWebhook({ "x-webhook-secret": "topsecret" }, "{}")).toBe(true);
  });

  it("parses a reply event and ignores junk", () => {
    const infra = new InMemoryMessageInfra();
    expect(infra.parseEventWebhook({ event_type: "reply", from: "+15555550100", body: "yes" }))
      .toMatchObject({ type: "reply", fromPhone: "+15555550100", body: "yes" });
    expect(infra.parseEventWebhook(null)).toBeNull();
    expect(infra.parseEventWebhook({ event_type: "nope" })).toBeNull();
  });
});
