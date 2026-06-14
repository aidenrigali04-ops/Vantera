/** A single outbound iMessage the sequence sends on a stage touch. */
export interface SendMessageRequest {
  fromIdentity: string;   // Vantera-owned sender handle/number (provider-agnostic)
  toPhone: string;        // E.164
  body: string;
  /** rides through the provider as metadata so webhooks attribute back to the send row */
  sendRef: string;
}

export interface MessageHandle {
  providerMessageId: string;
  sentAt: string;
}

export type MessageEvent =
  | { type: "reply"; providerMessageId: string | null; fromPhone: string; body: string; receivedAt: string }
  | { type: "delivery"; providerMessageId: string; sendRef: string | null; delivered: boolean };

/**
 * Provider-agnostic iMessage interface (rules 03-05). The real provider
 * (LoopMessage/Sendblue) is an implementation detail behind this. Pacing, suppression,
 * and sequencing live in the pipeline, NOT here.
 */
export interface MessageInfra {
  sendMessage(req: SendMessageRequest): Promise<MessageHandle>;
  /** Reject forged payloads BEFORE parsing. Real adapters use crypto.timingSafeEqual. */
  verifyWebhook(headers: Record<string, string>, rawBody: string): boolean;
  parseEventWebhook(payload: unknown): MessageEvent | null;
}
