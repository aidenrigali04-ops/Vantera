import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { RetellVoiceInfra } from "./retell";
import type { PlaceCallRequest } from "./types";

const req: PlaceCallRequest = {
  fromNumber: "+15550000000",
  toNumber: "+15551112222",
  voiceId: "v1",
  language: "en-US",
  personaName: "Alex",
  brief: {
    openingLine: "hi",
    talkingPoints: ["a"],
    valueAngle: "a clearer way to cut routing time",
    consequenceHook: "what does that mean for you?",
    ahaMoment: "a 15-minute look, easy to cancel",
    objectionHandling: [],
    goalStatement: "book",
    bookingLink: "https://cal.com/x",
  },
  announceRecording: true,
  callRef: "call_1",
};

/** Produce a Retell-format signature the way the provider does: v={ts},d=hmac(apiKey, body+ts). */
function retellSignature(body: string, apiKey: string, timestamp: number = Date.now()): string {
  const digest = createHmac("sha256", apiKey).update(body + timestamp).digest("hex");
  return `v=${timestamp},d=${digest}`;
}

describe("RetellVoiceInfra.placeCall", () => {
  it("POSTs to the create-call endpoint and maps the response", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ call_id: "pc_42" }), { status: 201 })
    );
    const infra = new RetellVoiceInfra({ apiKey: "k", fetchImpl: fetchMock });
    const handle = await infra.placeCall(req);
    expect(handle.providerCallId).toBe("pc_42");
    const [url, init] = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0] as [string | URL, RequestInit];
    expect(String(url)).toContain("/v2/create-phone-call");
    expect(init.headers).toMatchObject({ Authorization: "Bearer k" });
    const body = JSON.parse(init.body as string);
    expect(body.to_number).toBe("+15551112222");
    expect(body.metadata.call_ref).toBe("call_1");
  });

  it("speaks the value angle, consequence question, and de-risked ask in the prompt", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ call_id: "pc_1" }), { status: 201 }));
    const infra = new RetellVoiceInfra({ apiKey: "k", fetchImpl: fetchMock });
    await infra.placeCall(req);
    const [, init] = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    const prompt = JSON.parse(init.body as string).retell_llm_dynamic_variables.prompt as string;
    expect(prompt).toContain("a clearer way to cut routing time");
    expect(prompt).toContain("what does that mean for you?");
    expect(prompt).toContain("a 15-minute look, easy to cancel");
  });

  it("includes override_agent_id when an agentId is configured", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ call_id: "pc_1" }), { status: 201 }));
    const infra = new RetellVoiceInfra({ apiKey: "k", agentId: "agent_abc", fetchImpl: fetchMock });
    await infra.placeCall(req);
    const [, init] = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string).override_agent_id).toBe("agent_abc");
  });

  it("omits override_agent_id when no agentId is configured", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ call_id: "pc_1" }), { status: 201 }));
    const infra = new RetellVoiceInfra({ apiKey: "k", fetchImpl: fetchMock });
    await infra.placeCall(req);
    const [, init] = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect("override_agent_id" in JSON.parse(init.body as string)).toBe(false);
  });

  it("throws on a non-2xx response", async () => {
    const fetchMock = vi.fn(async () => new Response("nope", { status: 500 }));
    const infra = new RetellVoiceInfra({ apiKey: "k", fetchImpl: fetchMock });
    await expect(infra.placeCall(req)).rejects.toThrow(/voice provider/i);
  });
});

describe("RetellVoiceInfra.verifyWebhook (Retell HMAC scheme)", () => {
  const apiKey = "key_secret";
  const body = JSON.stringify({ event_type: "call_ended", call_id: "pc_9" });
  const infra = new RetellVoiceInfra({ apiKey, fetchImpl: vi.fn() });

  it("accepts a valid, fresh signature", () => {
    const sig = retellSignature(body, apiKey);
    expect(infra.verifyWebhook({ "x-retell-signature": sig }, body)).toBe(true);
  });

  it("rejects a tampered body (digest no longer matches)", () => {
    const sig = retellSignature(body, apiKey);
    expect(infra.verifyWebhook({ "x-retell-signature": sig }, body + "x")).toBe(false);
  });

  it("rejects a signature produced with a different key", () => {
    const sig = retellSignature(body, "wrong_key");
    expect(infra.verifyWebhook({ "x-retell-signature": sig }, body)).toBe(false);
  });

  it("rejects an expired signature (timestamp older than the replay window)", () => {
    const sig = retellSignature(body, apiKey, Date.now() - 6 * 60 * 1000);
    expect(infra.verifyWebhook({ "x-retell-signature": sig }, body)).toBe(false);
  });

  it("rejects a malformed or missing signature header", () => {
    expect(infra.verifyWebhook({ "x-retell-signature": "garbage" }, body)).toBe(false);
    expect(infra.verifyWebhook({}, body)).toBe(false);
  });
});
