import { describe, expect, it } from "vitest";
import { inputs } from "./state.test";
import { primaryFor, senderFixture, tilesFor, type TileExtras } from "./tiles";

const extras = (over: Partial<TileExtras> = {}): TileExtras => ({
  topScore: 91,
  topDraftLocation: "Austin, Texas, United States",
  topDraftSender: "Anna K.",
  needsHuman: null,
  meetingToday: null,
  playbookSuggestion: null,
  styleSuggestion: null,
  crmHandoff: null,
  calendarLink: null,
  dismissedAsks: {},
  ...over,
});

describe("tilesFor — the Z4 priority engine", () => {
  it("steady: Drafts then Replies, with the blueprint's meta lines", () => {
    const t = tilesFor(inputs(), extras());
    expect(t.map((x) => x.kind)).toEqual(["drafts", "replies"]);
    expect(t[0]!.title).toBe("Approve 14 drafts");
    expect(t[0]!.meta).toMatch(/^top score ‹91› · first sends ‹.+› via Anna K\.$/);
    expect(t[1]!.title).toBe("3 replies waiting");
    expect(t[1]!.meta).toBe("‹2› interested · oldest ‹5h›");
  });
  it("singular titles", () => {
    const t = tilesFor(inputs({ drafts: 1, repliesWaiting: 1 }), extras());
    expect(t[0]!.title).toBe("Approve 1 draft");
    expect(t[1]!.title).toBe("1 reply waiting");
  });
  it("P0 repair outranks the work; one tile per down sender", () => {
    const t = tilesFor(
      inputs({
        draftsHeld: 6,
        senders: [senderFixture(), senderFixture({ id: "s2", name: "Jonas M.", status: "disconnected", statusChangedAt: "2026-08-21T13:42:00Z" })],
      }),
      extras()
    );
    expect(t[0]).toMatchObject({ kind: "sender_disconnected", tone: "attention", title: "Reconnect Jonas M.", href: "/settings/senders#s2" });
    expect(t[0]!.meta).toBe("dropped ‹6:42am› · ‹6› drafts held");
    expect(t.map((x) => x.kind)).toEqual(["sender_disconnected", "drafts", "replies"]);
  });
  it("payment failed is P0 billing with the 7-day pause date", () => {
    const t = tilesFor(inputs({ billing: { status: "past_due", plan: "growth", pastDueSince: "2026-08-19T12:00:00Z", canceledAt: null } }), extras());
    expect(t[0]).toMatchObject({ kind: "payment_failed", tone: "billing", title: "Update payment" });
    expect(t[0]!.meta).toBe("failed ‹Aug 19› · sending pauses ‹Aug 26›");
  });
  it("P2 tiles show when they exist; never more than four", () => {
    const t = tilesFor(
      inputs({ pausedAt: "2026-08-18T23:12:00Z" }),
      extras({
        needsHuman: { leadId: "l1", name: "Arjun Mehta", company: "Coastline Partners" },
        meetingToday: { leadId: "l2", name: "Maya Chen", company: "Northwind", at: "2026-08-21T17:30:00Z", bookedAt: "2026-08-20T17:00:00Z" },
      })
    );
    expect(t.length).toBe(4);
    expect(t.map((x) => x.kind)).toEqual(["drafts", "replies", "needs_human", "meeting_today"]);
    expect(t[2]!.meta).toBe("the agent reached its conversation limit · Coastline Partners");
    expect(t[3]!.title).toBe("Meeting with Maya Chen at ‹10:30am›");
  });
  it("the resume tile is an inline action", () => {
    const t = tilesFor(inputs({ drafts: 0, repliesWaiting: 0, pausedAt: "2026-08-18T23:12:00Z" }), extras());
    expect(t[0]).toMatchObject({ kind: "engine_paused", inline: "resume", title: "Resume the engine" });
    expect(t[0]!.meta).toBe("paused by you ‹4:12pm› · approvals still open");
  });
  it("asks only fill a free slot in the first row, and honor dismissals", () => {
    const full = tilesFor(inputs(), extras({ needsHuman: { leadId: "l1", name: "A", company: null }, playbookSuggestion: { id: "p1", meta: "x" } }));
    expect(full.map((x) => x.kind)).not.toContain("playbook_suggestion");
    const free = tilesFor(inputs({ repliesWaiting: 0 }), extras({ playbookSuggestion: { id: "p1", meta: "x" }, crmHandoff: { leadName: "Maya" } }));
    expect(free.map((x) => x.kind)).toEqual(["drafts", "playbook_suggestion", "crm_handoff"]);
    expect(free[1]!.dismissible).toBe(true);
    const dismissed = tilesFor(inputs({ repliesWaiting: 0 }), extras({ playbookSuggestion: { id: "p1", meta: "x" }, dismissedAsks: { playbook_suggestion: "2026-08-21T10:00:00Z" } }));
    expect(dismissed.map((x) => x.kind)).toEqual(["drafts"]);
    const stale = tilesFor(inputs({ repliesWaiting: 0 }), extras({ playbookSuggestion: { id: "p1", meta: "x" }, dismissedAsks: { playbook_suggestion: "2026-08-19T10:00:00Z" } }));
    expect(stale.map((x) => x.kind)).toEqual(["drafts", "playbook_suggestion"]);
  });
  it("empty when nothing needs the user", () => {
    expect(tilesFor(inputs({ drafts: 0, repliesWaiting: 0 }), extras())).toEqual([]);
  });
});

describe("primaryFor", () => {
  it("mirrors the top tile with a mono count, and hides when empty", () => {
    expect(primaryFor(tilesFor(inputs(), extras()))).toEqual({ label: "Open queue", count: 14, href: "/approvals" });
    expect(primaryFor(tilesFor(inputs({ drafts: 0 }), extras()))).toEqual({ label: "Open inbox", count: 3, href: "/inbox?filter=waiting" });
    expect(primaryFor([])).toBeNull();
    const repair = primaryFor(tilesFor(inputs({ senders: [senderFixture({ status: "disconnected" })] }), extras()));
    expect(repair).toMatchObject({ label: "Reconnect Anna K.", count: null });
  });
});
