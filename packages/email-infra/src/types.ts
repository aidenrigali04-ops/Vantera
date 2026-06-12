export interface ProvisionRequest {
  accountId: string;
  domainCount: number;
  mailboxesPerDomain: number;
}

export interface Mailbox {
  id: string;
  address: string;
  domain: string;
}

export interface OutboundEmail {
  mailboxId: string;
  to: string;
  subject: string;
  body: string;
  campaignId: string;
  leadId: string;
  /** RFC 8058 one-click target; adapters set List-Unsubscribe headers from it */
  unsubscribeUrl?: string;
}

export interface SendResult {
  messageId: string;
  sentAt: string;
}

export interface WarmupStatus {
  mailboxId: string;
  phase: "warming" | "ready";
  dailyCap: number;
}

export interface InboundReply {
  mailboxId: string;
  from: string;
  body: string;
  receivedAt: string;
}

/** One inbound provider event, already vendor-neutral. providerEventId feeds webhook_events dedupe. */
export type EmailEvent =
  | { type: "reply"; providerEventId: string; mailboxRef: string; from: string; body: string; receivedAt: string; messageRef: string | null }
  | { type: "bounce"; providerEventId: string; mailboxRef: string; recipient: string }
  | { type: "complaint"; providerEventId: string; mailboxRef: string; recipient: string }
  | { type: "unsubscribe"; providerEventId: string; mailboxRef: string; recipient: string }
  | { type: "warmup_update"; providerEventId: string; mailboxRef: string; phase: "warming" | "ready"; dailyCap: number };

/** Provider-agnostic email outreach interface (rule 03). Smartlead is an implementation detail behind it. */
export interface EmailInfra {
  provision(req: ProvisionRequest): Promise<Mailbox[]>;
  send(email: OutboundEmail): Promise<SendResult>;
  warmupStatus(mailboxId: string): Promise<WarmupStatus>;
  parseReplyWebhook(payload: unknown): InboundReply | null;
  /** reject forged payloads BEFORE parsing; constant-time compare on the shared secret */
  verifyWebhook(headers: Record<string, string>, rawBody: string): boolean;
  parseEventWebhook(payload: unknown): EmailEvent | null;
}
