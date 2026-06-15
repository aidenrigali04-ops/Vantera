import nodemailer from "nodemailer";
import type { SmtpCredentials, SmtpMessage, SmtpTransport } from "./smtp-sender";

/** Production SmtpTransport: opens a per-call nodemailer connection with the mailbox's own creds. */
export class NodemailerTransport implements SmtpTransport {
  async sendMail(creds: SmtpCredentials, msg: SmtpMessage): Promise<{ messageId: string }> {
    const transporter = nodemailer.createTransport({
      host: creds.host,
      port: creds.port,
      secure: creds.secure ?? creds.port === 465,
      auth: { user: creds.username, pass: creds.password },
    });
    const info = await transporter.sendMail({
      from: msg.from,
      to: msg.to,
      subject: msg.subject,
      html: msg.html,
      headers: msg.headers,
    });
    return { messageId: info.messageId };
  }
}
