import { timingSafeEqual } from "node:crypto";
import type {
  EmailEvent, EmailInfra, OutboundEmail, ProvisionRequest, ProvisionedMailbox, SendResult, WarmupStatus, GetSmtpCreds,
} from "../types";
import { MaildosoApiClient } from "./api-client";
import { SmtpSender, type SmtpTransport } from "./smtp-sender";

export interface MaildosoEmailInfraConfig {
  api: MaildosoApiClient;
  webhookSecret: string;
  /** Required for send(); omitted on provision-only construction. */
  getSmtpCreds?: GetSmtpCreds;
  /** Defaults to NodemailerTransport in the factory; tests inject a fake. */
  transport?: SmtpTransport;
}

export class MaildosoEmailInfra implements EmailInfra {
  private readonly api: MaildosoApiClient;
  private readonly webhookSecret: string;
  private readonly getSmtpCreds?: GetSmtpCreds;
  private readonly sender?: SmtpSender;

  constructor(cfg: MaildosoEmailInfraConfig) {
    this.api = cfg.api;
    this.webhookSecret = cfg.webhookSecret;
    this.getSmtpCreds = cfg.getSmtpCreds;
    this.sender = cfg.transport ? new SmtpSender(cfg.transport) : undefined;
  }

  async provision(req: ProvisionRequest): Promise<ProvisionedMailbox[]> {
    const out: ProvisionedMailbox[] = [];
    for (let d = 0; d < req.domainCount; d++) {
      const domain = `outbound-${req.accountId.slice(0, 8)}-${d}.maildoso.app`; // CONFIRM domain-naming (open-Q#2)
      await this.api.ensureDomain(domain);
      for (let m = 0; m < req.mailboxesPerDomain; m++) {
        const created = await this.api.createMailbox(domain, `sdr${m}`);
        // id is the provider's internal mailbox ref — the jobs layer persists it as
        // mailboxes.provider_ref, and deprovision/warmup call Maildoso by that ref (not the address).
        out.push({ id: created.providerRef, address: created.address, domain: created.domain, smtp: created.smtp });
      }
    }
    return out;
  }

  async send(email: OutboundEmail): Promise<SendResult> {
    if (!this.getSmtpCreds || !this.sender) {
      throw new Error("MaildosoEmailInfra.send requires getSmtpCreds + transport (wire in the jobs factory)");
    }
    const creds = await this.getSmtpCreds(email.mailboxId);
    const headers: Record<string, string> = {};
    if (email.unsubscribeUrl) {
      headers["List-Unsubscribe"] = `<${email.unsubscribeUrl}>`;
      headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
    }
    return this.sender.send(creds, {
      from: creds.username, to: email.to, subject: email.subject, html: email.body, headers,
    });
  }

  async warmupStatus(mailboxId: string): Promise<WarmupStatus> {
    const w = await this.api.getWarmup(mailboxId);
    return { mailboxId, phase: w.phase, dailyCap: w.dailyCap };
  }

  verifyWebhook(headers: Record<string, string>, _rawBody: string): boolean {
    const presented = headers["x-maildoso-secret"]; // CONFIRM header name (open-Q#7)
    if (!presented) return false;
    const a = Buffer.from(presented);
    const b = Buffer.from(this.webhookSecret);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  parseEventWebhook(payload: unknown): EmailEvent | null {
    if (typeof payload !== "object" || payload === null) return null;
    const p = payload as Record<string, unknown>;
    if (typeof p.event_id !== "string" || typeof p.mailbox_ref !== "string") return null; // CONFIRM (open-Q#7)
    const base = { providerEventId: p.event_id, mailboxRef: p.mailbox_ref };
    switch (p.event_type) {
      case "reply":
        return { type: "reply", ...base, from: String(p.from ?? ""), body: String(p.body ?? ""),
                 receivedAt: String(p.received_at ?? new Date().toISOString()), messageRef: (p.message_ref as string) ?? null };
      case "bounce":
        return { type: "bounce", ...base, recipient: String(p.recipient ?? "") };
      case "complaint":
        return { type: "complaint", ...base, recipient: String(p.recipient ?? "") };
      default:
        return null;
    }
  }
}
