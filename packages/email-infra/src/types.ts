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

/** Provider-agnostic email outreach interface (rule 03). Smartlead is an implementation detail behind it. */
export interface EmailInfra {
  provision(req: ProvisionRequest): Promise<Mailbox[]>;
  send(email: OutboundEmail): Promise<SendResult>;
  warmupStatus(mailboxId: string): Promise<WarmupStatus>;
  parseReplyWebhook(payload: unknown): InboundReply | null;
}
