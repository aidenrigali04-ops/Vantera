import { createHash, timingSafeEqual } from "node:crypto";
import type { EmailEvent, EmailInfra, Mailbox, OutboundEmail, ProvisionRequest, SendResult, WarmupStatus } from "./types";

// ── endpoint constants ──────────────────────────────────────────────────────
const PATH_PROVISION = "/smart-senders/order";
const PATH_SEND = (mailboxId: string) => `/email-accounts/${mailboxId}/send`;
const PATH_WARMUP = (mailboxId: string) => `/email-accounts/${mailboxId}/warmup-stats`;

export interface SmartleadConfig {
  apiKey: string;
  webhookSecret: string;
  fetchFn?: typeof fetch;
  /** default https://server.smartlead.ai/api/v1 */
  baseUrl?: string;
}

export class SmartleadEmailInfra implements EmailInfra {
  private readonly apiKey: string;
  private readonly webhookSecret: string;
  private readonly fetchFn: typeof fetch;
  private readonly baseUrl: string;

  constructor(config: SmartleadConfig) {
    this.apiKey = config.apiKey;
    this.webhookSecret = config.webhookSecret;
    this.fetchFn = config.fetchFn ?? fetch;
    this.baseUrl = config.baseUrl ?? "https://server.smartlead.ai/api/v1";
  }

  // ── private helper ──────────────────────────────────────────────────────
  private async call<T>(path: string, init?: RequestInit): Promise<T> {
    const separator = path.includes("?") ? "&" : "?";
    const url = `${this.baseUrl}${path}${separator}api_key=${this.apiKey}`;
    const res = await this.fetchFn(url, {
      headers: { "Content-Type": "application/json" },
      ...init,
    });
    if (!res.ok) {
      throw new Error(`email provider error ${res.status} on ${path}`);
    }
    return res.json() as Promise<T>;
  }

  // ── EmailInfra implementation ────────────────────────────────────────────
  async provision(req: ProvisionRequest): Promise<Mailbox[]> {
    const data = await this.call<{ accounts: Array<{ id: number | string; email: string; domain: string }> }>(
      PATH_PROVISION,
      {
        method: "POST",
        body: JSON.stringify({
          account_id: req.accountId,
          domain_count: req.domainCount,
          mailboxes_per_domain: req.mailboxesPerDomain,
        }),
      }
    );
    return data.accounts.map((a) => ({
      id: String(a.id),
      address: a.email,
      domain: a.domain,
    }));
  }

  async send(email: OutboundEmail): Promise<SendResult> {
    const body: Record<string, unknown> = {
      to: email.to,
      subject: email.subject,
      body: email.body,
    };
    if (email.unsubscribeUrl) {
      body.custom_headers = {
        "List-Unsubscribe": `<${email.unsubscribeUrl}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      };
    }
    const data = await this.call<{ message_id: string; sent_at: string }>(
      PATH_SEND(email.mailboxId),
      { method: "POST", body: JSON.stringify(body) }
    );
    return { messageId: data.message_id, sentAt: data.sent_at };
  }

  async warmupStatus(mailboxId: string): Promise<WarmupStatus> {
    const data = await this.call<{ warmup_status: string; max_email_per_day: number }>(
      PATH_WARMUP(mailboxId)
    );
    return {
      mailboxId,
      phase: data.warmup_status === "COMPLETED" ? "ready" : "warming",
      dailyCap: data.max_email_per_day,
    };
  }

  /**
   * Timing-safe comparison: digest both sides with SHA-256 first so lengths
   * are always equal, then use timingSafeEqual on the digests.
   * Missing header → false.
   */
  verifyWebhook(headers: Record<string, string>, _rawBody: string): boolean {
    const presented = headers["x-smartlead-secret"];
    if (!presented) return false;
    const digest = (v: string) => createHash("sha256").update(v).digest();
    return timingSafeEqual(digest(this.webhookSecret), digest(presented));
  }

  parseEventWebhook(payload: unknown): EmailEvent | null {
    if (typeof payload !== "object" || payload === null) return null;
    const p = payload as Record<string, unknown>;

    const eventType = p.event_type;
    if (typeof eventType !== "string") return null;

    const mailboxRef = p.email_account_id != null ? String(p.email_account_id) : null;
    if (!mailboxRef) return null;

    // providerEventId: webhook_id if present, else fallback
    const providerEventId =
      typeof p.webhook_id === "string" && p.webhook_id
        ? p.webhook_id
        : `${eventType}_${p.event_timestamp ?? ""}`;

    switch (eventType) {
      case "EMAIL_REPLY": {
        if (typeof p.from_email !== "string" || typeof p.reply_body !== "string" || typeof p.event_timestamp !== "string") return null;
        return {
          type: "reply",
          providerEventId,
          mailboxRef,
          from: p.from_email,
          body: p.reply_body,
          receivedAt: p.event_timestamp,
          messageRef: typeof p.message_id === "string" ? p.message_id : null,
        };
      }
      case "EMAIL_BOUNCE": {
        const recipient = p.to_email;
        if (typeof recipient !== "string") return null;
        return { type: "bounce", providerEventId, mailboxRef, recipient };
      }
      case "EMAIL_SPAM_COMPLAINT": {
        const recipient = p.to_email;
        if (typeof recipient !== "string") return null;
        return { type: "complaint", providerEventId, mailboxRef, recipient };
      }
      case "LEAD_UNSUBSCRIBED": {
        const recipient = p.lead_email;
        if (typeof recipient !== "string") return null;
        return { type: "unsubscribe", providerEventId, mailboxRef, recipient };
      }
      case "WARMUP_STATUS": {
        const phase = p.warmup_status === "COMPLETED" ? "ready" : "warming";
        const dailyCap = typeof p.max_email_per_day === "number" ? p.max_email_per_day : 0;
        return { type: "warmup_update", providerEventId, mailboxRef, phase, dailyCap };
      }
      default:
        return null;
    }
  }
}

/** The only construction point product code may use (white-label, rule 03). */
export function createEmailInfraFromEnv(): EmailInfra {
  const apiKey = process.env.SMARTLEAD_API_KEY;
  const webhookSecret = process.env.SMARTLEAD_WEBHOOK_SECRET;
  if (!apiKey || !webhookSecret) throw new Error("email infra env vars missing");
  return new SmartleadEmailInfra({ apiKey, webhookSecret });
}
