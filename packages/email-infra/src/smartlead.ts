import { createHash, timingSafeEqual } from "node:crypto";
import type { EmailEvent, EmailInfra, Mailbox, OutboundEmail, ProvisionRequest, SendResult, WarmupStatus } from "./types";

// ── endpoint constants ──────────────────────────────────────────────────────
const PATH_PROVISION = "/smart-senders/order";
const PATH_SEND = (mailboxId: string) => `/email-accounts/${mailboxId}/send`;
const PATH_WARMUP = (mailboxId: string) => `/email-accounts/${mailboxId}/warmup-stats`;

function requireString(value: unknown, label: string): string {
  if (typeof value !== "string" || value === "") throw new Error(`provider response missing ${label}`);
  return value;
}

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
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers as Record<string, string> | undefined) },
    });
    if (!res.ok) {
      const detail = await res.text().then((t) => t.slice(0, 300)).catch(() => "");
      throw new Error(`email provider error ${res.status} on ${path}${detail ? `: ${detail}` : ""}`);
    }
    return res.json() as Promise<T>;
  }

  // ── EmailInfra implementation ────────────────────────────────────────────
  async provision(req: ProvisionRequest): Promise<Mailbox[]> {
    const data = await this.call<{ accounts?: unknown }>(
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
    if (!Array.isArray(data.accounts)) throw new Error("provider response missing accounts");
    return (data.accounts as Array<Record<string, unknown>>).map((a) => {
      if (a.id == null) throw new Error("provider response missing id");
      return {
        id: String(a.id),
        address: requireString(a.email, "email"),
        domain: requireString(a.domain, "domain"),
      };
    });
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
    const data = await this.call<{ message_id?: unknown; sent_at?: unknown }>(
      PATH_SEND(email.mailboxId),
      { method: "POST", body: JSON.stringify(body) }
    );
    return { messageId: requireString(data.message_id, "message_id"), sentAt: requireString(data.sent_at, "sent_at") };
  }

  async warmupStatus(mailboxId: string): Promise<WarmupStatus> {
    const data = await this.call<{ warmup_status: string; max_email_per_day: unknown }>(
      PATH_WARMUP(mailboxId)
    );
    const dailyCap = typeof data.max_email_per_day === "number" ? data.max_email_per_day : 0;
    return {
      mailboxId,
      phase: data.warmup_status === "COMPLETED" ? "ready" : "warming",
      dailyCap,
    };
  }

  /**
   * Timing-safe comparison: digest both sides with SHA-256 first so lengths
   * are always equal, then use timingSafeEqual on the digests.
   * Missing header → false.
   *
   * Note: `rawBody` is unused by design — the provider supports only a static
   * shared-secret header (no body HMAC).  The timing-safe digest compare
   * prevents secret recovery via timing even though no body signing occurs.
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
