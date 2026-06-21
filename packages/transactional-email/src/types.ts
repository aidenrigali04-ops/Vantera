/** A single transactional message. Sender (from) is configured on the adapter. */
export interface TransactionalMessage {
  to: string;
  subject: string;
  /** HTML body. */
  html: string;
  /** Optional plain-text fallback. */
  text?: string;
  /** Optional Reply-To override. */
  replyTo?: string;
}

export interface TransactionalSendResult {
  messageId: string;
}

/**
 * Provider-agnostic transactional email interface (rules 02/13). The vendor is
 * an implementation detail behind this interface and its name never leaks out.
 *
 * Scope: auth + product notifications ONLY (team invites, account alerts).
 * This is never cold outreach — outreach is LinkedIn-only (rule 04) and carries
 * suppression and compliance obligations this transactional path does not.
 */
export interface TransactionalEmail {
  send(message: TransactionalMessage): Promise<TransactionalSendResult>;
}
