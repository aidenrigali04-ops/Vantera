import { timingSafeEqual } from "node:crypto";
import { InMemoryVoiceInfra } from "./in-memory";
import type { CallHandle, PlaceCallRequest, VoiceEvent, VoiceInfra } from "./types";

const RETELL_BASE = "https://api.retellai.com";

export interface RetellConfig {
  apiKey: string;
  webhookSecret: string;
  fromNumber?: string;
  fetchImpl?: typeof fetch;
}

/** Composes the agent prompt the provider speaks from the structured brief. */
function briefToPrompt(req: PlaceCallRequest): string {
  const lines = [
    `You are ${req.personaName}, a friendly B2B sales rep. Speak naturally, never robotic.`,
    req.announceRecording ? `First, briefly say the call may be recorded.` : null,
    `Open with: "${req.brief.openingLine}"`,
    req.brief.talkingPoints.length ? `Talking points: ${req.brief.talkingPoints.join("; ")}` : null,
    req.brief.objectionHandling.length ? `If objections: ${req.brief.objectionHandling.join("; ")}` : null,
    `Goal: ${req.brief.goalStatement}. To book, offer this link: ${req.brief.bookingLink}.`,
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
        metadata: { call_ref: req.callRef },
        retell_llm_dynamic_variables: { prompt: briefToPrompt(req), voice_id: req.voiceId, language: req.language },
      }),
    });
    if (!res.ok) throw new Error(`voice provider create-call failed: ${res.status}`);
    const json = (await res.json()) as { call_id: string };
    return { providerCallId: json.call_id, startedAt: new Date().toISOString() };
  }

  verifyWebhook(headers: Record<string, string>, _rawBody: string): boolean {
    const got = headers["x-webhook-secret"];
    if (typeof got !== "string") return false;
    const a = Buffer.from(got);
    const b = Buffer.from(this.cfg.webhookSecret);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  // event shape matches the in-memory reference; one parser, shared.
  parseEventWebhook(payload: unknown): VoiceEvent | null {
    return new InMemoryVoiceInfra().parseEventWebhook(payload);
  }
}

export function createVoiceInfraFromEnv(): VoiceInfra {
  const apiKey = process.env.VOICE_API_KEY;
  const webhookSecret = process.env.VOICE_WEBHOOK_SECRET;
  if (!apiKey || !webhookSecret) throw new Error("VOICE_API_KEY and VOICE_WEBHOOK_SECRET are required");
  return new RetellVoiceInfra({ apiKey, webhookSecret, fromNumber: process.env.VOICE_FROM_NUMBER });
}
