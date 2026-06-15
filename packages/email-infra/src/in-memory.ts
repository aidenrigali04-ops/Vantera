import type {
  EmailEvent,
  EmailInfra,
  Mailbox,
  OutboundEmail,
  ProvisionedMailbox,
  ProvisionRequest,
  SendResult,
  WarmupStatus,
} from "./types";

/** Test/dev double. Also the reference behavior for real adapters. */
export class InMemoryEmailInfra implements EmailInfra {
  readonly sentEmails: OutboundEmail[] = [];
  private readonly mailboxes = new Map<string, Mailbox>();
  private counter = 0;

  constructor(private readonly webhookSecret = "in-memory-secret") {}

  async provision(req: ProvisionRequest): Promise<ProvisionedMailbox[]> {
    const created: ProvisionedMailbox[] = [];
    for (let d = 0; d < req.domainCount; d++) {
      const domain = `outbound-${req.accountId}-${d}.example.com`;
      for (let m = 0; m < req.mailboxesPerDomain; m++) {
        const id = `mbx_${++this.counter}`;
        const mailbox: ProvisionedMailbox = {
          id, address: `sdr${m}@${domain}`, domain,
          smtp: { host: "smtp.in-memory.test", port: 587, username: `sdr${m}@${domain}`, password: `pw_${id}` },
        };
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

  // fake: plain equality; real adapters use a timing-safe compare (see interface doc)
  verifyWebhook(headers: Record<string, string>, _rawBody: string): boolean {
    return headers["x-webhook-secret"] === this.webhookSecret;
  }

  // mirrors the structure in linkedin-infra's fake — keep the two in sync
  parseEventWebhook(payload: unknown): EmailEvent | null {
    if (typeof payload !== "object" || payload === null) return null;
    const p = payload as Record<string, unknown>;
    if (typeof p.event_id !== "string" || typeof p.mailbox_ref !== "string") return null;
    const base = { providerEventId: p.event_id, mailboxRef: p.mailbox_ref };
    switch (p.event_type) {
      case "reply":
        if (typeof p.from !== "string" || typeof p.body !== "string" || typeof p.received_at !== "string") return null;
        return { type: "reply", ...base, from: p.from, body: p.body, receivedAt: p.received_at,
          messageRef: typeof p.message_ref === "string" ? p.message_ref : null };
      case "bounce":
      case "complaint":
      case "unsubscribe":
        if (typeof p.recipient !== "string") return null;
        return { type: p.event_type, ...base, recipient: p.recipient };
      case "warmup_update":
        if ((p.phase !== "warming" && p.phase !== "ready") || typeof p.daily_cap !== "number") return null;
        return { type: "warmup_update", ...base, phase: p.phase, dailyCap: p.daily_cap };
      default:
        return null;
    }
  }
}
