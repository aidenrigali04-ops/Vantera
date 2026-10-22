import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { createCalendlyInfra } from "./calendly";
import { createCalcomInfra } from "./calcom";
import { getMeetingsInfra } from "./index";
import { MeetingsError, type FetchLike } from "./types";

const LEAD = "3f6c2a9e-1b2d-4c3e-9f00-1234567890ab";
const SECRET = "s3cret";

function fakeFetch(responses: { status: number; body: unknown }[]) {
  const calls: { url: string; method: string; headers: Record<string, string>; body: unknown }[] = [];
  let i = 0;
  const fn: FetchLike = async (url, init) => {
    calls.push({ url, method: init?.method ?? "GET", headers: init?.headers ?? {}, body: init?.body ? JSON.parse(init.body) : undefined });
    const r = responses[Math.min(i++, responses.length - 1)]!;
    return { status: r.status, ok: r.status >= 200 && r.status < 300, json: async () => r.body, text: async () => JSON.stringify(r.body) };
  };
  return { fn, calls };
}

describe("calendly adapter", () => {
  const now = new Date("2026-10-21T12:00:00Z");
  const t = String(Math.floor(now.getTime() / 1000));
  const sign = (body: string, ts = t) => `t=${ts},v1=${createHmac("sha256", SECRET).update(`${ts}.${body}`).digest("hex")}`;
  const infra = createCalendlyInfra(fakeFetch([]).fn);

  it("verifies the t.rawBody HMAC and rejects tampering, replays, and wrong secrets", () => {
    const body = '{"event":"invitee.created"}';
    expect(infra.verifyWebhook({ "Calendly-Webhook-Signature": sign(body) }, body, SECRET, now)).toBe(true);
    expect(infra.verifyWebhook({ "calendly-webhook-signature": sign(body) }, body + " ", SECRET, now)).toBe(false);
    expect(infra.verifyWebhook({ "calendly-webhook-signature": sign(body, String(Number(t) - 181)) }, body, SECRET, now)).toBe(false);
    expect(infra.verifyWebhook({ "calendly-webhook-signature": sign(body) }, body, "other", now)).toBe(false);
    expect(infra.verifyWebhook({}, body, SECRET, now)).toBe(false);
  });

  it("parses invitee.created with our tag, start time, and a reschedule's old invitee", () => {
    const e = infra.parseWebhook({
      event: "invitee.created",
      payload: {
        uri: "https://api.calendly.com/scheduled_events/E1/invitees/I2",
        email: "dana@acme.com",
        name: "Dana Reed",
        old_invitee: "https://api.calendly.com/scheduled_events/E0/invitees/I1",
        scheduled_event: { start_time: "2026-10-30T15:00:00.000000Z" },
        tracking: { utm_content: `vt-${LEAD}`, utm_source: "newsletter" },
      },
    });
    expect(e).toEqual({
      kind: "booked",
      bookingRef: "https://api.calendly.com/scheduled_events/E1/invitees/I2",
      providerEventId: "https://api.calendly.com/scheduled_events/E1/invitees/I2:booked",
      startAt: new Date("2026-10-30T15:00:00Z"),
      inviteeEmail: "dana@acme.com",
      inviteeName: "Dana Reed",
      leadId: LEAD,
      previousBookingRef: "https://api.calendly.com/scheduled_events/E0/invitees/I1",
    });
  });

  it("parses a cancel and ignores events it doesn't act on", () => {
    expect(infra.parseWebhook({ event: "invitee.canceled", payload: { uri: "inv1", tracking: {} } })).toMatchObject({ kind: "canceled", bookingRef: "inv1", leadId: null });
    expect(infra.parseWebhook({ event: "routing_form_submission.created", payload: { uri: "x" } })).toBeNull();
  });

  it("creates a user-scoped webhook with our signing key and maps a plan 403", async () => {
    const ok = fakeFetch([{ status: 201, body: { resource: { uri: "https://api.calendly.com/webhook_subscriptions/W1" } } }]);
    const r = await createCalendlyInfra(ok.fn).createWebhook("pat", { url: "https://app/x", signingSecret: SECRET, ownerRef: "U1", scopeRef: "O1" });
    expect(r.webhookRef).toBe("https://api.calendly.com/webhook_subscriptions/W1");
    expect(ok.calls[0]).toMatchObject({
      url: "https://api.calendly.com/webhook_subscriptions",
      method: "POST",
      body: { url: "https://app/x", events: ["invitee.created", "invitee.canceled"], organization: "O1", user: "U1", scope: "user", signing_key: SECRET },
    });
    expect(ok.calls[0]!.headers.Authorization).toBe("Bearer pat");
    const plan = fakeFetch([{ status: 403, body: { message: "Please upgrade your Calendly account to Standard" } }]);
    await expect(createCalendlyInfra(plan.fn).createWebhook("pat", { url: "u", signingSecret: SECRET, ownerRef: "U1", scopeRef: "O1" })).rejects.toMatchObject({ reason: "plan" });
    const scope = fakeFetch([{ status: 403, body: { message: "Permission denied" } }]);
    await expect(createCalendlyInfra(scope.fn).createWebhook("pat", { url: "u", signingSecret: SECRET, ownerRef: "U1", scopeRef: "O1" })).rejects.toBeInstanceOf(MeetingsError);
  });

  it("checks a credential via /users/me", async () => {
    const ok = fakeFetch([{ status: 200, body: { resource: { uri: "U1", current_organization: "O1", email: "me@acme.com" } } }]);
    expect(await createCalendlyInfra(ok.fn).verifyCredential("pat")).toEqual({ ok: true, ownerRef: "U1", scopeRef: "O1", label: "me@acme.com" });
    expect(ok.calls[0]!.url).toBe("https://api.calendly.com/users/me");
    const bad = fakeFetch([{ status: 401, body: {} }]);
    expect(await createCalendlyInfra(bad.fn).verifyCredential("nope")).toEqual({ ok: false, reason: "invalid" });
  });
});

