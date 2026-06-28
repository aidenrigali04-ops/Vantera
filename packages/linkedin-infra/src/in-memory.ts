import type {
  ConnectedAccount,
  GetProfileRequest,
  HostedAuthLink,
  HostedAuthRedirects,
  InviteRequest,
  LinkedInEngager,
  LinkedInEvent,
  LinkedInInfra,
  LinkedInPost,
  LinkedInProfile,
  MessageRequest,
  PostEngagersRequest,
  ProfilePostsRequest,
  SearchPostsRequest,
  SendOutcome,
  WebhookSetupResult,
} from "./types";

/** Test/dev double. Also the reference behavior for real adapters. */
export class InMemoryLinkedInInfra implements LinkedInInfra {
  readonly sentInvites: InviteRequest[] = [];
  readonly sentMessages: MessageRequest[] = [];
  /** Accounts returned by listAccounts() — push to simulate a connected workspace. */
  readonly accounts: ConnectedAccount[] = [];
  /** Seedable read fixtures for the Intent Agent reads. */
  readonly posts: LinkedInPost[] = [];
  readonly engagersByPost = new Map<string, LinkedInEngager[]>();
  readonly profiles = new Map<string, LinkedInProfile>();
  private counter = 0;

  constructor(private readonly webhookSecret = "in-memory-secret") {}

  async createHostedAuthLink(accountId: string, _redirects?: HostedAuthRedirects): Promise<HostedAuthLink> {
    return {
      url: `https://auth.example.com/connect/${accountId}`,
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    };
  }

  async listAccounts(): Promise<ConnectedAccount[]> {
    return [...this.accounts];
  }

  /** Records disconnected refs and drops the identity from the workspace (idempotent). */
  readonly disconnected: string[] = [];
  async deleteConnectedAccount(connectedAccountRef: string): Promise<void> {
    this.disconnected.push(connectedAccountRef);
    const i = this.accounts.findIndex((a) => a.providerRef === connectedAccountRef);
    if (i >= 0) this.accounts.splice(i, 1);
  }

  async sendInvite(req: InviteRequest): Promise<SendOutcome> {
    this.sentInvites.push(req);
    return { id: `inv_${++this.counter}`, sentAt: new Date().toISOString() };
  }

  async sendMessage(req: MessageRequest): Promise<SendOutcome> {
    this.sentMessages.push(req);
    return { id: `msg_${++this.counter}`, sentAt: new Date().toISOString() };
  }

  // ── Reads (Intent Agent) ──────────────────────────────────────────────────
  async searchPosts(req: SearchPostsRequest): Promise<LinkedInPost[]> {
    const q = req.query.toLowerCase();
    return this.posts.filter((p) => p.text.toLowerCase().includes(q)).slice(0, req.limit);
  }

  async listProfilePosts(req: ProfilePostsRequest): Promise<LinkedInPost[]> {
    return this.posts.filter((p) => p.authorProfileUrl === req.profileUrl).slice(0, req.limit);
  }

  async listPostEngagers(req: PostEngagersRequest): Promise<LinkedInEngager[]> {
    return (this.engagersByPost.get(req.postRef) ?? []).slice(0, req.limit);
  }

  async getProfile(req: GetProfileRequest): Promise<LinkedInProfile | null> {
    return this.profiles.get(req.profileUrl) ?? null;
  }

  // fake: plain equality; real adapters use a timing-safe compare (see interface doc)
  verifyWebhook(headers: Record<string, string>, _rawBody: string): boolean {
    return headers["x-webhook-secret"] === this.webhookSecret;
  }

  // mirrors the structure in email-infra's fake — keep the two in sync
  parseEventWebhook(payload: unknown): LinkedInEvent | null {
    if (typeof payload !== "object" || payload === null) return null;
    const p = payload as Record<string, unknown>;
    if (typeof p.event_id !== "string" || typeof p.connected_account !== "string") return null;
    const base = { providerEventId: p.event_id, connectedAccountRef: p.connected_account };
    switch (p.event_type) {
      case "reply":
        if (typeof p.from_profile_url !== "string" || typeof p.body !== "string" || typeof p.received_at !== "string") return null;
        return { type: "reply", ...base, fromProfileUrl: p.from_profile_url, body: p.body, receivedAt: p.received_at };
      case "relationship_accepted":
        if (typeof p.profile_url !== "string") return null;
        return { type: "relationship_accepted", ...base, profileUrl: p.profile_url };
      case "account_status":
        if ((p.status !== "active" && p.status !== "restricted" && p.status !== "disconnected")) return null;
        return {
          type: "account_status", ...base, status: p.status,
          profileUrl: typeof p.profile_url === "string" ? p.profile_url : null,
          displayName: typeof p.display_name === "string" ? p.display_name : null,
          vanteraAccountId: typeof p.metadata_account_id === "string" ? p.metadata_account_id : null,
        };
      default:
        return null;
    }
  }

  async setupWebhook(requestUrl: string): Promise<WebhookSetupResult> {
    return {
      requestUrl,
      secretConfigured: this.webhookSecret.length > 0,
      existing: 0,
      existingHooks: [],
      deleted: 0,
      created: WEBHOOK_SOURCES_FAKE.map((source) => ({ source, ok: true, detail: "fake" })),
    };
  }
}

const WEBHOOK_SOURCES_FAKE = ["messaging", "users", "account_status"];
