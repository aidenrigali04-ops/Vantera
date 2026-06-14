import { createHash, timingSafeEqual } from "node:crypto";
import type { EmailEvent, EmailInfra, Mailbox, OutboundEmail, ProvisionRequest, SendResult, WarmupStatus } from "../types";
import { InMemoryEmailInfra } from "../in-memory";
import type { DomainRegistrar } from "./registrar";
import type { DnsManager } from "./dns";
import type { MailboxProvisioner } from "./mailbox";
import type { WarmupService } from "./warmup";
import type { GmailSender } from "./gmail-send";

export interface OwnedConfig {
  registrar: DomainRegistrar;
  dns: DnsManager;
  mailbox: MailboxProvisioner;
  warmup: WarmupService;
  sender: GmailSender;
  webhookSecret: string;
  /** brand-adjacent domain names to buy for an account */
  chooseDomains: (accountId: string, count: number) => string[];
  /** local-parts (before @) for the mailboxes on each domain */
  localParts: (countPerDomain: number) => string[];
}

export class OwnedEmailInfra implements EmailInfra {
  // Reuse the in-memory fake's vendor-neutral webhook parser — identical shape contract.
  private readonly events = new InMemoryEmailInfra();

  constructor(private readonly cfg: OwnedConfig) {}

  async provision(req: ProvisionRequest): Promise<Mailbox[]> {
    const domains = this.cfg.chooseDomains(req.accountId, req.domainCount);
    const locals = this.cfg.localParts(req.mailboxesPerDomain);
    const out: Mailbox[] = [];
    for (const domain of domains) {
      if (!(await this.cfg.registrar.isAvailable(domain))) throw new Error(`domain unavailable: ${domain}`);
      await this.cfg.registrar.buy(domain);
      const dkim = await this.cfg.mailbox.addAndVerifyDomain(domain);
      await this.cfg.dns.writeEmailRecords(domain, dkim);
      const addresses = await this.cfg.mailbox.createUsers(domain, locals);
      for (const address of addresses) {
        await this.cfg.warmup.enroll(address);
        out.push({ id: address, address, domain });
      }
    }
    return out;
  }

  async send(email: OutboundEmail): Promise<SendResult> {
    const headers: Record<string, string> = {};
    if (email.unsubscribeUrl) {
      headers["List-Unsubscribe"] = `<${email.unsubscribeUrl}>`;
      headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
    }
    const res = await this.cfg.sender.sendRaw(email.mailboxId, {
      to: email.to, subject: email.subject, body: email.body, headers,
    });
    return { messageId: res.messageId, sentAt: new Date().toISOString() };
  }

  async warmupStatus(mailboxId: string): Promise<WarmupStatus> {
    const snap = await this.cfg.warmup.status(mailboxId);
    return { mailboxId, phase: snap.phase, dailyCap: snap.dailyCap };
  }

  verifyWebhook(headers: Record<string, string>, _rawBody: string): boolean {
    const presented = headers["x-webhook-secret"];
    if (!presented) return false;
    const digest = (v: string) => createHash("sha256").update(v).digest();
    return timingSafeEqual(digest(this.cfg.webhookSecret), digest(presented));
  }

  parseEventWebhook(payload: unknown): EmailEvent | null {
    return this.events.parseEventWebhook(payload);
  }
}