describe("cal.com adapter", () => {
  const infra = createCalcomInfra(fakeFetch([]).fn);
  const sign = (body: string) => createHmac("sha256", SECRET).update(body).digest("hex");

  it("verifies the hex body HMAC and rejects tampering", () => {
    const body = '{"triggerEvent":"BOOKING_CREATED"}';
    expect(infra.verifyWebhook({ "X-Cal-Signature-256": sign(body) }, body, SECRET)).toBe(true);
    expect(infra.verifyWebhook({ "x-cal-signature-256": sign(body) }, `${body} `, SECRET)).toBe(false);
    expect(infra.verifyWebhook({ "x-cal-signature-256": "no-secret-provided" }, body, SECRET)).toBe(false);
  });

  it("parses BOOKING_CREATED with our metadata tag and the booker", () => {
    expect(
      infra.parseWebhook({
        triggerEvent: "BOOKING_CREATED",
        payload: {
          uid: "bk-1",
          startTime: "2026-10-30T15:00:00Z",
          attendees: [{ email: "dana@acme.com", name: "Dana" }, { email: "guest@x.com", name: "Guest" }],
          metadata: { vt: `vt-${LEAD}`, videoCallUrl: "https://x" },
          status: "ACCEPTED",
        },
      })
    ).toEqual({
      kind: "booked",
      bookingRef: "bk-1",
      providerEventId: "bk-1:BOOKING_CREATED",
      startAt: new Date("2026-10-30T15:00:00Z"),
      inviteeEmail: "dana@acme.com",
      inviteeName: "Dana",
      leadId: LEAD,
      previousBookingRef: null,
    });
  });

  it("maps a reschedule to a booking that replaces the old uid, and parses cancels", () => {
    expect(infra.parseWebhook({ triggerEvent: "BOOKING_RESCHEDULED", payload: { uid: "bk-2", rescheduleUid: "bk-1", attendees: [] } })).toMatchObject({
      kind: "booked",
      bookingRef: "bk-2",
      previousBookingRef: "bk-1",
    });
    expect(infra.parseWebhook({ triggerEvent: "BOOKING_CANCELLED", payload: { uid: "bk-2" } })).toMatchObject({ kind: "canceled", bookingRef: "bk-2", leadId: null });
    expect(infra.parseWebhook({ triggerEvent: "MEETING_ENDED", payload: { uid: "bk-2" } })).toBeNull();
  });

  it("creates the v2 webhook with our secret and returns its id", async () => {
    const ok = fakeFetch([{ status: 201, body: { status: "success", data: { id: 42 } } }]);
    const r = await createCalcomInfra(ok.fn).createWebhook("cal_live_x", { url: "https://app/y", signingSecret: SECRET, ownerRef: "7", scopeRef: null });
    expect(r.webhookRef).toBe("42");
    expect(ok.calls[0]).toMatchObject({
      url: "https://api.cal.com/v2/webhooks",
      method: "POST",
      body: { subscriberUrl: "https://app/y", triggers: ["BOOKING_CREATED", "BOOKING_CANCELLED", "BOOKING_RESCHEDULED"], active: true, secret: SECRET },
    });
  });

  it("checks a credential via /v2/me", async () => {
    const ok = fakeFetch([{ status: 200, body: { status: "success", data: { id: 7, email: "me@acme.com" } } }]);
    expect(await createCalcomInfra(ok.fn).verifyCredential("cal_live_x")).toEqual({ ok: true, ownerRef: "7", scopeRef: null, label: "me@acme.com" });
    expect(ok.calls[0]!.url).toBe("https://api.cal.com/v2/me");
  });
});

describe("getMeetingsInfra", () => {
  it("returns the adapter for each supported provider", () => {
    expect(getMeetingsInfra("calendly").provider).toBe("calendly");
    expect(getMeetingsInfra("calcom").provider).toBe("calcom");
  });
});
