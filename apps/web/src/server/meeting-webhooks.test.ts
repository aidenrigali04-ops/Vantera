import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { handleMeetingWebhook, type MeetingWebhookDeps } from "./meeting-webhooks";

const SECRET = "conn-secret";
const LEAD = "3f6c2a9e-1b2d-4c3e-9f00-1234567890ab";
const body = JSON.stringify({
  triggerEvent: "BOOKING_CREATED",
  payload: { uid: "bk-1", startTime: "2026-10-30T15:00:00Z", attendees: [{ email: "dana@acme.com", name: "Dana" }], metadata: { vt: `vt-${LEAD}` } },
});
const sig = createHmac("sha256", SECRET).update(body).digest("hex");

function deps(over: Partial<MeetingWebhookDeps> = {}) {
  const recorded: { source: string; id: string; payload: unknown }[] = [];
  const enqueued: unknown[] = [];
  const unverified: string[] = [];
  const d: MeetingWebhookDeps = {
    loadConnection: async (id) => (id === "c1" ? { id: "c1", provider: "calcom", signingSecret: SECRET } : null),
    recordEvent: async (source, id, payload) => {
      if (recorded.some((r) => r.id === id)) return false;
      recorded.push({ source, id, payload });
      return true;
    },
    enqueue: async (p) => void enqueued.push(p),
    onUnverified: async (provider) => void unverified.push(provider),
    ...over,
  };
  return { d, recorded, enqueued, unverified };
}

describe("handleMeetingWebhook", () => {
  it("verifies, dedupes, and enqueues the normalized booking — storing no invitee PII in the log", async () => {
    const { d, recorded, enqueued } = deps();
    const r = await handleMeetingWebhook("calcom", "c1", { "x-cal-signature-256": sig }, body, d);
    expect(r).toEqual({ status: 200, body: "ok" });
    expect(recorded).toEqual([{ source: "calcom", id: "c1:bk-1:BOOKING_CREATED", payload: { kind: "booked", bookingRef: "bk-1" } }]);
    expect(enqueued).toEqual([
      { connectionId: "c1", event: expect.objectContaining({ kind: "booked", bookingRef: "bk-1", leadId: LEAD, inviteeEmail: "dana@acme.com" }) },
    ]);
  });

  it("treats a redelivery as a duplicate (no second enqueue)", async () => {
    const { d, enqueued } = deps();
    await handleMeetingWebhook("calcom", "c1", { "x-cal-signature-256": sig }, body, d);
    expect(await handleMeetingWebhook("calcom", "c1", { "x-cal-signature-256": sig }, body, d)).toEqual({ status: 200, body: "duplicate" });
    expect(enqueued).toHaveLength(1);
  });

  it("rejects a bad signature and records a security event", async () => {
    const { d, enqueued, unverified } = deps();
    expect(await handleMeetingWebhook("calcom", "c1", { "x-cal-signature-256": "00" }, body, d)).toEqual({ status: 401, body: "invalid signature" });
    expect(enqueued).toHaveLength(0);
    expect(unverified).toEqual(["calcom"]);
  });

  it("404s an unknown connection or a provider that doesn't match it, without saying which", async () => {
    const { d } = deps();
    expect((await handleMeetingWebhook("calcom", "nope", {}, body, d)).status).toBe(404);
    expect((await handleMeetingWebhook("calendly", "c1", {}, body, d)).status).toBe(404);
    expect((await handleMeetingWebhook("zoom", "c1", {}, body, d)).status).toBe(404);
  });

  it("acknowledges events it doesn't act on", async () => {
    const other = JSON.stringify({ triggerEvent: "MEETING_ENDED", payload: { uid: "bk-1" } });
    const { d, enqueued } = deps();
    const r = await handleMeetingWebhook("calcom", "c1", { "x-cal-signature-256": createHmac("sha256", SECRET).update(other).digest("hex") }, other, d);
    expect(r).toEqual({ status: 200, body: "ignored" });
    expect(enqueued).toHaveLength(0);
  });
});
