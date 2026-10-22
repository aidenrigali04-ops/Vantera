import type { MeetingEvent } from "@vantera/meetings-infra";
import type { MeetingEventStore } from "./types";

export type MeetingEventPayload = { connectionId: string; event: MeetingEvent };

export type MeetingEventResult =
  | { status: "booked"; leadId: string; attribution: "link" | "email" }
  | { status: "canceled"; leadId: string }
  | { status: "unmatched" | "ignored" | "no_connection" };

/**
 * ML-6: apply one verified scheduling-tool delivery. A booking made through the seller's link is
 * the most trustworthy meeting signal there is: attribute it (our per-lead tag first — re-checked
 * against the connection's account, so a tampered tag can never touch another workspace — then the
 * invitee email within the account), record it, mark the lead's meeting as calendar-confirmed, and
 * stand outreach down. A booking we can't attribute stores nothing (no prospect data without a
 * lead). A cancel clears the meeting only when no other booking for that lead is still live
 * (a reschedule arrives as cancel + new booking).
 */
export async function runMeetingEvent(
  { connectionId, event }: MeetingEventPayload,
  deps: { store: MeetingEventStore }
): Promise<MeetingEventResult> {
  const { store } = deps;
  // Every lookup and write below is scoped to the CONNECTION's account: booking ids are vendor ids,
  // and two workspaces can share a calendar — isolation must never rest on vendor-id uniqueness.
  const connection = await store.getMeetingConnection(connectionId);
  if (!connection) return { status: "no_connection" };
  await store.touchMeetingConnection(connectionId);

  if (event.kind === "canceled") {
    const prior = await store.findMeetingEvent(connection.accountId, connection.provider, event.bookingRef);
    if (!prior) return { status: "ignored" };
    await store.upsertMeetingEvent({
      accountId: connection.accountId,
      connectionId,
      provider: connection.provider,
      leadId: prior.leadId,
      bookingRef: event.bookingRef,
      status: "canceled",
      startAt: event.startAt,
      attribution: null,
    });
    if (!(await store.hasLiveBooking(connection.accountId, prior.leadId))) await store.clearCalendarMeeting(connection.accountId, prior.leadId);
    return { status: "canceled", leadId: prior.leadId };
  }

  let leadId: string | null = null;
  let attribution: "link" | "email" = "link";
  const previous = event.previousBookingRef
    ? await store.findMeetingEvent(connection.accountId, connection.provider, event.previousBookingRef)
    : null;
  if (event.leadId && (await store.leadInAccount(connection.accountId, event.leadId))) {
    leadId = event.leadId;
  } else if (previous) {
    leadId = previous.leadId; // a reschedule keeps the original booking's lead
  } else if (event.inviteeEmail) {
    leadId = await store.findLeadByEmail(connection.accountId, event.inviteeEmail);
    attribution = "email";
  }
  if (!leadId) return { status: "unmatched" };

  // Cal.com reports a reschedule as one event (no separate cancel) — retire the old booking
  if (previous && event.previousBookingRef) {
    await store.upsertMeetingEvent({
      accountId: connection.accountId,
      connectionId,
      provider: connection.provider,
      leadId: previous.leadId,
      bookingRef: event.previousBookingRef,
      status: "canceled",
      startAt: null,
      attribution: null,
    });
  }

  await store.upsertMeetingEvent({
    accountId: connection.accountId,
    connectionId,
    provider: connection.provider,
    leadId,
    bookingRef: event.bookingRef,
    status: "booked",
    startAt: event.startAt,
    attribution,
  });
  await store.markCalendarMeeting(connection.accountId, leadId, event.startAt);
  await store.standDownOutreach(connection.accountId, leadId);
  await store.notifyMeetingBooked(connection.accountId, leadId);
  return { status: "booked", leadId, attribution };
}
