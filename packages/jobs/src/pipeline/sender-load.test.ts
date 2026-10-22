import { describe, expect, it } from "vitest";
import { aggregateSenderLoad } from "./sender-load";

const now = new Date("2026-10-22T15:00:00Z");
const today = new Date("2026-10-22T09:00:00Z");
const yesterday = new Date("2026-10-21T09:00:00Z");

describe("aggregateSenderLoad", () => {
  it("counts delivered invites/messages per sender for today and the last 7 days", () => {
    const [s] = aggregateSenderLoad(
      [{ id: "li1", connectedAt: new Date("2026-10-01T00:00:00Z") }],
      [
        { liId: "li1", stage: "invite", at: today },
        { liId: "li1", stage: "invite", at: yesterday },
        { liId: "li1", stage: "message", at: today },
        { liId: "other", stage: "invite", at: today },
      ],
      [],
      now
    );
    expect(s).toMatchObject({ sentToday: 1, last7d: 2, sentTodayMessages: 1, ageDays: 21 });
  });

  it("counts sends already handed out (scheduled/sending) against the same budgets", () => {
    // The cap leak: a tick schedules rows hours ahead; until they deliver, the next tick must
    // still see them, or each 5-minute tick hands out the whole daily budget again.
    const [s] = aggregateSenderLoad(
      [{ id: "li1", connectedAt: new Date("2026-10-19T00:00:00Z") }],
      [{ liId: "li1", stage: "invite", at: today }],
      [
        { liId: "li1", stage: "invite", at: new Date("2026-10-22T17:00:00Z") },
        { liId: "li1", stage: "invite", at: new Date("2026-10-22T18:00:00Z") },
        { liId: "li1", stage: "message", at: new Date("2026-10-22T16:00:00Z") },
      ],
      now
    );
    expect(s).toMatchObject({ sentToday: 3, last7d: 3, sentTodayMessages: 1 });
  });

  it("uses the latest of delivered or handed-out times for recency", () => {
    const [s] = aggregateSenderLoad(
      [{ id: "li1", connectedAt: null }],
      [{ liId: "li1", stage: "invite", at: today }],
      [{ liId: "li1", stage: "invite", at: new Date("2026-10-22T18:00:00Z") }],
      now
    );
    expect(s!.lastAssignedAt).toBe(new Date("2026-10-22T18:00:00Z").getTime());
    expect(s!.scheduledUntil).toBe(new Date("2026-10-22T18:00:00Z").getTime());
    expect(s!.ageDays).toBe(0);
  });
});
