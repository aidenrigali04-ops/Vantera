import type {
  HostedAuthLink,
  InboundLinkedInReply,
  InviteRequest,
  LinkedInInfra,
  MessageRequest,
  SendOutcome,
} from "./types";

/** Test/dev double. Also the reference behavior for real adapters. */
export class InMemoryLinkedInInfra implements LinkedInInfra {
  readonly sentInvites: InviteRequest[] = [];
  readonly sentMessages: MessageRequest[] = [];
  private counter = 0;

  async createHostedAuthLink(accountId: string): Promise<HostedAuthLink> {
    return {
      url: `https://auth.example.com/connect/${accountId}`,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    };
  }

  async sendInvite(req: InviteRequest): Promise<SendOutcome> {
    this.sentInvites.push(req);
    return { id: `inv_${++this.counter}`, sentAt: new Date().toISOString() };
  }

  async sendMessage(req: MessageRequest): Promise<SendOutcome> {
    this.sentMessages.push(req);
    return { id: `msg_${++this.counter}`, sentAt: new Date().toISOString() };
  }

  parseReplyWebhook(payload: unknown): InboundLinkedInReply | null {
    if (typeof payload !== "object" || payload === null) return null;
    const p = payload as Record<string, unknown>;
    if (
      typeof p.connected_account_id !== "string" ||
      typeof p.from_profile_url !== "string" ||
      typeof p.body !== "string" ||
      typeof p.received_at !== "string"
    ) {
      return null;
    }
    return {
      connectedAccountId: p.connected_account_id,
      fromProfileUrl: p.from_profile_url,
      body: p.body,
      receivedAt: p.received_at,
    };
  }
}
