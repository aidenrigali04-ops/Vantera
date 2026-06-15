export interface HostedAuthLink {
  url: string;
  expiresAt: string;
}

export interface HostedAuthRedirects {
  /** Absolute URL the browser returns to on success. */
  success: string;
  /** Absolute URL the browser returns to on failure/cancel. */
  failure: string;
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

export type LinkedInEvent =
  | { type: "reply"; providerEventId: string; connectedAccountRef: string; fromProfileUrl: string; body: string; receivedAt: string }
  | { type: "relationship_accepted"; providerEventId: string; connectedAccountRef: string; profileUrl: string }
  | { type: "account_status"; providerEventId: string; connectedAccountRef: string; status: "active" | "restricted" | "disconnected"; profileUrl: string | null; displayName: string | null; vanteraAccountId: string | null };

/**
 * Provider-agnostic LinkedIn outreach interface (rule 04). Unipile is an
 * implementation detail behind it. Safety limits (ramp, weekly invite
 * ceiling, pacing) live in the scheduler, NOT here.
 */
export interface LinkedInInfra {
  /**
   * accountId rides through the provider as hosted-auth metadata and comes back
   * as vanteraAccountId on account_status events — that round-trip is how a
   * connected identity is attributed to a tenant.
   */
  createHostedAuthLink(accountId: string, redirects?: HostedAuthRedirects): Promise<HostedAuthLink>;
  sendInvite(req: InviteRequest): Promise<SendOutcome>;
  sendMessage(req: MessageRequest): Promise<SendOutcome>;
  /**
   * Reject forged payloads BEFORE parsing. Real adapters must use a timing-safe
   * comparison (e.g. compare digests via crypto.timingSafeEqual); the in-memory
   * fake uses plain equality.
   */
  verifyWebhook(headers: Record<string, string>, rawBody: string): boolean;
  parseEventWebhook(payload: unknown): LinkedInEvent | null;
}
