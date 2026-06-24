import { createHash, timingSafeEqual } from "node:crypto";
import type { ConnectedAccount, GetProfileRequest, HostedAuthLink, HostedAuthRedirects, InviteRequest, LinkedInEngager, LinkedInEvent, LinkedInInfra, LinkedInPost, LinkedInProfile, MessageRequest, PostEngagersRequest, ProfilePostsRequest, SearchPostsRequest, SendOutcome } from "./types";

// ── endpoint constants ──────────────────────────────────────────────────────
const PATH_HOSTED_AUTH = "/api/v1/hosted/accounts/link";
const HOSTED_AUTH_TTL_MS = 60 * 60_000;
const PATH_INVITE = "/api/v1/users/invite";
const PATH_CHATS = "/api/v1/chats";
const PATH_ACCOUNTS = "/api/v1/accounts";

function requireString(value: unknown, label: string): string {
  if (typeof value !== "string" || value === "") throw new Error(`provider response missing ${label}`);
  return value;
}

/** Map a provider account-source status to our coarse account status (mirrors parseEventWebhook). */
function sourceStatus(raw: unknown): "active" | "restricted" | "disconnected" {
  const s = raw && typeof raw === "object" ? (raw as Record<string, unknown>).status : raw;
  if (s === "OK" || s === "CREATION_SUCCESS") return "active";
  if (s === "DISCONNECTED") return "disconnected";
  return "restricted"; // CREDENTIALS / CHECKPOINT / PERMISSIONS / ERROR / STOPPED / SYNC_ERROR / unknown
}

/** Reduce all of an account's sources to one status: active only if every source is. */
function accountStatusFromSources(sources: unknown): "active" | "restricted" | "disconnected" {
  if (!Array.isArray(sources) || sources.length === 0) return "disconnected";
  const mapped = sources.map(sourceStatus);
  if (mapped.every((s) => s === "active")) return "active";
  if (mapped.some((s) => s === "disconnected")) return "disconnected";
  return "restricted";
}

// ── read mappers (Intent Agent) ──────────────────────────────────────────────
// Endpoint paths + response shapes below are best-effort and VERIFIED AT LIVE-WIRE
// (same convention as the prospect-data adapter): parsing stays defensive so a shape
// drift degrades to "no results" rather than a throw. The interface + in-memory fake
// are the contract the pipeline + tests bind to.
const str = (v: unknown): string | null => (typeof v === "string" && v !== "" ? v : null);

