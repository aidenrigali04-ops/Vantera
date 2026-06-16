import { timingSafeEqual } from "node:crypto";
import type { MessageEvent, MessageHandle, MessageInfra, SendMessageRequest } from "./types";
import { InMemoryMessageInfra } from "./in-memory";

// LoopMessage Send Message API endpoint (host confirmed against the owner's dashboard).
const SEND_URL = "https://a.loopmessage.com/api/v1/message/send/";

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
        // API key goes in Authorization with no Bearer/Basic prefix (per docs).
        Authorization: this.cfg.authKey,
        // Account-dependent: the current Conversation API docs show only Authorization,
        // but plans that issue a separate Secret Key expect it here. Harmless if ignored.
        "Loop-Secret-Key": this.cfg.secretKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contact: req.toPhone,         // E.164 phone or lowercase email
        text: req.body,
        sender: req.fromIdentity,     // dedicated sender ID/handle — never a phone number
        passthrough: req.sendRef,     // echoed back on every webhook for this message
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
    // LoopMessage lets you set the webhook authorization header in the dashboard;
    // it arrives as `Authorization`. `x-loop-secret` kept as a defensive alias.
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

    // LoopMessage names the event type in `event`. Inbound from the contact arrives
    // as `message_inbound`; `opt-in` is that contact's FIRST inbound — same
    // {contact, text} shape, so we treat it as a reply too.
    const event = p.event;

    if (event === "message_inbound" || event === "opt-in") {
      // `contact` is the sender (E.164 phone or lowercase email); `text` the body.
      if (typeof p.contact !== "string") return null;
      if (typeof p.text !== "string") return null;

      return {
        type: "reply",
        providerMessageId: typeof p.message_id === "string" ? p.message_id : null,
        fromPhone: p.contact,
        body: p.text,
        // Inbound webhooks carry no timestamp — stamp it on receipt.
        receivedAt: new Date().toISOString(),
      };
    }

    // Terminal delivery status: the event NAME is the outcome. `passthrough` is the
    // metadata we sent on the outbound, used to attribute the event back to the send row.
    if (event === "message_delivered" || event === "message_failed") {
      if (typeof p.message_id !== "string") return null;

      return {
        type: "delivery",
        providerMessageId: p.message_id,
        sendRef: typeof p.passthrough === "string" ? p.passthrough : null,
        delivered: event === "message_delivered",
      };
    }

    // Non-terminal/unhandled (message_scheduled, message_reaction, inbound_call, unknown).
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
