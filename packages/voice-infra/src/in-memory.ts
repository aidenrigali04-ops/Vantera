import type { CallHandle, PlaceCallRequest, VoiceEvent, VoiceInfra } from "./types";

/** Test/dev double. Also the reference behavior for real adapters. */
export class InMemoryVoiceInfra implements VoiceInfra {
  readonly placedCalls: PlaceCallRequest[] = [];
  private counter = 0;

  constructor(private readonly webhookSecret = "in-memory-secret") {}

  async placeCall(req: PlaceCallRequest): Promise<CallHandle> {
    this.placedCalls.push(req);
    return { providerCallId: `call_${++this.counter}`, startedAt: new Date().toISOString() };
  }

  verifyWebhook(headers: Record<string, string>, _rawBody: string): boolean {
    return headers["x-webhook-secret"] === this.webhookSecret;
  }

  parseEventWebhook(payload: unknown): VoiceEvent | null {
    if (typeof payload !== "object" || payload === null) return null;
    const p = payload as Record<string, unknown>;
    if (typeof p.call_id !== "string") return null;
    const callRef = typeof p.call_ref === "string" ? p.call_ref : null;
    switch (p.event_type) {
      case "call_started":
        return { type: "call_started", providerCallId: p.call_id, callRef };
      case "call_ended":
        if (typeof p.disposition !== "string" || typeof p.duration_sec !== "number") return null;
        return {
          type: "call_ended",
          providerCallId: p.call_id,
          callRef,
          rawDisposition: p.disposition,
          durationSec: p.duration_sec,
          recordingUrl: typeof p.recording_url === "string" ? p.recording_url : null,
          transcript: typeof p.transcript === "string" ? p.transcript : null,
        };
      default:
        return null;
    }
  }
}
