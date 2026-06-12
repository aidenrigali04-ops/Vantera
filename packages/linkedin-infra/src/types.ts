export interface HostedAuthLink {
  url: string;
  expiresAt: string;
}

export interface InviteRequest {
  connectedAccountId: string;
  profileUrl: string;
  note?: string;
}

export interface MessageRequest {
  connectedAccountId: string;
  profileUrl: string;
  body: string;
}

export interface SendOutcome {
  id: string;
  sentAt: string;
}

export interface InboundLinkedInReply {
  connectedAccountId: string;
  fromProfileUrl: string;
  body: string;
  receivedAt: string;
}

export type LinkedInEvent =
  | { type: "reply"; providerEventId: string; connectedAccountRef: string; fromProfileUrl: string; body: string; receivedAt: string }
  | { type: "relationship_accepted"; providerEventId: string; connectedAccountRef: string; profileUrl: string }
  | { type: "account_status"; providerEventId: string; connectedAccountRef: string; status: "active" | "disconnected"; profileUrl: string | null; displayName: string | null; vanteraAccountId: string | null };

/**
 * Provider-agnostic LinkedIn outreach interface (rule 04). Unipile is an
 * implementation detail behind it. Safety limits (ramp, weekly invite
 * ceiling, pacing) live in the scheduler, NOT here.
 */
export interface LinkedInInfra {
  createHostedAuthLink(accountId: string): Promise<HostedAuthLink>;
  sendInvite(req: InviteRequest): Promise<SendOutcome>;
  sendMessage(req: MessageRequest): Promise<SendOutcome>;
  parseReplyWebhook(payload: unknown): InboundLinkedInReply | null;
  verifyWebhook(headers: Record<string, string>, rawBody: string): boolean;
  parseEventWebhook(payload: unknown): LinkedInEvent | null;
}
