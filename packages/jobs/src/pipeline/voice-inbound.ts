import { mapProviderDisposition } from "@vantera/agent-brains";
import type { VoiceInboundDeps, VoiceInboundSummary } from "./types";

/**
 * Process one inbound voice webhook. Dedupes via webhook_events, updates the call
 * row, classifies the outcome (provider fast-path first, else the transcript brain),
 * and writes phone suppression on not_interested/do_not_call (rule 11).
 * `payload.event_id` is the idempotency key.
 */
export async function runVoiceInbound(payload: unknown, deps: VoiceInboundDeps): Promise<VoiceInboundSummary> {
  const eventId = (payload as { event_id?: unknown }).event_id;
  if (typeof eventId !== "string") return { handled: false, action: "ignored" };

  const fresh = await deps.store.recordWebhookEvent("voice", eventId, payload);
  if (!fresh) return { handled: false, action: "duplicate" };

  const event = deps.voiceInfra.parseEventWebhook(payload);
  if (!event) return { handled: false, action: "ignored" };

  const call = await deps.store.findCallByProviderId(event.providerCallId);
  if (!call) return { handled: false, action: "unmatched" };

  if (event.type === "call_started") {
    await deps.store.updateCallStarted(call.id);
    return { handled: true, action: "started" };
  }

  // call_ended
  const fast = mapProviderDisposition(event.rawDisposition);
  const outcome = fast ?? (event.transcript ? await deps.classifyFn(event.transcript) : "no_answer");
  await deps.store.updateCallEnded(call.id, {
    status: "completed",
    outcome,
    durationSec: event.durationSec,
    recordingUrl: event.recordingUrl,
    transcript: event.transcript,
  });
  if ((outcome === "not_interested" || outcome === "do_not_call") && call.phone) {
    await deps.store.addSuppression(call.accountId, "phone", call.phone, "not_interested", call.leadId);
  }
  // A booked call is the mid-funnel "meeting" stage the analytics funnel counts (WS-A).
  if (outcome === "booked") {
    await deps.store.setMeetingBooked(call.leadId);
  }
  return { handled: true, action: `ended:${outcome}` };
}
