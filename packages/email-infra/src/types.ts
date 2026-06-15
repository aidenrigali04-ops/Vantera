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

/** One inbound provider event, already vendor-neutral. providerEventId feeds webhook_events dedupe. */
export type EmailEvent =
  | { type: "reply"; providerEventId: string; mailboxRef: string; from: string; body: string; receivedAt: string; messageRef: string | null }
  | { type: "bounce"; providerEventId: string; mailboxRef: string; recipient: string }
  | { type: "complaint"; providerEventId: string; mailboxRef: string; recipient: string }
  | { type: "unsubscribe"; providerEventId: string; mailboxRef: string; recipient: string }
  | { type: "warmup_update"; providerEventId: string; mailboxRef: string; phase: "warming" | "ready"; dailyCap: number };

/** Provider-agnostic email outreach interface (rule 03). Maildoso is an implementation detail behind it. */
export interface EmailInfra {
  provision(req: ProvisionRequest): Promise<ProvisionedMailbox[]>;
  send(email: OutboundEmail): Promise<SendResult>;
  warmupStatus(mailboxId: string): Promise<WarmupStatus>;
  /**
   * Reject forged payloads BEFORE parsing. Real adapters must use a timing-safe
   * comparison (e.g. compare digests via crypto.timingSafeEqual); the in-memory
   * fake uses plain equality.
   */
  verifyWebhook(headers: Record<string, string>, rawBody: string): boolean;
  parseEventWebhook(payload: unknown): EmailEvent | null;
}

import type { SmtpCredentials } from "./maildoso/smtp-sender";
export type { SmtpCredentials };

/** A provisioned mailbox plus the secret needed to send through it. The jobs layer persists
 *  `smtp` (encrypted) and never returns it to the browser. Read paths use plain `Mailbox`. */
export interface ProvisionedMailbox extends Mailbox {
  /** Present for SMTP providers (Maildoso). The in-memory fake also sets it so the persist path is tested. */
  smtp?: SmtpCredentials;
}

/** Resolves a mailbox's decrypted SMTP creds at send time. Wired in the jobs layer (pg-store). */
export type GetSmtpCreds = (mailboxId: string) => Promise<SmtpCredentials>;
