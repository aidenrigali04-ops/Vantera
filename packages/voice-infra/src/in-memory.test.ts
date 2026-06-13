import { describe, expect, it } from "vitest";
import { InMemoryVoiceInfra } from "./in-memory";
import type { PlaceCallRequest } from "./types";

const req: PlaceCallRequest = {
  fromNumber: "+15550000000",
  toNumber: "+15551112222",
  voiceId: "v1",
  language: "en-US",
  personaName: "Alex",
  brief: { openingLine: "hi", talkingPoints: [], objectionHandling: [], goalStatement: "book", bookingLink: "https://cal.com/x" },
  announceRecording: true,
  callRef: "call_1",
};

describe("InMemoryVoiceInfra", () => {
  it("records placed calls and returns a handle", async () => {
    const infra = new InMemoryVoiceInfra();
    const handle = await infra.placeCall(req);
    expect(handle.providerCallId).toMatch(/^call_/);
    expect(infra.placedCalls).toHaveLength(1);
    expect(infra.placedCalls[0]!.toNumber).toBe("+15551112222");
  });

  it("verifies the webhook secret", () => {
    const infra = new InMemoryVoiceInfra("s3cret");
    expect(infra.verifyWebhook({ "x-webhook-secret": "s3cret" }, "{}")).toBe(true);
    expect(infra.verifyWebhook({ "x-webhook-secret": "nope" }, "{}")).toBe(false);
  });

  it("parses a call_ended event", () => {
    const infra = new InMemoryVoiceInfra();
    const ev = infra.parseEventWebhook({
      event_type: "call_ended",
      call_id: "pc_9",
      call_ref: "call_1",
      disposition: "booked",
      duration_sec: 92,
      recording_url: "https://rec/9",
      transcript: "hello...",
    });
    expect(ev).toEqual({
      type: "call_ended",
      providerCallId: "pc_9",
      callRef: "call_1",
      rawDisposition: "booked",
      durationSec: 92,
      recordingUrl: "https://rec/9",
      transcript: "hello...",
    });
  });

  it("returns null for an unknown event", () => {
    expect(new InMemoryVoiceInfra().parseEventWebhook({ event_type: "weird" })).toBeNull();
  });
});
