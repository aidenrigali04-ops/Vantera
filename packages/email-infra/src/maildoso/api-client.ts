import type { SmtpCredentials } from "./smtp-sender";

export interface MaildosoApiClientConfig {
  apiKey: string;
  /** default https://api.maildoso.com — CONFIRM ON ACTIVATION (open-Q#1) */
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export interface CreatedMailbox {
  providerRef: string;
  address: string;
  domain: string;
  smtp: SmtpCredentials;
}

/** The ONLY place that knows Maildoso's HTTP shape. Every path/field marked CONFIRM ON ACTIVATION
 *  is confirmed against developers.maildoso.com once the plan is active; nothing else changes. */
export class MaildosoApiClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(cfg: MaildosoApiClientConfig) {
    this.apiKey = cfg.apiKey;
    this.baseUrl = cfg.baseUrl ?? "https://api.maildoso.com"; // CONFIRM ON ACTIVATION (open-Q#1)
    this.fetchImpl = cfg.fetchImpl ?? fetch;
  }

  private async call(method: string, path: string, body?: unknown): Promise<unknown> {
    const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method,
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" }, // CONFIRM (open-Q#1)
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`maildoso ${res.status}: ${await res.text()}`);
    return res.json();
  }

  /** Register or connect a sending domain (auto SPF/DKIM/DMARC). CONFIRM path/fields (open-Q#2). */
  async ensureDomain(domain: string): Promise<void> {
    await this.call("POST", "/v1/domains", { domain });
  }

  /** Create one mailbox on a domain; returns address + per-mailbox SMTP creds. CONFIRM (open-Q#3/#4). */
  async createMailbox(domain: string, localPart: string): Promise<CreatedMailbox> {
    const r = (await this.call("POST", "/v1/mailboxes", { domain, username: localPart })) as Record<string, any>;
    return {
      providerRef: String(r.id),
      address: String(r.email),
      domain,
      smtp: {
        host: String(r.smtp.host), port: Number(r.smtp.port),
        username: String(r.smtp.username), password: String(r.smtp.password),
        secure: r.smtp.secure ?? undefined,
      },
    };
  }

  /** Warmup state for a mailbox. CONFIRM path/fields (open-Q#5). */
  async getWarmup(providerRef: string): Promise<{ phase: "warming" | "ready"; dailyCap: number }> {
    const r = (await this.call("GET", `/v1/mailboxes/${providerRef}/warmup`)) as Record<string, any>;
    return { phase: r.warmup_state === "ready" ? "ready" : "warming", dailyCap: Number(r.daily_limit ?? 0) };
  }

  /** Delete a mailbox (deprovision-on-cancel). CONFIRM path (open-Q#6). */
  async deleteMailbox(providerRef: string): Promise<void> {
    await this.call("DELETE", `/v1/mailboxes/${providerRef}`);
  }

  /** Release a domain (deprovision-on-cancel). CONFIRM path (open-Q#6). */
  async releaseDomain(domain: string): Promise<void> {
    await this.call("DELETE", `/v1/domains/${encodeURIComponent(domain)}`);
  }
}
