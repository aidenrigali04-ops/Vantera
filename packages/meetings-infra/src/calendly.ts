import { hmacHex, header, safeEqualHex } from "./signature";
import { parseLeadTag } from "./tag";
import { MeetingsError, type FetchLike, type MeetingEvent, type MeetingsInfra } from "./types";

/**
 * Calendly API v2 adapter (verified against the OpenAPI spec + webhook docs, 2026-10-21).
 * - Auth: Bearer personal access token (scopes: users:read, webhooks:write, scheduled_events:read).
 * - Webhooks require a paid Standard+ plan (403 "upgrade" otherwise); we create USER scope
 *   subscriptions (non-admin tokens can't create organization scope).
 * - Signature: header `Calendly-Webhook-Signature: t=<unix>,v1=<hex>`, HMAC-SHA256 of `${t}.${rawBody}`
 *   with our signing_key; deliveries older than 180s are rejected (replay window).
 * - Attribution: our tag comes back in payload.tracking.utm_content; a reschedule's new invitee
 *   points at the old one via payload.old_invitee.
 */
const BASE = "https://api.calendly.com";
const REPLAY_WINDOW_S = 180;

type Me = { resource?: { uri?: string; current_organization?: string; email?: string; name?: string } };

export function createCalendlyInfra(fetchFn: FetchLike = fetch as unknown as FetchLike): MeetingsInfra {
  const call = (credential: string, path: string, init: { method?: string; body?: unknown } = {}) =>
    fetchFn(path.startsWith("http") ? path : `${BASE}${path}`, {
      method: init.method ?? "GET",
      headers: { Authorization: `Bearer ${credential}`, "Content-Type": "application/json" },
      ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
    });

  return {
    provider: "calendly",

    async verifyCredential(credential) {
      const res = await call(credential, "/users/me");
      if (res.status === 401) return { ok: false, reason: "invalid" };
      if (!res.ok) return { ok: false, reason: "unavailable" };
      const me = (await res.json()) as Me;
      const uri = me.resource?.uri;
      if (!uri || !me.resource?.current_organization) return { ok: false, reason: "unavailable" };
      return { ok: true, ownerRef: uri, scopeRef: me.resource.current_organization, label: me.resource.email ?? me.resource.name ?? null };
    },

    async createWebhook(credential, { url, signingSecret, ownerRef, scopeRef }) {
      const res = await call(credential, "/webhook_subscriptions", {
        method: "POST",
        body: {
          url,
          events: ["invitee.created", "invitee.canceled"],
          organization: scopeRef,
          user: ownerRef,
          scope: "user",
          signing_key: signingSecret,
        },
      });
      if (res.status === 401) throw new MeetingsError("invalid", "credential rejected");
      if (res.status === 403) {
        const text = await res.text();
        throw /upgrade/i.test(text)
          ? new MeetingsError("plan", "scheduling plan does not include webhooks")
          : new MeetingsError("scope", "credential is missing a required permission");
      }
      if (!res.ok) throw new MeetingsError("unavailable", `webhook create failed (${res.status})`);
      const body = (await res.json()) as { resource?: { uri?: string } };
      if (!body.resource?.uri) throw new MeetingsError("unavailable", "webhook create returned no id");
      return { webhookRef: body.resource.uri };
    },

    async deleteWebhook(credential, webhookRef) {
      const res = await call(credential, webhookRef, { method: "DELETE" });
      if (!res.ok && res.status !== 404) throw new MeetingsError("unavailable", `webhook delete failed (${res.status})`);
    },

    verifyWebhook(headers, rawBody, signingSecret, now = new Date()) {
      const sig = header(headers, "calendly-webhook-signature");
      if (!sig) return false;
      const parts = Object.fromEntries(sig.split(",").map((p) => p.trim().split("=", 2) as [string, string]));
      const t = Number(parts.t);
      if (!parts.t || !parts.v1 || !Number.isFinite(t)) return false;
      if (Math.abs(now.getTime() / 1000 - t) > REPLAY_WINDOW_S) return false;
      return safeEqualHex(hmacHex(signingSecret, `${parts.t}.${rawBody}`), parts.v1);
    },

    parseWebhook(payload) {
      const p = payload as {
        event?: string;
        payload?: {
          uri?: string;
          email?: string | null;
          name?: string | null;
          old_invitee?: string | null;
          scheduled_event?: { start_time?: string | null };
          tracking?: { utm_content?: string | null };
        };
      };
      const kind = p.event === "invitee.created" ? "booked" : p.event === "invitee.canceled" ? "canceled" : null;
      const body = p.payload;
      if (!kind || !body?.uri) return null;
      const start = body.scheduled_event?.start_time ? new Date(body.scheduled_event.start_time) : null;
      const event: MeetingEvent = {
        kind,
        bookingRef: body.uri,
        providerEventId: `${body.uri}:${kind}`,
        startAt: start && !Number.isNaN(start.getTime()) ? start : null,
        inviteeEmail: body.email ?? null,
        inviteeName: body.name ?? null,
        leadId: parseLeadTag(body.tracking?.utm_content),
        previousBookingRef: kind === "booked" ? body.old_invitee ?? null : null,
      };
      return event;
    },
  };
}
