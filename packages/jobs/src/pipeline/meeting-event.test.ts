import { describe, expect, it } from "vitest";
import type { MeetingEvent } from "@vantera/meetings-infra";
import { runMeetingEvent } from "./meeting-event";
import type { MeetingEventStore, MeetingConnectionRow } from "./types";

const A = "aaaaaaaa-0000-0000-0000-000000000000";
const LEAD = "11111111-0000-0000-0000-00000000000a";
const OTHER_ACCOUNT_LEAD = "22222222-0000-0000-0000-00000000000b";

class FakeStore implements MeetingEventStore {
  connection: MeetingConnectionRow | null = { id: "c1", accountId: A, provider: "calendly", status: "active" };
  leadsByAccount = new Map<string, string>([[LEAD, A], [OTHER_ACCOUNT_LEAD, "bbbbbbbb-0000-0000-0000-000000000000"]]);
  emails = new Map<string, string>([["dana@acme.com", LEAD]]);
  events = new Map<string, { accountId: string; leadId: string; status: "booked" | "canceled" }>();
  meetings = new Map<string, { at: Date | null; source: string }>();
  stoodDown: string[] = [];
  notified: string[] = [];
  touched = 0;

  async getMeetingConnection() { return this.connection; }
  async leadInAccount(accountId: string, leadId: string) { return this.leadsByAccount.get(leadId) === accountId; }
  async findLeadByEmail(accountId: string, email: string) {
    const id = this.emails.get(email.toLowerCase());
    return id && this.leadsByAccount.get(id) === accountId ? id : null;
  }
  async upsertMeetingEvent(e: { accountId: string; leadId: string; bookingRef: string; status: "booked" | "canceled" }) {
    this.events.set(`${e.accountId}|${e.bookingRef}`, { accountId: e.accountId, leadId: e.leadId, status: e.status });
  }
  async findMeetingEvent(accountId: string, _provider: string, bookingRef: string) {
    const e = this.events.get(`${accountId}|${bookingRef}`);
    return e ? { leadId: e.leadId, status: e.status } : null;
  }
  async markCalendarMeeting(_accountId: string, leadId: string, startAt: Date | null) { this.meetings.set(leadId, { at: startAt, source: "calendar" }); }
  async hasLiveBooking(accountId: string, leadId: string) { return [...this.events.values()].some((e) => e.accountId === accountId && e.leadId === leadId && e.status === "booked"); }
  async clearCalendarMeeting(_accountId: string, leadId: string) { if (this.meetings.get(leadId)?.source === "calendar") this.meetings.delete(leadId); }
  async standDownOutreach(_accountId: string, leadId: string) { this.stoodDown.push(leadId); }
  async notifyMeetingBooked(_accountId: string, leadId: string) { this.notified.push(leadId); }
  async touchMeetingConnection() { this.touched++; }
}

const booked = (over: Partial<MeetingEvent> = {}): MeetingEvent => ({
  kind: "booked", bookingRef: "bk1", providerEventId: "bk1:booked", startAt: new Date("2026-10-30T15:00:00Z"),
  inviteeEmail: null, inviteeName: "Dana", leadId: LEAD, previousBookingRef: null, ...over,
});

