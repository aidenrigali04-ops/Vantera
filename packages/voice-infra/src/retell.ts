import { createHmac, timingSafeEqual } from "node:crypto";
import { InMemoryVoiceInfra } from "./in-memory";
import type { CallHandle, PlaceCallRequest, VoiceEvent, VoiceInfra } from "./types";

const RETELL_BASE = "https://api.retellai.com";

/** Replay window for inbound webhook signatures (matches the provider's own tolerance). */
const SIGNATURE_TOLERANCE_MS = 5 * 60 * 1000;

export interface RetellConfig {
  apiKey: string;
  fromNumber?: string;
  /** optional: pin a specific provider agent per call instead of relying on the from-number binding */
  agentId?: string;
  fetchImpl?: typeof fetch;
}

/** Composes the agent prompt the provider speaks from the structured brief. */
function briefToPrompt(req: PlaceCallRequest): string {
  const b = req.brief;
  const lines = [
    `You are ${req.personaName}, a human-sounding B2B rep on a cold call. Speak naturally, never robotic. Stay calm and a little detached — you're finding out whether you can help, not pushing for the booking.`,
    req.announceRecording ? `First, briefly say the call may be recorded.` : null,
    `Open with: "${b.openingLine}"`,
    b.talkingPoints.length ? `Diagnose, don't pitch — work through (one idea per turn, then stop): ${b.talkingPoints.join("; ")}` : null,
    b.consequenceHook ? `Once they name a problem, ask this in a concerned-but-calm tone and let them answer fully: "${b.consequenceHook}"` : null,
    b.valueAngle ? `When you make the ask, frame the meeting itself as the offer: ${b.valueAngle}` : null,
    b.ahaMoment ? `Keep the ask small and low-risk: ${b.ahaMoment}` : null,
    b.objectionHandling.length ? `If objections (clarify → discuss like a friend → diffuse; shrink the ask, reverse the risk): ${b.objectionHandling.join("; ")}` : null,
    `Goal: ${b.goalStatement}. To book, offer this link: ${b.bookingLink}.`,
  ];
  return lines.filter((l): l is string => l !== null).join("\n");
}

export class RetellVoiceInfra implements VoiceInfra {
  private readonly fetchImpl: typeof fetch;
  constructor(private readonly cfg: RetellConfig) {
    this.fetchImpl = cfg.fetchImpl ?? fetch;
  }

  async placeCall(req: PlaceCallRequest): Promise<CallHandle> {
    const res = await this.fetchImpl(`${RETELL_BASE}/v2/create-phone-call`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.cfg.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from_number: req.fromNumber,
        to_number: req.toNumber,
        ...(this.cfg.agentId ? { override_agent_id: this.cfg.agentId } : {}),
        metadata: { call_ref: req.callRef },
        retell_llm_dynamic_variables: { prompt: briefToPrompt(req), voice_id: req.voiceId, language: req.language },
      }),
    });
    if (!res.ok) throw new Error(`voice provider create-call failed: ${res.status}`);
    const json = (await res.json()) as { call_id: string };
    return { providerCallId: json.call_id, startedAt: new Date().toISOString() };
  }

  /**
   * Verify an inbound webhook signature. The provider signs with the `x-retell-signature`
   * header in the form `v={timestamp},d={digest}`, where digest is
   * HMAC-SHA256(apiKey, rawBody + timestamp) in hex. Signatures outside the replay window
   * are rejected; the digest comparison is constant-time.
   */
  verifyWebhook(headers: Record<string, string>, rawBody: string): boolean {
    const signature = headers["x-retell-signature"];
    if (typeof signature !== "string") return false;

    const match = /^v=(\d+),d=([0-9a-f]+)$/.exec(signature);
    if (!match) return false;

    const [, timestampRaw, presentedDigest] = match;
    if (!timestampRaw || !presentedDigest) return false;
    const timestamp = Number(timestampRaw);
    if (!Number.isFinite(timestamp)) return false;
    if (Math.abs(Date.now() - timestamp) > SIGNATURE_TOLERANCE_MS) return false;

    const expectedDigest = createHmac("sha256", this.cfg.apiKey)
      .update(rawBody + timestamp)
      .digest("hex");

    const a = Buffer.from(expectedDigest);
    const b = Buffer.from(presentedDigest);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  // event shape matches the in-memory reference; one parser, shared.
  parseEventWebhook(payload: unknown): VoiceEvent | null {
    return new InMemoryVoiceInfra().parseEventWebhook(payload);
  }
}

export function createVoiceInfraFromEnv(): VoiceInfra {
  const apiKey = process.env.VOICE_API_KEY;
  if (!apiKey) throw new Error("VOICE_API_KEY is required");
  return new RetellVoiceInfra({
    apiKey,
    fromNumber: process.env.VOICE_FROM_NUMBER,
    agentId: process.env.VOICE_AGENT_ID,
  });
}
