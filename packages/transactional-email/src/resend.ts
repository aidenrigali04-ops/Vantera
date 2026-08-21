import type {
  TransactionalEmail,
  TransactionalMessage,
  TransactionalSendResult,
} from "./types";

export interface ResendConfig {
  apiKey: string;
  /** Verified sender address, e.g. noreply@vanterasystem.com. */
  from: string;
  fetchFn?: typeof fetch;
  /** default https://api.resend.com */
  baseUrl?: string;
}

export class ResendTransactionalEmail implements TransactionalEmail {
  private readonly apiKey: string;
  private readonly from: string;
  private readonly fetchFn: typeof fetch;
  private readonly baseUrl: string;

  constructor(config: ResendConfig) {
    this.apiKey = config.apiKey;
    this.from = config.from;
    this.fetchFn = config.fetchFn ?? fetch;
    this.baseUrl = config.baseUrl ?? "https://api.resend.com";
  }

  async send(message: TransactionalMessage): Promise<TransactionalSendResult> {
    const body: Record<string, unknown> = {
      from: this.from,
      to: message.to,
      subject: message.subject,
      html: message.html,
    };
    if (message.text) body.text = message.text;
    if (message.replyTo) body.reply_to = message.replyTo;
    if (message.headers && Object.keys(message.headers).length > 0) {
      body.headers = message.headers;
    }

    const res = await this.fetchFn(`${this.baseUrl}/emails`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const detail = await res
        .text()
        .then((t) => t.slice(0, 300))
        .catch(() => "");
      throw new Error(
        `transactional email provider error ${res.status}${detail ? `: ${detail}` : ""}`
      );
    }

    const data = (await res.json()) as { id?: unknown };
    if (typeof data.id !== "string" || data.id === "") {
      throw new Error("provider response missing id");
    }
    return { messageId: data.id };
  }
}

/** The only construction point product code may use (white-label, rules 03/13). */
export function createTransactionalEmailFromEnv(): TransactionalEmail {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) throw new Error("transactional email env vars missing");
  return new ResendTransactionalEmail({ apiKey, from });
}
