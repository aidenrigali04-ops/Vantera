import { createHash, timingSafeEqual } from "node:crypto";
import type { ConnectedAccount, GetProfileRequest, HostedAuthLink, HostedAuthRedirects, InviteRequest, LinkedInEngager, LinkedInEvent, LinkedInInfra, LinkedInPost, LinkedInProfile, MessageRequest, PostEngagersRequest, ProfilePostsRequest, SearchPostsRequest, SendOutcome, WebhookSetupResult } from "./types";

// ── endpoint constants ──────────────────────────────────────────────────────
const PATH_HOSTED_AUTH = "/api/v1/hosted/accounts/link";
const HOSTED_AUTH_TTL_MS = 60 * 60_000;
const PATH_INVITE = "/api/v1/users/invite";
const PATH_CHATS = "/api/v1/chats";
const PATH_ACCOUNTS = "/api/v1/accounts";
const PATH_WEBHOOKS = "/api/v1/webhooks";
// Our inbound route path — a webhook whose URL contains this is one of ours (any domain).
const WEBHOOK_PATH = "/api/webhooks/linkedin";
// The event sources our route parses (message_received / new_relation / account_status).
const WEBHOOK_SOURCES = ["messaging", "users", "account_status"];

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
function accountStatusFromSources(sources: unknown): "connecting" | "active" | "restricted" | "disconnected" {
  // No sources yet means the initial sync hasn't finished, not that the account is gone.
  // Calling it "disconnected" strands a user who just connected: the onboarding gate counts
  // only connecting|active, so the row it writes wouldn't register as a connection at all.
  if (!Array.isArray(sources) || sources.length === 0) return "connecting";
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

/** A LinkedIn profile URL from a provider/member id (ACoAA…) — the form attendee_profile_url uses. */
function profileUrlFromId(providerId: string): string {
  return `https://www.linkedin.com/in/${providerId}`;
}

/**
 * True when a `message_received` event is OUR OWN outbound message echoed back by the chat sync
 * (Unipile fires the event for both directions). `is_sender` is the account-owner flag; tolerate the
 * several encodings Unipile has used (boolean / 0-1 / "true"). Skipping these is what keeps the
 * conversational responder from replying to itself in a loop.
 */
function isOwnMessage(p: Record<string, unknown>): boolean {
  const v = p.is_sender;
  return v === true || v === 1 || v === "1" || v === "true";
}

/**
 * Resolve the SENDER's profile URL from a real Unipile `message_received` payload (shape captured
 * 2026-06-28). The sender is one of the `attendees`; we prefer the attendee_profile_url (already the
 * /in/<provider_id> form our leads store), then fall back to constructing it from the provider id,
 * then — for a 1:1 chat — to the attendee that isn't us (account_info.user_id).
 */
function senderProfileUrl(p: Record<string, unknown>): string | null {
  const sender = (p.sender ?? {}) as Record<string, unknown>;
  const direct = str(sender.attendee_profile_url) ?? str(sender.profile_url);
  if (direct) return direct;

  const attendees: Record<string, unknown>[] = Array.isArray(p.attendees)
    ? (p.attendees as Record<string, unknown>[])
    : [];
  const senderProviderId = str(sender.attendee_provider_id);
  const senderAttendeeId = str(sender.attendee_id);
  for (const a of attendees) {
    const matchesProvider = senderProviderId && str(a.attendee_provider_id) === senderProviderId;
    const matchesAttendee = senderAttendeeId && str(a.attendee_id) === senderAttendeeId;
    if (matchesProvider || matchesAttendee) {
      return str(a.attendee_profile_url) ?? (senderProviderId ? profileUrlFromId(senderProviderId) : null);
    }
  }

  // 1:1 fallback: the attendee whose provider id isn't the connected account's own user_id.
  const ownProviderId = str((p.account_info as Record<string, unknown> | undefined)?.user_id);
  const other = attendees.find(
    (a) => str(a.attendee_provider_id) && str(a.attendee_provider_id) !== ownProviderId
  );
  if (other) {
    return str(other.attendee_profile_url) ?? profileUrlFromId(str(other.attendee_provider_id)!);
  }
  return senderProviderId ? profileUrlFromId(senderProviderId) : null;
}

/**
 * The SENDER attendee record from a `message_received` payload — the same resolution walk
 * senderProfileUrl does, returned whole so identity fields (provider id, public identifier,
 * name) come from one place and can't disagree with the URL.
 */
function senderAttendee(p: Record<string, unknown>): Record<string, unknown> | null {
  const sender = (p.sender ?? {}) as Record<string, unknown>;
  const attendees: Record<string, unknown>[] = Array.isArray(p.attendees)
    ? (p.attendees as Record<string, unknown>[])
    : [];
  const senderProviderId = str(sender.attendee_provider_id);
  const senderAttendeeId = str(sender.attendee_id);
  for (const a of attendees) {
    const matchesProvider = senderProviderId && str(a.attendee_provider_id) === senderProviderId;
    const matchesAttendee = senderAttendeeId && str(a.attendee_id) === senderAttendeeId;
    if (matchesProvider || matchesAttendee) return a;
  }
  if (senderProviderId || senderAttendeeId || str(sender.attendee_name)) return sender;
  const ownProviderId = str((p.account_info as Record<string, unknown> | undefined)?.user_id);
  return (
    attendees.find(
      (a) => str(a.attendee_provider_id) && str(a.attendee_provider_id) !== ownProviderId
    ) ?? null
  );
}

/** Resolve the new connection's profile URL from a `new_relation` payload across Unipile encodings. */
function relationProfileUrl(p: Record<string, unknown>): string | null {
  const user = (p.user ?? {}) as Record<string, unknown>;
  const slug = str(p.user_public_identifier) ?? str(user.public_identifier);
  return (
    str(p.user_profile_url) ??
    str(user.profile_url) ??
    (slug ? profileUrlFromId(slug) : null) ??
    (str(p.user_provider_id) ? profileUrlFromId(str(p.user_provider_id)!) : null) ??
    (str(user.provider_id) ? profileUrlFromId(str(user.provider_id)!) : null)
  );
}

/**
 * A Unipile LinkedIn provider_id (member internal id) looks like "ACoAA…". The write endpoints
 * (invite, chats) require this id, not a public vanity slug — a URL whose slug is already a
 * provider_id needs no lookup, while a public slug must be resolved (or the endpoints 400).
 */
function isProviderId(identifier: string): boolean {
  return /^ACoA/i.test(identifier);
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
  /**
   * The app's own base URL. Only used to reject a hostedAuthDomain pointing back at
   * this app: the provider's token path is not a route we serve, so the rewrite would
   * hand the user a 404 instead of the auth screen.
   */
  appUrl?: string;
}

/**
 * Coerce a configured white-label domain to the bare host `URL.host` requires. Assigning a
 * non-host (e.g. "https://example.com") does NOT throw — the setter parses up to the first
 * colon and silently yields the host "https" — so anything unusable returns null and the
 * caller keeps the provider's working URL.
 */
function normalizeHostedAuthDomain(raw: string | undefined): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const { host, hostname } = new URL(candidate);
    // A hostname with no dot is a bare label (e.g. "https", "localhost") — never a public
    // white-label domain, and the shape the silent-parse bug produced.
    return host && hostname.includes(".") ? host : null;
  } catch {
    return null;
  }
}

