import { describe, expect, it } from "vitest";
import { greetingWord, resolveTodayState } from "./state";
import { senderFixture } from "./tiles";
import type { TodayInputs } from "./types";

export const NOW = new Date("2026-08-21T15:04:00Z"); // 8:04am PT

export function inputs(over: Partial<TodayInputs> = {}): TodayInputs {
  return {
    now: NOW,
    timeZone: "America/Los_Angeles",
    firstSessionDone: true,
    drafts: 14,
    draftsHeld: 0,
    repliesWaiting: 3,
    repliesInterestedWaiting: 2,
    oldestWaitingAt: "2026-08-21T10:00:00Z",
    senders: [senderFixture(), senderFixture({ id: "s2", name: "Jonas M.", ageDays: 8 })],
    pausedAt: null,
    billing: { status: "active", plan: "growth", pastDueSince: null, canceledAt: null },
    engine: {
      scoutLive: true,
      firstRunAt: "2026-08-01T00:00:00Z",
      lastRunAt: "2026-08-21T14:58:00Z",
      nextRunAt: "2026-08-21T22:00:00Z",
      everDrafted: true,
      lastThreeRunsEmpty: false,
    },
    lastVisitAt: "2026-08-20T23:30:00Z",
    ...over,
  };
}

describe("resolveTodayState — every §8 row", () => {
  it("first session: /today is not the home yet", () => {
    expect(resolveTodayState(inputs({ firstSessionDone: false }))).toBe("first_session");
  });
  it("steady: drafts or replies waiting, senders OK", () => {
    expect(resolveTodayState(inputs())).toBe("steady");
    expect(resolveTodayState(inputs({ drafts: 0 }))).toBe("steady");
    expect(resolveTodayState(inputs({ repliesWaiting: 0 }))).toBe("steady");
  });
  it("caught up: nothing waiting, engine healthy", () => {
    expect(resolveTodayState(inputs({ drafts: 0, repliesWaiting: 0 }))).toBe("caught_up");
  });
  it("working-empty: live engine, never drafted, first run under an hour old", () => {
    expect(
      resolveTodayState(
        inputs({
          drafts: 0,
          repliesWaiting: 0,
          engine: { scoutLive: true, firstRunAt: "2026-08-21T14:50:00Z", lastRunAt: null, nextRunAt: null, everDrafted: false, lastThreeRunsEmpty: false },
        })
      )
    ).toBe("working_empty");
  });
  it("working-empty also covers 'scheduled, not yet run'", () => {
    expect(
      resolveTodayState(
        inputs({
          drafts: 0,
          repliesWaiting: 0,
          engine: { scoutLive: true, firstRunAt: null, lastRunAt: null, nextRunAt: "2026-08-21T15:30:00Z", everDrafted: false, lastThreeRunsEmpty: false },
        })
      )
    ).toBe("working_empty");
  });
  it("starved: three empty passes", () => {
    expect(
      resolveTodayState(
        inputs({
          drafts: 0,
          repliesWaiting: 0,
          engine: { scoutLive: true, firstRunAt: "2026-08-18T00:00:00Z", lastRunAt: "2026-08-21T14:00:00Z", nextRunAt: null, everDrafted: true, lastThreeRunsEmpty: true },
        })
      )
    ).toBe("starved");
  });
  it("sender held: one down, one OK — beats steady AND billing", () => {
    expect(
      resolveTodayState(
        inputs({
          senders: [senderFixture(), senderFixture({ id: "s2", name: "Jonas M.", status: "disconnected" })],
          billing: { status: "past_due", plan: "growth", pastDueSince: "2026-08-19T00:00:00Z", canceledAt: null },
        })
      )
    ).toBe("sender_held");
  });
  it("stopped — senders: every sender down", () => {
    expect(resolveTodayState(inputs({ senders: [senderFixture({ status: "disconnected" })] }))).toBe("stopped_senders");
    expect(resolveTodayState(inputs({ senders: [senderFixture({ status: "restricted" })] }))).toBe("stopped_senders");
  });
  it("no senders at all is not 'stopped' — it is whatever the queue says", () => {
    expect(resolveTodayState(inputs({ senders: [] }))).toBe("steady");
  });
  it("paused: the user's pause beats the routine states", () => {
    expect(resolveTodayState(inputs({ pausedAt: "2026-08-19T23:12:00Z" }))).toBe("paused");
  });
  it("stopped — billing: past_due or canceled, when senders are fine", () => {
    expect(resolveTodayState(inputs({ billing: { status: "past_due", plan: "growth", pastDueSince: null, canceledAt: null } }))).toBe("stopped_billing");
    expect(resolveTodayState(inputs({ billing: { status: "canceled", plan: "none", pastDueSince: null, canceledAt: null } }))).toBe("stopped_billing");
  });
  it("a trialing account without a Stripe sub is NOT a billing stop (D9: no trial UI)", () => {
    expect(resolveTodayState(inputs({ billing: { status: "trialing", plan: "growth", pastDueSince: null, canceledAt: null } }))).toBe("steady");
  });
});

describe("greetingWord", () => {
  it("follows the blueprint's hour bands", () => {
    expect(greetingWord(5)).toBe("Morning");
    expect(greetingWord(11)).toBe("Morning");
    expect(greetingWord(12)).toBe("Afternoon");
    expect(greetingWord(16)).toBe("Afternoon");
    expect(greetingWord(17)).toBe("Evening");
    expect(greetingWord(4)).toBe("Evening");
  });
});
