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
  /**
   * The PROSPECT's member provider_id (ACoAA…) the send resolved. Persisted on the lead so
   * inbound webhooks — which identify people by provider_id, not vanity URL — can match a
   * reply back to the lead. Null when the adapter had no resolution step.
   */
  prospectProviderRef?: string | null;
}

/** Who an inbound event is from — every identity handle the payload carries, so the
 *  pipeline can match a lead by provider id, by URL, or (last resort) by unique name. */
export interface InboundIdentity {
  /** member provider_id (ACoAA…) — the ONLY identifier Unipile reliably sends */
  fromProviderRef: string | null;
  /** public vanity slug when the payload happens to carry it */
  fromPublicIdentifier: string | null;
  /** display name — unique-match fallback only, never a primary key */
  fromName: string | null;
}

/** A LinkedIn account currently connected in the provider workspace. */
export interface ConnectedAccount {
  /** Provider account id — persisted as linkedin_accounts.provider_ref. */
  providerRef: string;
  displayName: string | null;
  /**
   * When the provider created this connection (ISO-8601), or null if it didn't say.
   *
   * This is the only discriminator the accounts endpoint offers for "which of these did
   * the user in front of me just connect?". The hosted-auth `name` metadata does NOT
   * survive here — the provider overwrites it with the LinkedIn profile name (verified
   * against the live API), so it identifies the person, never the tenant.
   */
  createdAt: string | null;
  profileUrl: string | null;
  /**
   * 'connecting' means the provider has the account but hasn't reported its sources yet —
   * the transient state right after hosted auth returns. It is explicitly not a failure,
   * and must never overwrite a known-good status.
   */
  status: "connecting" | "active" | "restricted" | "disconnected";
}

export type LinkedInEvent =
  | ({ type: "reply"; providerEventId: string; connectedAccountRef: string; fromProfileUrl: string; body: string; receivedAt: string } & InboundIdentity)
  | ({ type: "relationship_accepted"; providerEventId: string; connectedAccountRef: string; profileUrl: string } & InboundIdentity)
  | { type: "account_status"; providerEventId: string; connectedAccountRef: string; status: "active" | "restricted" | "disconnected"; profileUrl: string | null; displayName: string | null; vanteraAccountId: string | null };

// ── Read surface (Intent Agent, Phase 13) ────────────────────────────────────
// These reads run through the user's connected account and count against LinkedIn's
// rate budget — the scheduler paces + ceilings them (rule 04 account-safety), never here.

/** A post surfaced by a search or a profile's activity. */
export interface LinkedInPost {
  /** provider post id — the dedupe `post_ref` on intent_observations */
  postRef: string;
  authorProfileUrl: string | null;
  authorName: string | null;
  authorHeadline: string | null;
  /** post body — feeds content-intent classification */
  text: string;
  postedAt: string | null;
  url: string | null;
}

/** A person who engaged with a post (reacted or commented). */
export interface LinkedInEngager {
  profileUrl: string;
  name: string | null;
  headline: string | null;
  /** how they engaged — a comment is a stronger intent signal than a reaction */
  kind: "reaction" | "comment";
  /** comment text, when kind === "comment" */
  text?: string;
}

/** A resolved profile — the contact shape the pipeline enriches into a lead. */
export interface LinkedInProfile {
  profileUrl: string;
  firstName: string | null;
  lastName: string | null;
  headline: string | null;
  companyName: string | null;
  location: string | null;
}