export class UnipileLinkedInInfra implements LinkedInInfra {
  private readonly apiKey: string;
  private readonly dsn: string;
  private readonly webhookSecret: string;
  private readonly fetchFn: typeof fetch;
  private readonly hostedAuthDomain: string | undefined;
  private readonly appUrl: string | undefined;

  constructor(config: UnipileConfig) {
    this.apiKey = config.apiKey;
    this.dsn = config.dsn;
    this.webhookSecret = config.webhookSecret;
    this.fetchFn = config.fetchFn ?? fetch;
    this.hostedAuthDomain = config.hostedAuthDomain;
    this.appUrl = config.appUrl;
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
  async createHostedAuthLink(
    accountId: string,
    redirects?: HostedAuthRedirects,
    reconnect?: { providerRef: string }
  ): Promise<HostedAuthLink> {
    const expiresOn = new Date(Date.now() + HOSTED_AUTH_TTL_MS).toISOString();
    // Reconnect mode re-authenticates the EXISTING provider account (same ref, same
    // billable seat) instead of creating a new one — the provider takes the target id.
    const body: Record<string, unknown> = {
      ...(reconnect
        ? { type: "reconnect", reconnect_account: reconnect.providerRef }
        : { type: "create" }),
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
    const whiteLabelHost = normalizeHostedAuthDomain(this.hostedAuthDomain);
    if (!this.hostedAuthDomain?.trim()) {
      console.warn("HOSTED_AUTH_DOMAIN unset — hosted-auth URL may expose the provider domain (white-label, rule 04)");
    } else if (!whiteLabelHost) {
      console.warn("HOSTED_AUTH_DOMAIN is not a usable hostname — expected a bare host like connect.example.com; leaving the provider URL so connect still works");
    } else if (whiteLabelHost === normalizeHostedAuthDomain(this.appUrl)) {
      // Pointing the white-label domain at this app sends users to the provider's token
      // path on our own host, which we don't route — a 404 instead of the auth screen.
      console.warn("HOSTED_AUTH_DOMAIN points at the app's own host — it must be a separate domain CNAME'd to the provider; leaving the provider URL so connect still works");
    } else {
      // The provider returns the URL on its own domain; swap in the white-label custom
      // domain (configured vendor-side via CNAME) before any user sees it (rule 04).
      // Path + query are preserved; only the host is replaced.
      const u = new URL(url);
      u.host = whiteLabelHost;
      url = u.toString();
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

  /**
   * Resolve a profile URL to the member's provider_id (ACoAA…) — the handle the invite and chat
   * endpoints require. A member-id URL already carries it as the slug (no lookup). A public vanity
   * slug is NOT a provider_id, so it is resolved via GET /users/{slug} (the same read path the
   * posts/profile reads use); the write endpoints 400 on a bare public slug. Returns null when the
   * lookup fails or yields no id, so the caller can fail loudly instead of sending a doomed request.
   */
  private async resolveProviderId(connectedAccountId: string, profileUrl: string): Promise<string | null> {
    const identifier = profileIdentifier(profileUrl);
    if (isProviderId(identifier)) return identifier;
    const profile = await this.call<{ provider_id?: unknown }>(
      `/api/v1/users/${encodeURIComponent(identifier)}?account_id=${encodeURIComponent(connectedAccountId)}`,
      { method: "GET" }
    ).catch(() => null);
    return profile ? str(profile.provider_id) : null;
  }

  async deleteConnectedAccount(connectedAccountRef: string): Promise<void> {
    // Rule 11 vendor cleanup: remove the connection from the provider so it stops billing for it.
    // Idempotent — a 404/410 (already gone) is success; any other status propagates to the caller.
    try {
      await this.call<unknown>(`${PATH_ACCOUNTS}/${encodeURIComponent(connectedAccountRef)}`, {
        method: "DELETE",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/provider error (404|410) /.test(msg)) return;
      throw err;
    }
  }

  async sendInvite(req: InviteRequest): Promise<SendOutcome> {
    // NOTE-LESS connection request: req.note is intentionally NOT sent. LinkedIn caps personalized
    // invitation notes hard — a free account gets only ~5/month and 403s the rest. Note-less requests
    // have far higher limits and better acceptance; the personalized pitch lands in the first message
    // after they accept (the follow-up the Copy agent already drafts). Invites go by the member's
    // provider_id (ACoAA…), which Unipile reads from the profile endpoint — a public vanity slug
    // 400s, so resolve it first (member-id URLs already carry it, so that path skips the lookup).
    const providerId = await this.resolveProviderId(req.connectedAccountId, req.profileUrl);
    if (!providerId) throw new Error(`linkedin invite: could not resolve provider_id for ${req.profileUrl}`);
    const data = await this.call<{ invitation_id?: unknown; sent_at?: unknown }>(PATH_INVITE, {
      method: "POST",
      body: JSON.stringify({
        account_id: req.connectedAccountId,
        provider_id: providerId,
      }),
    });
    // The invitation_id is proof the invite was sent; sent_at is informational and Unipile does not
    // always echo it. Fall back to our own clock rather than throwing — otherwise a delivered invite
    // gets caught downstream and marked failed (the "provider response missing sent_at" false-fail).
    return {
      id: requireString(data.invitation_id, "invitation_id"),
      sentAt: str(data.sent_at) ?? new Date().toISOString(),
      prospectProviderRef: providerId,
    };
  }

  async sendMessage(req: MessageRequest): Promise<SendOutcome> {
    // Starting a chat takes attendees_ids (provider_ids) + text, not a profile_url + message — the
    // same provider_id the invite uses, so resolve a public slug before sending (a bare slug 400s).
    const providerId = await this.resolveProviderId(req.connectedAccountId, req.profileUrl);
    if (!providerId) throw new Error(`linkedin message: could not resolve provider_id for ${req.profileUrl}`);
    const data = await this.call<{ message_id?: unknown; sent_at?: unknown }>(PATH_CHATS, {
      method: "POST",
      body: JSON.stringify({
        account_id: req.connectedAccountId,
        attendees_ids: [providerId],
        text: req.body,
      }),
    });
    // Same as sendInvite: the message_id proves delivery; a missing sent_at must not throw.
    return {
      id: requireString(data.message_id, "message_id"),
      sentAt: str(data.sent_at) ?? new Date().toISOString(),
      prospectProviderRef: providerId,
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
    const presented = headers["x-unipile-secret"];
    if (!presented) return false;
    const digest = (v: string) => createHash("sha256").update(v).digest();
    return timingSafeEqual(digest(this.webhookSecret), digest(presented));
  }

  /**
   * Parse a verified Unipile webhook into a typed LinkedInEvent.
   *
   * Reconciled 2026-06-28 against CAPTURED LIVE payloads (the prior shapes were assumed and silently
   * returned null for every real event — the post-invite funnel was deaf). Real Unipile webhooks
   * carry NO `event_id`: a message is identified by `message_id`, and the sender/connection is an
   * `attendees[]` entry, not a flat `sender.profile_url`. `is_sender` flags our own echoed message.
   */
  parseEventWebhook(payload: unknown): LinkedInEvent | null {
    if (typeof payload !== "object" || payload === null) return null;
    let p = payload as Record<string, unknown>;

    // Account-status webhooks carry NO top-level `event` discriminator: they arrive wrapped as
    // { AccountStatus: { account_id, account_type, message } }. Unwrap to the flat form the switch
    // expects — parsing only the flat shape silently discarded every status event the provider sent.
    const statusEnvelope = p.AccountStatus ?? p.account_status;
    if (statusEnvelope !== null && typeof statusEnvelope === "object" && !Array.isArray(statusEnvelope)) {
      p = { ...(statusEnvelope as Record<string, unknown>), event: "account_status" };
    }

    const event = p.event;
    if (typeof event !== "string") return null;

    const connectedAccountRef = p.account_id != null ? String(p.account_id) : null;
    if (!connectedAccountRef) return null;

    switch (event) {
      case "message_received": {
        if (isOwnMessage(p)) return null; // our own outbound copy echoed back — never a reply
        // No event_id on real payloads: the message id IS the idempotency key.
        const eventId = str(p.message_id) ?? str(p.provider_message_id);
        if (!eventId) return null;
        const fromProfileUrl = senderProfileUrl(p);
        const body = str(p.message);
        const receivedAt = str(p.timestamp);
        if (!fromProfileUrl || !body || !receivedAt) return null;
        // Every identity handle the payload carries: attendee_profile_url is the
        // /in/<provider_id> form (NOT the vanity URL leads store), so the provider id +
        // public identifier + name ride along for the pipeline's layered lead matching.
        const who = senderAttendee(p);
        return {
          type: "reply",
          providerEventId: eventId,
          connectedAccountRef,
          fromProfileUrl,
          fromProviderRef: str(who?.attendee_provider_id),
          fromPublicIdentifier: str(who?.attendee_public_identifier),
          fromName: str(who?.attendee_name),
          body,
          receivedAt,
        };
      }
      case "new_relation": {
        const profileUrl = relationProfileUrl(p);
        if (!profileUrl) return null;
        const user = (p.user ?? {}) as Record<string, unknown>;
        // No natural id on relation events: synthesize a stable key so provider retries dedupe
        // (one acceptance per account↔profile pair) without colliding distinct acceptances.
        return {
          type: "relationship_accepted",
          providerEventId: `relation:${connectedAccountRef}:${profileUrl}`,
          connectedAccountRef,
          profileUrl,
          fromProviderRef: str(p.user_provider_id) ?? str(user.provider_id),
          fromPublicIdentifier: str(p.user_public_identifier) ?? str(user.public_identifier),
          fromName:
            str(p.user_full_name) ??
            str(user.name) ??
            ([str(p.user_first_name) ?? str(user.first_name), str(p.user_last_name) ?? str(user.last_name)]
              .filter(Boolean)
              .join(" ") ||
              null),
        };
      }
      case "account_status": {
        // Tolerate both the flat `status` and the `message` field Unipile has used for the state.
        const rawStatus = p.status ?? p.message;
        // Synthesized id keyed on the state so a re-delivery of the SAME transition dedupes while a
        // later state change (e.g. recovery back to OK) is still processed.
        const eventId = `status:${connectedAccountRef}:${String(rawStatus ?? "unknown")}`;
        const base = { providerEventId: eventId, connectedAccountRef };
        let status: "active" | "restricted" | "disconnected";
        if (rawStatus === "CONNECTING") {
          // Documented as temporary — acting on it would flap a row that is mid-handshake.
          return null;
        }
        if (rawStatus === "OK" || rawStatus === "CREATION_SUCCESS" || rawStatus === "RECONNECTED" || rawStatus === "SYNC_SUCCESS") {
          status = "active";
        } else if (rawStatus === "DISCONNECTED" || rawStatus === "DELETED") {
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

  async getConnectionState(req: GetProfileRequest): Promise<{ connected: boolean; distance: string | null }> {
    const id = encodeURIComponent(profileIdentifier(req.profileUrl));
    try {
      const data = await this.call<Record<string, unknown>>(
        `/api/v1/users/${id}?account_id=${encodeURIComponent(req.connectedAccountId)}`,
        { method: "GET" }
      );
      const distance = str(data.network_distance);
      // Only an explicit 1st-degree signal counts (Unipile uses DISTANCE_1; tolerate FIRST_DEGREE).
      const connected = !!distance && /distance_?1|first/i.test(distance);
      return { connected, distance };
    } catch {
      return { connected: false, distance: null };
    }
  }

  async setupWebhook(requestUrl: string): Promise<WebhookSetupResult> {
    const secretConfigured = this.webhookSecret.length > 0;
    // 1. Read existing webhooks — learn the current config and find stale ones at our URL.
    const list = await this.call<{ items?: unknown; webhooks?: unknown }>(PATH_WEBHOOKS, { method: "GET" }).catch(
      () => ({}) as { items?: unknown; webhooks?: unknown }
    );
    const arr = (v: unknown): Record<string, unknown>[] =>
      Array.isArray(v) ? (v as Record<string, unknown>[]) : [];
    const items = [...arr(list.items), ...arr(list.webhooks)];
    const existingHooks = items.map((w) => ({ requestUrl: str(w.request_url), source: str(w.source) }));
    // Match by our route path (any domain / trailing slash), so a drifted URL is still cleaned up.
    const ours = items.filter((w) => (str(w.request_url) ?? "").includes(WEBHOOK_PATH));

    // 2. Delete the stale/misconfigured webhooks pointing at our route (their secret no longer matches).
    let deleted = 0;
    for (const w of ours) {
      const id = str(w.id) ?? str(w.webhook_id);
      if (!id) continue;
      await this.call<unknown>(`${PATH_WEBHOOKS}/${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => {});
      deleted += 1;
    }

    // 3. Recreate with the correct secret header — the sources already configured, plus our defaults.
    const sources = new Set<string>(WEBHOOK_SOURCES);
    for (const w of ours) {
      const s = str(w.source);
      if (s) sources.add(s);
    }
    const created: WebhookSetupResult["created"] = [];
    for (const source of sources) {
      created.push(await this.createWebhook(source, requestUrl));
    }
    return { requestUrl, secretConfigured, existing: items.length, existingHooks, deleted, created };
  }

  async probeWebhook(requestUrl: string): Promise<{ status: number; verified: boolean }> {
    // Hit OUR OWN inbound route (not the provider) with the secret header + an empty body. A non-401
    // means verification passed → the secret we'd register matches what the route checks.
    const res = await this.fetchFn(requestUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-unipile-secret": this.webhookSecret },
      body: "{}",
    });
    return { status: res.status, verified: res.status !== 401 };
  }

  /** Create one provider webhook with our shared-secret header; tolerant of both header encodings. */
  private async createWebhook(source: string, requestUrl: string): Promise<{ source: string; ok: boolean; detail: string }> {
    const base = { source, request_url: requestUrl, name: `vantera-linkedin-${source}` };
    const bodies = [
      { ...base, headers: [{ key: "x-unipile-secret", value: this.webhookSecret }] },
      { ...base, headers: { "x-unipile-secret": this.webhookSecret } },
    ];
    let detail = "";
    for (const body of bodies) {
      try {
        const res = await this.call<unknown>(PATH_WEBHOOKS, { method: "POST", body: JSON.stringify(body) });
        return { source, ok: true, detail: JSON.stringify(res).slice(0, 200) };
      } catch (err) {
        detail = err instanceof Error ? err.message : String(err);
      }
    }
    return { source, ok: false, detail: detail.slice(0, 300) };
  }
}

/** The only construction point product code may use (white-label, rule 04). */
/**
 * True when the provider env is complete enough to build the adapter. Lets callers give a
 * developer an actionable local message instead of the generic "try again" — the vendor
 * names stay inside this package (white-label, rule 04).
 */
export function isLinkedInInfraConfigured(): boolean {
  const { UNIPILE_API_KEY, UNIPILE_DSN, UNIPILE_WEBHOOK_SECRET } = process.env;
  return Boolean(UNIPILE_API_KEY && UNIPILE_DSN && UNIPILE_WEBHOOK_SECRET);
}

export function createLinkedInInfraFromEnv(): LinkedInInfra {
  const { UNIPILE_API_KEY, UNIPILE_DSN, UNIPILE_WEBHOOK_SECRET, HOSTED_AUTH_DOMAIN, APP_URL } = process.env;
  if (!UNIPILE_API_KEY || !UNIPILE_DSN || !UNIPILE_WEBHOOK_SECRET) {
    throw new Error("linkedin infra env vars missing");
  }
  return new UnipileLinkedInInfra({ apiKey: UNIPILE_API_KEY, dsn: UNIPILE_DSN, webhookSecret: UNIPILE_WEBHOOK_SECRET, hostedAuthDomain: HOSTED_AUTH_DOMAIN, appUrl: APP_URL });
}
