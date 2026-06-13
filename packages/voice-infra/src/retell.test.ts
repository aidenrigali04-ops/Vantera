import { describe, expect, it, vi } from "vitest";
import { RetellVoiceInfra } from "./retell";
import type { PlaceCallRequest } from "./types";

const req: PlaceCallRequest = {
  fromNumber: "+15550000000",
  toNumber: "+15551112222",
  voiceId: "v1",
  language: "en-US",
  personaName: "Alex",
  brief: { openingLine: "hi", talkingPoints: ["a"], objectionHandling: [], goalStatement: "book", bookingLink: "https://cal.com/x" },
  announceRecording: true,
  callRef: "call_1",
};

describe("RetellVoiceInfra", () => {
  it("POSTs to the create-call endpoint and maps the response", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ call_id: "pc_42" }), { status: 201 })
    );
    const infra = new RetellVoiceInfra({ apiKey: "k", webhookSecret: "s", fetchImpl: fetchMock });
    const handle = await infra.placeCall(req);
    expect(handle.providerCallId).toBe("pc_42");
    const [url, init] = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0] as [string | URL, RequestInit];
    expect(String(url)).toContain("/v2/create-phone-call");
    expect(init.headers).toMatchObject({ Authorization: "Bearer k" });
    const body = JSON.parse(init.body as string);
    expect(body.to_number).toBe("+15551112222");
    expect(body.metadata.call_ref).toBe("call_1");
  });

  it("throws on a non-2xx response", async () => {
    const fetchMock = vi.fn(async () => new Response("nope", { status: 500 }));
    const infra = new RetellVoiceInfra({ apiKey: "k", webhookSecret: "s", fetchImpl: fetchMock });
    await expect(infra.placeCall(req)).rejects.toThrow(/voice provider/i);
  });

  it("verifyWebhook uses a length-safe compare", () => {
    const infra = new RetellVoiceInfra({ apiKey: "k", webhookSecret: "abc", fetchImpl: vi.fn() });
    expect(infra.verifyWebhook({ "x-webhook-secret": "abc" }, "{}")).toBe(true);
    expect(infra.verifyWebhook({ "x-webhook-secret": "ab" }, "{}")).toBe(false);
    expect(infra.verifyWebhook({}, "{}")).toBe(false);
  });
});