export interface SearchPostsRequest {
  connectedAccountId: string;
  /** keyword phrase or #hashtag */
  query: string;
  limit: number;
}
export interface ProfilePostsRequest {
  connectedAccountId: string;
  /** the creator/competitor profile whose recent posts we read */
  profileUrl: string;
  limit: number;
}
export interface PostEngagersRequest {
  connectedAccountId: string;
  postRef: string;
  limit: number;
}
export interface GetProfileRequest {
  connectedAccountId: string;
  profileUrl: string;
}

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
   *
   * `reconnect` re-authenticates an EXISTING connected identity in place (same
   * provider ref, same billable seat) — the flow for an expired session. Without
   * it a "reconnect" mints a brand-new provider account: a duplicate seat and a
   * second row for the same human (the 2026-07-08 triple-seat incident).
   */
  createHostedAuthLink(
    accountId: string,
    redirects?: HostedAuthRedirects,
    reconnect?: { providerRef: string }
  ): Promise<HostedAuthLink>;
  /**
   * The LinkedIn accounts connected in the provider workspace. Used to reconcile
   * connected identities into our store when a hosted-auth status webhook is
   * missed (e.g. on return from the connect flow) — never the primary attribution
   * path (that is the account_status webhook), but a reliable fallback.
   */
  listAccounts(): Promise<ConnectedAccount[]>;
  /**
   * Disconnect a connected identity from the provider workspace — called on account deletion so
   * the provider stops holding (and billing for) the tenant's connection (rule 11 vendor cleanup).
   * Idempotent + best-effort: an already-removed identity is a no-op, not an error.
   */
  deleteConnectedAccount(connectedAccountRef: string): Promise<void>;
  sendInvite(req: InviteRequest): Promise<SendOutcome>;
  sendMessage(req: MessageRequest): Promise<SendOutcome>;
  /**
   * Reject forged payloads BEFORE parsing. Real adapters must use a timing-safe
   * comparison (e.g. compare digests via crypto.timingSafeEqual); the in-memory
   * fake uses plain equality.
   */
  verifyWebhook(headers: Record<string, string>, rawBody: string): boolean;
  parseEventWebhook(payload: unknown): LinkedInEvent | null;
  /**
   * (Re)register the provider webhook(s) that deliver inbound events to `requestUrl`, configured
   * with the shared-secret header our route verifies. Removes any webhook already pointing at
   * `requestUrl` (a stale/misconfigured one whose secret no longer matches) and recreates it with
   * the correct header, covering the sources we parse (messages, new relations, account status).
   * Idempotent — safe to run repeatedly.
   */
  setupWebhook(requestUrl: string): Promise<WebhookSetupResult>;
  /**
   * Self-test the inbound route: POST a no-op (empty) event to `requestUrl` with the shared-secret
   * header. The route verifies the header, finds no event id, and returns 200 "ignored" — so a 200
   * proves the secret we register webhooks with matches what the route verifies, WITHOUT depending
   * on the provider actually delivering an event. A 401 means the secret is still mismatched.
   */
  probeWebhook(requestUrl: string): Promise<{ status: number; verified: boolean }>;

  // ── Reads (Intent Agent) — paced + ceilinged by the scheduler (rule 04) ──────
  /** Posts matching a keyword or #hashtag — content-intent + a source of posts to read engagers of. */
  searchPosts(req: SearchPostsRequest): Promise<LinkedInPost[]>;
  /** A specific creator/competitor profile's recent posts — the engagement-intent input. */
  listProfilePosts(req: ProfilePostsRequest): Promise<LinkedInPost[]>;
  /** People who reacted to or commented on a post — the engagement-intent leads. */
  listPostEngagers(req: PostEngagersRequest): Promise<LinkedInEngager[]>;
  /** Resolve a profile URL into a contact candidate; null when the profile can't be read. */
  getProfile(req: GetProfileRequest): Promise<LinkedInProfile | null>;
  /**
   * Whether `profileUrl` is now a 1st-degree connection of the connected account — i.e. an invite
   * we sent was accepted. Used to backfill acceptances missed while the webhook was down. Returns
   * the raw provider `network_distance` for diagnostics. Conservative: only an explicit 1st-degree
   * signal counts as connected (a false positive would try to message a non-connection).
   */
  getConnectionState(req: GetProfileRequest): Promise<{ connected: boolean; distance: string | null }>;
}

/** Outcome of {@link LinkedInInfra.setupWebhook} — a diagnostic the setup task logs. */
export interface WebhookSetupResult {
  requestUrl: string;
  /** false ⇒ the webhook secret env var is empty, so verification can never pass (a real misconfig). */
  secretConfigured: boolean;
  existing: number;
  /** Every webhook the provider currently has — logged so the URL/source config is visible. */
  existingHooks: { requestUrl: string | null; source: string | null }[];
  deleted: number;
  created: { source: string; ok: boolean; detail: string }[];
}
