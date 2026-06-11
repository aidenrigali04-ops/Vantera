import type {
  EmailInfra,
  InboundReply,
  Mailbox,
  OutboundEmail,
  ProvisionRequest,
  SendResult,
  WarmupStatus,
} from "./types";

/** Test/dev double. Also the reference behavior for real adapters. */
export class InMemoryEmailInfra implements EmailInfra {
  readonly sentEmails: OutboundEmail[] = [];
  private readonly mailboxes = new Map<string, Mailbox>();
  private counter = 0;

  async provision(req: ProvisionRequest): Promise<Mailbox[]> {
    const created: Mailbox[] = [];
    for (let d = 0; d < req.domainCount; d++) {
      const domain = `outbound-${req.accountId}-${d}.example.com`;
      for (let m = 0; m < req.mailboxesPerDomain; m++) {
        const id = `mbx_${++this.counter}`;
        const mailbox: Mailbox = { id, address: `sdr${m}@${domain}`, domain };
        this.mailboxes.set(id, mailbox);
        created.push(mailbox);
      }
    }
    return created;
  }

  async send(email: OutboundEmail): Promise<SendResult> {
    if (!this.mailboxes.has(email.mailboxId)) {
      throw new Error(`unknown mailbox: ${email.mailboxId}`);
    }
    this.sentEmails.push(email);
    return { messageId: `msg_${++this.counter}`, sentAt: new Date().toISOString() };
  }

  async warmupStatus(mailboxId: string): Promise<WarmupStatus> {
    if (!this.mailboxes.has(mailboxId)) {
      throw new Error(`unknown mailbox: ${mailboxId}`);
    }
    return { mailboxId, phase: "warming", dailyCap: 10 };
  }

  parseReplyWebhook(payload: unknown): InboundReply | null {
    if (typeof payload !== "object" || payload === null) return null;
    const p = payload as Record<string, unknown>;
    if (
      typeof p.mailbox_id !== "string" ||
      typeof p.from !== "string" ||
      typeof p.body !== "string" ||
      typeof p.received_at !== "string"
    ) {
      return null;
    }
    return { mailboxId: p.mailbox_id, from: p.from, body: p.body, receivedAt: p.received_at };
  }
}