describe("runMeetingEvent", () => {
  it("attributes a tagged booking to the lead, records the meeting, and stands outreach down", async () => {
    const store = new FakeStore();
    const r = await runMeetingEvent({ connectionId: "c1", event: booked() }, { store });
    expect(r).toEqual({ status: "booked", leadId: LEAD, attribution: "link" });
    expect(store.meetings.get(LEAD)).toEqual({ at: new Date("2026-10-30T15:00:00Z"), source: "calendar" });
    expect(store.stoodDown).toEqual([LEAD]);
    expect(store.notified).toEqual([LEAD]);
    expect(store.touched).toBe(1);
  });

  it("never attributes a tag pointing at another workspace's lead (falls back to email, else unmatched)", async () => {
    const store = new FakeStore();
    const r = await runMeetingEvent({ connectionId: "c1", event: booked({ leadId: OTHER_ACCOUNT_LEAD }) }, { store });
    expect(r).toEqual({ status: "unmatched" });
    expect(store.events.size).toBe(0);
    expect(store.meetings.size).toBe(0);
  });

  it("falls back to the invitee email within the account", async () => {
    const store = new FakeStore();
    const r = await runMeetingEvent({ connectionId: "c1", event: booked({ leadId: null, inviteeEmail: "Dana@Acme.com" }) }, { store });
    expect(r).toEqual({ status: "booked", leadId: LEAD, attribution: "email" });
  });

  it("stores nothing for a booking it can't attribute", async () => {
    const store = new FakeStore();
    const r = await runMeetingEvent({ connectionId: "c1", event: booked({ leadId: null, inviteeEmail: "who@else.com" }) }, { store });
    expect(r).toEqual({ status: "unmatched" });
    expect(store.events.size + store.meetings.size + store.stoodDown.length).toBe(0);
  });

  it("a cancel clears the calendar meeting when no other booking is live", async () => {
    const store = new FakeStore();
    await runMeetingEvent({ connectionId: "c1", event: booked() }, { store });
    const r = await runMeetingEvent({ connectionId: "c1", event: booked({ kind: "canceled", providerEventId: "bk1:canceled" }) }, { store });
    expect(r).toEqual({ status: "canceled", leadId: LEAD });
    expect(store.events.get(`${A}|bk1`)?.status).toBe("canceled");
    expect(store.meetings.has(LEAD)).toBe(false);
  });

  it("a reschedule (cancel old + book new) keeps the meeting", async () => {
    const store = new FakeStore();
    await runMeetingEvent({ connectionId: "c1", event: booked() }, { store });
    await runMeetingEvent({ connectionId: "c1", event: booked({ bookingRef: "bk2", providerEventId: "bk2:booked", startAt: new Date("2026-11-02T15:00:00Z") }) }, { store });
    await runMeetingEvent({ connectionId: "c1", event: booked({ kind: "canceled", providerEventId: "bk1:canceled" }) }, { store });
    expect(store.meetings.get(LEAD)?.at).toEqual(new Date("2026-11-02T15:00:00Z"));
  });

  it("ignores a cancel for a booking it never attributed", async () => {
    const store = new FakeStore();
    const r = await runMeetingEvent({ connectionId: "c1", event: booked({ kind: "canceled", bookingRef: "unknown" }) }, { store });
    expect(r).toEqual({ status: "ignored" });
  });

  it("skips deliveries for a missing connection", async () => {
    const store = new FakeStore();
    store.connection = null;
    expect(await runMeetingEvent({ connectionId: "gone", event: booked() }, { store })).toEqual({ status: "no_connection" });
  });

  it("a reschedule without a tag inherits the earlier booking's lead and retires it", async () => {
    const store = new FakeStore();
    await runMeetingEvent({ connectionId: "c1", event: booked() }, { store });
    const r = await runMeetingEvent(
      { connectionId: "c1", event: booked({ bookingRef: "bk2", providerEventId: "bk2:booked", leadId: null, previousBookingRef: "bk1", startAt: new Date("2026-11-03T15:00:00Z") }) },
      { store }
    );
    expect(r).toMatchObject({ status: "booked", leadId: LEAD });
    expect(store.events.get(`${A}|bk1`)?.status).toBe("canceled");
    expect(store.events.get(`${A}|bk2`)?.status).toBe("booked");
    expect(store.meetings.get(LEAD)?.at).toEqual(new Date("2026-11-03T15:00:00Z"));
  });

  it("never touches another workspace's booking: a cancel through a different account's connection is ignored", async () => {
    const store = new FakeStore();
    await runMeetingEvent({ connectionId: "c1", event: booked() }, { store }); // account A books bk1
    store.connection = { id: "c2", accountId: "bbbbbbbb-0000-0000-0000-000000000000", provider: "calendly", status: "active" };
    const r = await runMeetingEvent({ connectionId: "c2", event: booked({ kind: "canceled", providerEventId: "bk1:canceled" }) }, { store });
    expect(r).toEqual({ status: "ignored" });
    expect(store.events.get(`${A}|bk1`)?.status).toBe("booked");
    expect(store.meetings.has(LEAD)).toBe(true);
  });
});

