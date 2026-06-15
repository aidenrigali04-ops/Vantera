import { timingSafeEqual } from "node:crypto";
import type { MessageEvent, MessageHandle, MessageInfra, SendMessageRequest } from "./types";
import { InMemoryMessageInfra } from "./in-memory";

const SEND_URL = "https://server.loopmessage.com/api/v1/message/send/"; // CONFIRM ON ACTIVATION

export interface LoopMessageConfig {
  authKey: string;
  secretKey: string;
  webhookSecret: string;
  /** Injectable fetch — defaults to global fetch. Override in tests to avoid network calls. */
  fetchImpl?: typeof fetch;
}

export class LoopMessageInfra implements MessageInfra {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly cfg: LoopMessageConfig) {
    this.fetchImpl = cfg.fetchImpl ?? fetch;
  }

  async sendMessage(req: SendMessageRequest): Promise<MessageHandle> {
    const res = await this.fetchImpl(SEND_URL, {
      method: "POST",
      headers: {
        Authorization: this.cfg.authKey,          // CONFIRM ON ACTIVATION
        "Loop-Secret-Key": this.cfg.secretKey,    // CONFIRM ON ACTIVATION
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        recipient: req.toPhone,                   // CONFIRM ON ACTIVATION
        text: req.body,                           // CONFIRM ON ACTIVATION
        sender_name: req.fromIdentity,            // CONFIRM ON ACTIVATION
        passthrough: req.sendRef,                 // CONFIRM ON ACTIVATION
      }),
    });

    if (!res.ok) {
      throw new Error(`imessage provider send failed: ${res.status}`);
    }

    const json = (await res.json()) as { message_id?: string };
    return {
      providerMessageId: String(json.message_id ?? ""),
      sentAt: new Date().toISOString(),
    };
  }

  verifyWebhook(headers: Record<string, string>, _rawBody: string): boolean {
    // CONFIRM ON ACTIVATION: which header LoopMessage echoes on callbacks
    const presented = headers["authorization"] ?? headers["x-loop-secret"];
    if (!presented) return false;
    try {
      const a = Buffer.from(presented);
      const b = Buffer.from(this.cfg.webhookSecret);
      return a.length === b.length && timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }

  parseEventWebhook(payload: unknown): MessageEvent | null {
    if (typeof payload !== "object" || payload === null) return null;
    const p = payload as Record<string, unknown>;

    // CONFIRM ON ACTIVATION: LoopMessage uses alert_type (e.g. message_inbound / message_sent)
    const t = p.alert_type ?? p.event_type;

    if (t === "message_inbound" || t === "reply") {
      // Need at least one phone field and one text field
      if (typeof p.text !== "string" && typeof p.body !== "string") return null;
      if (typeof p.recipient !== "string" && typeof p.from !== "string") return null;

      return {
        type: "reply",
        providerMessageId: typeof p.message_id === "string" ? p.message_id : null,
        fromPhone: String(p.recipient ?? p.from),        // CONFIRM ON ACTIVATION
        body: String(p.text ?? p.body),                  // CONFIRM ON ACTIVATION
        receivedAt:
          typeof p.received_at === "string" ? p.received_at : new Date().toISOString(),
      };
    }

    if (t === "message_sent" || t === "delivery") {
      if (typeof p.message_id !== "string") return null;

      return {
        type: "delivery",
        providerMessageId: p.message_id,
        sendRef: typeof p.passthrough === "string" ? p.passthrough : null, // CONFIRM ON ACTIVATION
        delivered: p.success === true || p.delivered === true,             // CONFIRM ON ACTIVATION
      };
    }

    return null;
  }
}

/**
 * Single env factory (mirrors createVoiceInfraFromEnv). Defaults to the in-memory fake.
 * Reading process.env belongs ONLY here — LoopMessageInfra itself is product-pure.
 */
export function createMessageInfraFromEnv(
  env: Record<string, string | undefined> = process.env,
): MessageInfra {
  if (env.IMESSAGE_PROVIDER === "loopmessage") {
    return new LoopMessageInfra({
      authKey: env.IMESSAGE_AUTH_KEY ?? "",
      secretKey: env.IMESSAGE_SECRET_KEY ?? "",
      webhookSecret: env.IMESSAGE_WEBHOOK_SECRET ?? "",
    });
  }
  return new InMemoryMessageInfra(env.IMESSAGE_WEBHOOK_SECRET ?? "in-memory-secret");
}
