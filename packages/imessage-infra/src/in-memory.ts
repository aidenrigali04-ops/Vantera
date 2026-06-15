import type { MessageEvent, MessageHandle, MessageInfra, SendMessageRequest } from "./types";

export class InMemoryMessageInfra implements MessageInfra {
  readonly sentMessages: SendMessageRequest[] = [];
  private counter = 0;

  constructor(private readonly webhookSecret = "in-memory-secret") {}

  async sendMessage(req: SendMessageRequest): Promise<MessageHandle> {
    this.sentMessages.push(req);
    return { providerMessageId: `msg_${++this.counter}`, sentAt: new Date().toISOString() };
  }

  verifyWebhook(headers: Record<string, string>, _rawBody: string): boolean {
    return headers["x-webhook-secret"] === this.webhookSecret;
  }

  parseEventWebhook(payload: unknown): MessageEvent | null {
    if (typeof payload !== "object" || payload === null) return null;
    const p = payload as Record<string, unknown>;
    if (p.event_type === "reply") {
      if (typeof p.from !== "string" || typeof p.body !== "string") return null;
      return {
        type: "reply",
        providerMessageId: typeof p.message_id === "string" ? p.message_id : null,
        fromPhone: p.from,
        body: p.body,
        receivedAt: typeof p.received_at === "string" ? p.received_at : new Date().toISOString(),
      };
    }
    if (p.event_type === "delivery") {
      if (typeof p.message_id !== "string" || typeof p.delivered !== "boolean") return null;
      return {
        type: "delivery",
        providerMessageId: p.message_id,
        sendRef: typeof p.send_ref === "string" ? p.send_ref : null,
        delivered: p.delivered,
      };
    }
    return null;
  }
}