/** Extract the LinkedIn public identifier from a profile URL (…/in/<slug>), else the URL. */
function profileIdentifier(profileUrl: string): string {
  const m = profileUrl.match(/\/in\/([^/?#]+)/);
  return m ? m[1]! : profileUrl;
}

function mapItems<T>(items: unknown, map: (raw: unknown) => T | null, limit: number): T[] {
  if (!Array.isArray(items)) return [];
  const out: T[] = [];
  for (const raw of items) {
    const m = map(raw);
    if (m) out.push(m);
    if (out.length >= limit) break;
  }
  return out;
}

/** Profile URL from a Unipile actor: public_identifier slug preferred, provider id as fallback. */
function actorProfileUrl(a: Record<string, unknown> | undefined): string | null {
  const pub = str(a?.public_identifier);
  if (pub) return `https://www.linkedin.com/in/${pub}`;
  const id = str(a?.id);
  return id ? `https://www.linkedin.com/in/${id}` : null;
}

function mapPost(raw: unknown): LinkedInPost | null {
  if (typeof raw !== "object" || raw === null) return null;
  const p = raw as Record<string, unknown>;
  // reactions/comments are read by the post URN, so social_id is the canonical ref (not the
  // numeric id — they can differ, and the engager endpoints reject the numeric id).
  const postRef = str(p.social_id) ?? str(p.id);
  if (!postRef) return null;
  const author = p.author as Record<string, unknown> | undefined;
  return {
    postRef,
    authorProfileUrl: actorProfileUrl(author),
    authorName: str(author?.name),
    authorHeadline: str(author?.headline),
    text: str(p.text) ?? "",
    postedAt: str(p.parsed_datetime) ?? str(p.date),
    url: str(p.share_url),
  };
}

/** A reaction row: the reactor is under `author` (with a profile_url). */
function mapReaction(raw: unknown): LinkedInEngager | null {
  if (typeof raw !== "object" || raw === null) return null;
  const e = raw as Record<string, unknown>;
  const author = e.author as Record<string, unknown> | undefined;
  const profileUrl = str(author?.profile_url) ?? actorProfileUrl(author);
  if (!profileUrl) return null;
  return { profileUrl, name: str(author?.name), headline: str(author?.headline), kind: "reaction" };
}

/** A comment row: the commenter is under `author_details`; `author` is the display-name string. */
function mapComment(raw: unknown): LinkedInEngager | null {
  if (typeof raw !== "object" || raw === null) return null;
  const e = raw as Record<string, unknown>;
  const details = e.author_details as Record<string, unknown> | undefined;
  const profileUrl = str(details?.profile_url) ?? actorProfileUrl(details);
  if (!profileUrl) return null;
  const name =
    typeof e.author === "string" ? e.author : str((e.author as Record<string, unknown> | undefined)?.name);
  const engager: LinkedInEngager = { profileUrl, name, headline: str(details?.headline), kind: "comment" };
  const text = str(e.text);
  if (text) engager.text = text;
  return engager;
}

function mapProfile(raw: unknown): LinkedInProfile | null {
  if (typeof raw !== "object" || raw === null) return null;
  const u = raw as Record<string, unknown>;
  const publicId = str(u.public_identifier);
  const profileUrl =
    str(u.profile_url) ?? (publicId ? `https://www.linkedin.com/in/${publicId}` : null);
  if (!profileUrl) return null;
  const company = u.current_company as Record<string, unknown> | undefined;
  return {
    profileUrl,
    firstName: str(u.first_name),
    lastName: str(u.last_name),
    headline: str(u.headline),
    companyName: str(company?.name) ?? str(u.company_name),
    location: str(u.location),
  };
}

export interface UnipileConfig {
  apiKey: string;
  /** e.g. api1.unipile.com:13000 */
  dsn: string;
  webhookSecret: string;
  fetchFn?: typeof fetch;
  /**
   * Expected hostname (no protocol) of the white-labeled hosted-auth page,
   * e.g. "connect.vanterasystem.com". When set, the adapter asserts the
   * returned URL is on this domain; when unset, a warning is logged instead
   * (rule 04 — white-label).
   */
  hostedAuthDomain?: string;
}

export class UnipileLinkedInInfra implements LinkedInInfra {
  private readonly apiKey: string;
  private readonly dsn: string;
  private readonly webhookSecret: string;
  private readonly fetchFn: typeof fetch;
  private readonly hostedAuthDomain: string | undefined;

  constructor(config: UnipileConfig) {
    this.apiKey = config.apiKey;
    this.dsn = config.dsn;
    this.webhookSecret = config.webhookSecret;
    this.fetchFn = config.fetchFn ?? fetch;
    this.hostedAuthDomain = config.hostedAuthDomain;
  }

  // ── private helper ──────────────────────────────────────────────────────
  private async call<T>(path: string, init?: RequestInit): Promise<T> {
    const url = `https://${this.dsn}${path}`;
    const res = await this.fetchFn(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers as Record<string, string> | undefined),
        // x-api-key AFTER init.headers so it can never be clobbered by caller
        "x-api-key": this.apiKey,
      },
    });
    if (!res.ok) {
      const detail = await res.text().then((t) => t.slice(0, 300)).catch(() => "");
      throw new Error(`linkedin provider error ${res.status} on ${path}${detail ? `: ${detail}` : ""}`);
    }
    return res.json() as Promise<T>;
  }

  // ── LinkedInInfra implementation ─────────────────────────────────────────
  async createHostedAuthLink(accountId: string, redirects?: HostedAuthRedirects): Promise<HostedAuthLink> {
    const expiresOn = new Date(Date.now() + HOSTED_AUTH_TTL_MS).toISOString();
    const body: Record<string, unknown> = {
      type: "create",
      providers: ["LINKEDIN"],
      api_url: `https://${this.dsn}`,
      expiresOn,
      name: accountId,
    };
    if (redirects) {
      body.success_redirect_url = redirects.success;
      body.failure_redirect_url = redirects.failure;
      body.bypass_success_screen = true;
    }
    const data = await this.call<{ url?: unknown }>(PATH_HOSTED_AUTH, {
      method: "POST",
      body: JSON.stringify(body),
    });
    let url = requireString(data.url, "url");
    if (this.hostedAuthDomain) {
      // The provider returns the URL on its own domain; swap in the white-label custom
      // domain (configured vendor-side via CNAME) before any user sees it (rule 04).
      // Path + query are preserved; only the host is replaced.
      const u = new URL(url);
      u.host = this.hostedAuthDomain;
      url = u.toString();
    } else {
      console.warn("HOSTED_AUTH_DOMAIN unset — hosted-auth URL may expose the provider domain (white-label, rule 04)");
    }
    return { url, expiresAt: expiresOn };
  }

  async listAccounts(): Promise<ConnectedAccount[]> {
    const data = await this.call<{ items?: unknown }>(PATH_ACCOUNTS, { method: "GET" });
    const items = Array.isArray(data.items) ? data.items : [];
    const out: ConnectedAccount[] = [];
    for (const raw of items) {
      if (typeof raw !== "object" || raw === null) continue;
      const a = raw as Record<string, unknown>;
      if (a.type !== "LINKEDIN" || typeof a.id !== "string") continue; // ignore non-LinkedIn / malformed
      const im = (a.connection_params as Record<string, unknown> | undefined)?.im as Record<string, unknown> | undefined;
      const publicId = typeof im?.publicIdentifier === "string" ? im.publicIdentifier : null;
      out.push({
        providerRef: a.id,
        displayName: typeof a.name === "string" ? a.name : null,
        profileUrl: publicId ? `https://www.linkedin.com/in/${publicId}` : null,
        status: accountStatusFromSources(a.sources),
      });
    }
    return out;
  }

  async sendInvite(req: InviteRequest): Promise<SendOutcome> {
    // NOTE-LESS connection request: req.note is intentionally NOT sent. LinkedIn caps personalized
    // invitation notes hard — a free account gets only ~5/month and 403s the rest. Note-less requests
    // have far higher limits and better acceptance; the personalized pitch lands in the first message
    // after they accept (the follow-up the Copy agent already drafts). Invites go by the member's
    // provider_id, NOT a profile_url (a profile_url 400s); member-id URLs (…/in/ACoAAA…, what the
    // search source returns) carry the provider_id as the slug, so profileIdentifier yields it.
    const data = await this.call<{ invitation_id?: unknown; sent_at?: unknown }>(PATH_INVITE, {
      method: "POST",
      body: JSON.stringify({
        account_id: req.connectedAccountId,
        provider_id: profileIdentifier(req.profileUrl),
      }),
    });
    return { id: requireString(data.invitation_id, "invitation_id"), sentAt: requireString(data.sent_at, "sent_at") };
  }

  async sendMessage(req: MessageRequest): Promise<SendOutcome> {
    // Starting a chat takes attendees_ids (provider_ids) + text, not a profile_url + message.
    const data = await this.call<{ message_id?: unknown; sent_at?: unknown }>(PATH_CHATS, {
      method: "POST",
      body: JSON.stringify({
        account_id: req.connectedAccountId,
        attendees_ids: [profileIdentifier(req.profileUrl)],
        text: req.body,
      }),
    });
    return { id: requireString(data.message_id, "message_id"), sentAt: requireString(data.sent_at, "sent_at") };
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
        let status: "active" | "restricted" | "disconnected";
        if (rawStatus === "OK" || rawStatus === "CREATION_SUCCESS") {
          status = "active";
        } else if (rawStatus === "DISCONNECTED") {
          status = "disconnected";
        } else if (rawStatus === "CREDENTIALS" || rawStatus === "CHECKPOINT" || rawStatus === "PERMISSIONS" || rawStatus === "ERROR" || rawStatus === "STOPPED" || rawStatus === "SYNC_ERROR") {
          status = "restricted";
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

  // ── Reads (Intent Agent) — defensive parsing; shapes verified at live-wire ───
  async searchPosts(req: SearchPostsRequest): Promise<LinkedInPost[]> {
    const data = await this.call<{ items?: unknown }>(
      `/api/v1/linkedin/search?account_id=${encodeURIComponent(req.connectedAccountId)}`,
      { method: "POST", body: JSON.stringify({ api: "classic", category: "posts", keywords: req.query, limit: req.limit }) }
    );
    return mapItems(data.items, mapPost, req.limit);
  }

  async listProfilePosts(req: ProfilePostsRequest): Promise<LinkedInPost[]> {
    const acct = encodeURIComponent(req.connectedAccountId);
    // the posts endpoint wants the provider id (ACoAA…), not the public slug — resolve it first
    const slug = encodeURIComponent(profileIdentifier(req.profileUrl));
    const profile = await this.call<{ provider_id?: unknown }>(
      `/api/v1/users/${slug}?account_id=${acct}`,
      { method: "GET" }
    ).catch(() => null);
    const providerId = profile ? str(profile.provider_id) : null;
    if (!providerId) return [];
    const data = await this.call<{ items?: unknown }>(
      `/api/v1/users/${encodeURIComponent(providerId)}/posts?account_id=${acct}&limit=${req.limit}`,
      { method: "GET" }
    );
    return mapItems(data.items, mapPost, req.limit);
  }

  async listPostEngagers(req: PostEngagersRequest): Promise<LinkedInEngager[]> {
    const acct = encodeURIComponent(req.connectedAccountId);
    const post = encodeURIComponent(req.postRef);
    const empty = { items: [] as unknown };
    const [reactions, comments] = await Promise.all([
      this.call<{ items?: unknown }>(`/api/v1/posts/${post}/reactions?account_id=${acct}&limit=${req.limit}`, { method: "GET" }).catch(() => empty),
      this.call<{ items?: unknown }>(`/api/v1/posts/${post}/comments?account_id=${acct}&limit=${req.limit}`, { method: "GET" }).catch(() => empty),
    ]);
    // Dedupe by profile, preferring a comment (stronger intent) over a bare reaction.
    const byProfile = new Map<string, LinkedInEngager>();
    for (const e of [
      ...mapItems(reactions.items, mapReaction, req.limit),
      ...mapItems(comments.items, mapComment, req.limit),
    ]) {
      const existing = byProfile.get(e.profileUrl);
      if (!existing || (existing.kind === "reaction" && e.kind === "comment")) byProfile.set(e.profileUrl, e);
    }
    return [...byProfile.values()].slice(0, req.limit);
  }

  async getProfile(req: GetProfileRequest): Promise<LinkedInProfile | null> {
    const id = encodeURIComponent(profileIdentifier(req.profileUrl));
    try {
      const data = await this.call<unknown>(
        `/api/v1/users/${id}?account_id=${encodeURIComponent(req.connectedAccountId)}`,
        { method: "GET" }
      );
      return mapProfile(data);
    } catch {
      return null;
    }
  }
}

/** The only construction point product code may use (white-label, rule 04). */
export function createLinkedInInfraFromEnv(): LinkedInInfra {
  const { UNIPILE_API_KEY, UNIPILE_DSN, UNIPILE_WEBHOOK_SECRET, HOSTED_AUTH_DOMAIN } = process.env;
  if (!UNIPILE_API_KEY || !UNIPILE_DSN || !UNIPILE_WEBHOOK_SECRET) {
    throw new Error("linkedin infra env vars missing");
  }
  return new UnipileLinkedInInfra({ apiKey: UNIPILE_API_KEY, dsn: UNIPILE_DSN, webhookSecret: UNIPILE_WEBHOOK_SECRET, hostedAuthDomain: HOSTED_AUTH_DOMAIN });
}
