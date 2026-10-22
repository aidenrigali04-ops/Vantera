import { hmacHex, header, safeEqualHex } from "./signature";
import { parseLeadTag } from "./tag";
import { MeetingsError, type FetchLike, type MeetingEvent, type MeetingsInfra } from "./types";

/**
 * Cal.com API v2 adapter (v1 was shut down 2026-04-08; verified against the v2 reference, the
 * webhooks guide, and source, 2026-10-21).
 * - Auth: Bearer API key (cal_live_… / cal_…). /v2/me and /v2/webhooks need no cal-api-version.
 * - Signature: header `X-Cal-Signature-256` = lowercase hex HMAC-SHA256 of the exact raw body with
 *   our secret. No timestamp → replay safety comes from idempotency on (uid, trigger).
 * - Attribution: our tag comes back in payload.metadata.vt (from the `metadata[vt]` link param;
 *   Cal.com does NOT echo utm_*). Cancels carry no metadata — they map back by uid. A reschedule
 *   is ONE event (BOOKING_RESCHEDULED) whose payload.rescheduleUid is the old booking.
 */
const BASE = "https://api.cal.com/v2";

export function createCalcomInfra(fetchFn: FetchLike = fetch as unknown as FetchLike): MeetingsInfra {
  const call = (credential: string, path: string, init: { method?: string; body?: unknown } = {}) =>
    fetchFn(`${BASE}${path}`, {
      method: init.method ?? "GET",
      headers: { Authorization: `Bearer ${credential}`, "Content-Type": "application/json" },
      ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
    });

  return {
    provider: "calcom",

    async verifyCredential(credential) {
      const res = await call(credential, "/me");
      if (res.status === 401 || res.status === 403) return { ok: false, reason: "invalid" };
      if (!res.ok) return { ok: false, reason: "unavailable" };
      const me = (await res.json()) as { data?: { id?: number; email?: string; username?: string } };
      if (me.data?.id == null) return { ok: false, reason: "unavailable" };
      return { ok: true, ownerRef: String(me.data.id), scopeRef: null, label: me.data.email ?? me.data.username ?? null };
    },

    async createWebhook(credential, { url, signingSecret }) {
      const res = await call(credential, "/webhooks", {
        method: "POST",
        body: {
          subscriberUrl: url,
          triggers: ["BOOKING_CREATED", "BOOKING_CANCELLED", "BOOKING_RESCHEDULED"],
          active: true,
          secret: signingSecret,
          version: "2021-10-20",
        },
      });
      if (res.status === 401 || res.status === 403) throw new MeetingsError("invalid", "credential rejected");
      if (!res.ok) throw new MeetingsError("unavailable", `webhook create failed (${res.status})`);
      const body = (await res.json()) as { data?: { id?: number | string } };
      if (body.data?.id == null) throw new MeetingsError("unavailable", "webhook create returned no id");
      return { webhookRef: String(body.data.id) };
    },

    async deleteWebhook(credential, webhookRef) {
      const res = await call(credential, `/webhooks/${encodeURIComponent(webhookRef)}`, { method: "DELETE" });
      if (!res.ok && res.status !== 404) throw new MeetingsError("unavailable", `webhook delete failed (${res.status})`);
    },

    verifyWebhook(headers, rawBody, signingSecret) {
      const sig = header(headers, "x-cal-signature-256");
      if (!sig) return false;
      return safeEqualHex(hmacHex(signingSecret, rawBody), sig.trim());
    },

    parseWebhook(payload) {
      const p = payload as {
        triggerEvent?: string;
        payload?: {
          uid?: string;
          startTime?: string | null;
          attendees?: { email?: string; name?: string }[];
          metadata?: Record<string, unknown> | null;
          rescheduleUid?: string | null;
        };
      };
      const t = p.triggerEvent;
      const kind = t === "BOOKING_CREATED" || t === "BOOKING_RESCHEDULED" ? "booked" : t === "BOOKING_CANCELLED" ? "canceled" : null;
      const body = p.payload;
      if (!kind || !body?.uid) return null;
      const start = body.startTime ? new Date(body.startTime) : null;
      const booker = body.attendees?.[0];
      const event: MeetingEvent = {
        kind,
        bookingRef: body.uid,
        providerEventId: `${body.uid}:${t}`,
        startAt: start && !Number.isNaN(start.getTime()) ? start : null,
        inviteeEmail: booker?.email ?? null,
        inviteeName: booker?.name ?? null,
        leadId: parseLeadTag(body.metadata?.vt),
        previousBookingRef: t === "BOOKING_RESCHEDULED" ? body.rescheduleUid ?? null : null,
      };
      return event;
    },
  };
}
