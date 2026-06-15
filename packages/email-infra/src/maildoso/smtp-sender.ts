import type { SendResult } from "../types";

/** Per-mailbox SMTP credentials. Maildoso exposes host/port/user/pass for each provisioned mailbox. */
export interface SmtpCredentials {
  host: string;
  port: number;
  username: string;
  password: string;
  /** true for implicit TLS (465); false for STARTTLS (587). Defaults by port if omitted. */
  secure?: boolean;
}

export interface SmtpMessage {
  from: string;
  to: string;
  subject: string;
  /** HTML body */
  html: string;
  /** extra headers, e.g. List-Unsubscribe (rule 11) */
  headers?: Record<string, string>;
}

/** Transport seam so SmtpSender is fully testable without a real SMTP library. */
export interface SmtpTransport {
  sendMail(creds: SmtpCredentials, msg: SmtpMessage): Promise<{ messageId: string }>;
}

/** Sends one email through a mailbox's own SMTP credentials — the Maildoso model. */
export class SmtpSender {
  constructor(private readonly transport: SmtpTransport) {}
  async send(creds: SmtpCredentials, msg: SmtpMessage): Promise<SendResult> {
    const { messageId } = await this.transport.sendMail(creds, msg);
    return { messageId, sentAt: new Date().toISOString() };
  }
}
