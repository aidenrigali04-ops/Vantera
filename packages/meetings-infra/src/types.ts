/**
 * Vantera-owned scheduling interface (ML-6). Product code talks only to this; the Calendly and
 * Cal.com adapters live in this package and vendor names never leave it (white-label, rules 03–05).
 */

export type MeetingProvider = "calendly" | "calcom";
export const MEETING_PROVIDERS: MeetingProvider[] = ["calendly", "calcom"];

/** A booking event, normalized across providers. */
export type MeetingEvent = {
  kind: "booked" | "canceled";
  /** stable per-booking id — idempotency + cancel → booking lookup */
  bookingRef: string;
  /** unique per delivery (dedupe), e.g. booking ref + kind */
  providerEventId: string;
  startAt: Date | null;
  inviteeEmail: string | null;
  inviteeName: string | null;
  /** the lead id our per-lead tag carried back on the booking link, when present */
  leadId: string | null;
  /** reschedule: the booking this one replaces (Calendly old_invitee / Cal.com rescheduleUid) —
   *  carries attribution forward when the new booking has no tag of its own */
  previousBookingRef: string | null;
};

export type CredentialCheck =
  | { ok: true; ownerRef: string; label: string | null; scopeRef: string | null }
  | { ok: false; reason: "invalid" | "plan" | "unavailable" };

export interface MeetingsInfra {
  readonly provider: MeetingProvider;
  /** Validate a pasted API credential; returns the provider-side owner refs needed for webhooks. */
  verifyCredential(credential: string): Promise<CredentialCheck>;
  /** Create the booking webhook pointing at `url`, signed with `signingSecret`. Returns its ref. */
  createWebhook(
    credential: string,
    opts: { url: string; signingSecret: string; ownerRef: string; scopeRef: string | null }
  ): Promise<{ webhookRef: string }>;
  deleteWebhook(credential: string, webhookRef: string): Promise<void>;
  /** Verify a delivery's signature against the connection's secret (raw body, constant-time). */
  verifyWebhook(headers: Record<string, string>, rawBody: string, signingSecret: string, now?: Date): boolean;
  /** Normalize a verified delivery; null for events we don't act on. */
  parseWebhook(payload: unknown): MeetingEvent | null;
}

/** Thrown by adapters; `reason` drives the user-facing message (no vendor names leave the package). */
export class MeetingsError extends Error {
  constructor(
    readonly reason: "invalid" | "plan" | "scope" | "unavailable",
    message: string
  ) {
    super(message);
  }
}

export type FetchLike = (url: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) => Promise<{
  status: number;
  ok: boolean;
  json(): Promise<unknown>;
  text(): Promise<string>;
}>;
