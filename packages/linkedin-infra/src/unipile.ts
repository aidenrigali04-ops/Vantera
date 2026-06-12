import { createHash, timingSafeEqual } from "node:crypto";
import type { HostedAuthLink, InviteRequest, LinkedInEvent, LinkedInInfra, MessageRequest, SendOutcome } from "./types";

// ── endpoint constants ──────────────────────────────────────────────────────
const PATH_HOSTED_AUTH = "/api/v1/hosted/accounts/link";
const PATH_INVITE = "/api/v1/users/invite";
const PATH_CHATS = "/api/v1/chats";

export interface UnipileConfig {
  apiKey: string;
  /** e.g. api1.unipile.com:13000 */
  dsn: string;
  webhookSecret: string;
  fetchFn?: typeof fetch;
}

export class UnipileLinkedInInfra implements LinkedInInfra {
  private readonly apiKey: string;
  private readonly dsn: string;
  private readonly webhookSecret: string;
  private readonly fetchFn: typeof fetch;

  constructor(config: UnipileConfig) {
    this.apiKey = config.apiKey;
    this.dsn = config.dsn;
    this.webhookSecret = config.webhookSecret;
    this.fetchFn = config.fetchFn ?? fetch;
  }

  // ── private helper ──────────────────────────────────────────────────────
  private async call<T>(path: string, init?: RequestInit): Promise<T> {
    const url = `https://${this.dsn}${path}`;
    const res = await this.fetchFn(url, {
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
      },
      ...init,
    });
    if (!res.ok) {
      throw new Error(`linkedin provider error ${res.status} on ${path}`);
    }
    return res.json() as Promise<T>;
  }

  // ── LinkedInInfra implementation ─────────────────────────────────────────
  async createHostedAuthLink(accountId: string): Promise<HostedAuthLink> {
    const data = await this.call<{ url: string; expires_at: string }>(PATH_HOSTED_AUTH, {
      method: "POST",
      body: JSON.stringify({
        providers: ["LINKEDIN"],
        name: accountId,
      }),
    });
    return { url: data.url, expiresAt: data.expires_at };
  }

  async sendInvite(req: InviteRequest): Promise<SendOutcome> {
    const data = await this.call<{ invitation_id: string; sent_at: string }>(PATH_INVITE, {
      method: "POST",
      body: JSON.stringify({
        account_id: req.connectedAccountId,
        profile_url: req.profileUrl,
        message: req.note,
      }),
    });
    return { id: data.invitation_id, sentAt: data.sent_at };
  }

  async sendMessage(req: MessageRequest): Promise<SendOutcome> {
    const data = await this.call<{ message_id: string; sent_at: string }>(PATH_CHATS, {
      method: "POST",
      body: JSON.stringify({
        account_id: req.connectedAccountId,
        profile_url: req.profileUrl,
        message: req.body,
      }),
    });
    return { id: data.message_id, sentAt: data.sent_at };
  }

  /**
   * Timing-safe comparison: digest both sides with SHA-256 first so lengths
   * are always equal, then use timingSafeEqual on the digests.
   * Missing header → false.
   */
  verifyWebhook(headers: Record<string, string>, _rawBody: string): boolean {
    const presented = headers["x-unipile-secret"];
    if (!presented) return false;
    const digest = (v: string) => createHash("sha256").update(v).digest();
    return timingSafeEqual(digest(this.webhookSecret), digest(presented));
  }

  parseEventWebhook(payload: unknown): LinkedInEvent | null {
    if (typeof payload !== "object" || payload === null) return null;
    const p = payload as Record<string, unknown>;

    const event = p.event;
    if (typeof event !== "string") return null;

    const eventId = typeof p.event_id === "string" ? p.event_id : null;
    if (!eventId) return null;

    const connectedAccountRef = p.account_id != null ? String(p.account_id) : null;
    if (!connectedAccountRef) return null;

    const base = { providerEventId: eventId, connectedAccountRef };

    switch (event) {
      case "message_received": {
        const sender = p.sender as Record<string, unknown> | undefined;
        const fromProfileUrl = typeof sender?.profile_url === "string" ? sender.profile_url : null;
        if (!fromProfileUrl || typeof p.message !== "string" || typeof p.timestamp !== "string") return null;
        return {
          type: "reply",
          ...base,
          fromProfileUrl,
          body: p.message,
          receivedAt: p.timestamp,
        };
      }
      case "new_relation": {
        if (typeof p.user_profile_url !== "string") return null;
        return {
          type: "relationship_accepted",
          ...base,
          profileUrl: p.user_profile_url,
        };
      }
      case "account_status": {
        const rawStatus = p.status;
        let status: "active" | "disconnected";
        if (rawStatus === "OK" || rawStatus === "CREATION_SUCCESS") {
          status = "active";
        } else if (rawStatus === "DISCONNECTED") {
          status = "disconnected";
        } else {
          return null;
        }
        return {
          type: "account_status",
          ...base,
          status,
          profileUrl: typeof p.profile_url === "string" ? p.profile_url : null,
          displayName: typeof p.display_name === "string" ? p.display_name : null,
          vanteraAccountId: typeof p.name === "string" ? p.name : null,
        };
      }
      default:
        return null;
    }
  }
}

/** The only construction point product code may use (white-label, rule 04). */
export function createLinkedInInfraFromEnv(): LinkedInInfra {
  const { UNIPILE_API_KEY, UNIPILE_DSN, UNIPILE_WEBHOOK_SECRET } = process.env;
  if (!UNIPILE_API_KEY || !UNIPILE_DSN || !UNIPILE_WEBHOOK_SECRET) {
    throw new Error("linkedin infra env vars missing");
  }
  return new UnipileLinkedInInfra({ apiKey: UNIPILE_API_KEY, dsn: UNIPILE_DSN, webhookSecret: UNIPILE_WEBHOOK_SECRET });
}
