import { describe, expect, it, vi } from "vitest";
import { runVoiceInbound } from "./voice-inbound";
import { InMemoryVoiceInfra } from "@vantera/voice-infra";
import type { VoiceInboundDeps } from "./types";

function deps(
  over: Partial<VoiceInboundDeps["store"]> = {},
  classify: VoiceInboundDeps["classifyFn"] = vi.fn(async () => "booked" as const)
): VoiceInboundDeps {
  const store = {
    recordWebhookEvent: vi.fn(async () => true),
    findCallByProviderId: vi.fn(async () => ({ id: "c1", accountId: "acc1", leadId: "l1", phone: "+15551112222" })),
    updateCallEnded: vi.fn(async () => {}),
    updateCallStarted: vi.fn(async () => {}),
    addSuppression: vi.fn(async () => {}),
    setMeetingBooked: vi.fn(async () => {}),
    ...over,
  } as unknown as VoiceInboundDeps["store"];
  return { store, voiceInfra: new InMemoryVoiceInfra(), classifyFn: classify };
}

const endedPayload = {
  event_type: "call_ended", call_id: "pc_9", call_ref: "c1",
  disposition: "completed", duration_sec: 88, recording_url: "https://rec/9", transcript: "yes book it",
};

describe("runVoiceInbound", () => {
  it("classifies an ended call and updates the call row", async () => {
    const d = deps();
    const res = await runVoiceInbound({ event_id: "e1", ...endedPayload }, d);
    expect(d.classifyFn).toHaveBeenCalledWith("yes book it");
    expect(d.store.updateCallEnded).toHaveBeenCalledWith("c1", expect.objectContaining({ outcome: "booked", durationSec: 88 }));
    expect(res.handled).toBe(true);
  });

  it("records the meeting on a booked outcome (lights up the analytics funnel)", async () => {
    const d = deps(); // classify defaults to "booked"
    await runVoiceInbound({ event_id: "e5", ...endedPayload }, d);
    expect(d.store.setMeetingBooked).toHaveBeenCalledWith("l1");
  });

  it("does not record a meeting on a non-booked outcome", async () => {
    const d = deps({}, vi.fn(async () => "callback" as const));
    await runVoiceInbound({ event_id: "e6", ...endedPayload }, d);
    expect(d.store.setMeetingBooked).not.toHaveBeenCalled();
  });

  it("writes phone suppression on a not_interested outcome", async () => {
    const d = deps({}, vi.fn(async () => "not_interested" as const));
    await runVoiceInbound({ event_id: "e2", ...endedPayload }, d);
    expect(d.store.addSuppression).toHaveBeenCalledWith("acc1", "phone", "+15551112222", "not_interested", "l1");
  });

  it("writes phone suppression on a do_not_call outcome", async () => {
    const d = deps({}, vi.fn(async () => "do_not_call" as const));
    await runVoiceInbound({ event_id: "e3", ...endedPayload }, d);
    expect(d.store.addSuppression).toHaveBeenCalledWith("acc1", "phone", "+15551112222", "not_interested", "l1");
  });

  it("dedupes a repeat webhook (idempotency)", async () => {
    const d = deps({ recordWebhookEvent: vi.fn(async () => false) });
    const res = await runVoiceInbound({ event_id: "e1", ...endedPayload }, d);
    expect(res).toMatchObject({ handled: false, action: "duplicate" });
    expect(d.store.updateCallEnded).not.toHaveBeenCalled();
  });

  it("uses the provider fast-path for voicemail (no classify call)", async () => {
    const d = deps();
    await runVoiceInbound({ event_id: "e4", ...endedPayload, disposition: "voicemail" }, d);
    expect(d.classifyFn).not.toHaveBeenCalled();
    expect(d.store.updateCallEnded).toHaveBeenCalledWith("c1", expect.objectContaining({ outcome: "voicemail" }));
  });
});
