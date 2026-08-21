import { describe, expect, it } from "vitest";
import { buildStatusSentence, sinceFragment } from "./sentence";
import { inputs } from "./state.test";
import { senderFixture } from "./tiles";

describe("buildStatusSentence — the §7 Z2 table", () => {
  it("steady, overnight run, two senders", () => {
    expect(buildStatusSentence("steady", inputs({ lastVisitAt: "2026-08-20T23:30:00Z" }))).toBe(
      "Overnight the engine drafted 14 messages and 3 people replied. Both senders are inside their limits."
    );
  });
  it("steady, daytime revisit uses 'Since {time}' in the account timezone", () => {
    expect(buildStatusSentence("steady", inputs({ lastVisitAt: "2026-08-21T13:30:00Z" }))).toBe(
      "Since 6:30am the engine drafted 14 messages and 3 people replied. Senders are inside their limits."
    );
  });
  it("handles singulars: one draft, one person, one sender", () => {
    const i = inputs({ drafts: 1, repliesWaiting: 1, senders: [senderFixture()] });
    expect(buildStatusSentence("steady", i)).toBe(
      "Overnight the engine drafted 1 message and 1 person replied. Your sender is inside its limits."
    );
  });
  it("three senders", () => {
    const i = inputs({ senders: [senderFixture(), senderFixture({ id: "2" }), senderFixture({ id: "3" })] });
    expect(buildStatusSentence("steady", i)).toMatch(/3 senders are inside their limits\.$/);
  });
  it("drafts only", () => {
    expect(buildStatusSentence("steady", inputs({ repliesWaiting: 0, lastVisitAt: "2026-08-21T13:30:00Z" }))).toBe(
      "14 drafts are ready. No new replies since 6:30am."
    );
    expect(buildStatusSentence("steady", inputs({ drafts: 1, repliesWaiting: 0 }))).toBe("1 draft is ready. No new replies.");
  });
  it("replies only", () => {
    expect(buildStatusSentence("steady", inputs({ drafts: 0, lastVisitAt: "2026-08-21T13:30:00Z" }))).toBe(
      "3 people replied since 6:30am — 2 interested. The queue is clear."
    );
  });
  it("caught up names the next run", () => {
    expect(buildStatusSentence("caught_up", inputs({ drafts: 0, repliesWaiting: 0 }))).toBe(
      "You're caught up. Next drafts are expected around 3:00pm; we'll email you when they land."
    );
  });
  it("working-empty gives an ETA in minutes", () => {
    const i = inputs({ drafts: 0, repliesWaiting: 0, engine: { ...inputs().engine, nextRunAt: "2026-08-21T15:30:00Z", everDrafted: false } });
    expect(buildStatusSentence("working_empty", i)).toBe(
      "The engine is on its first pass. First drafts are expected in about 26 minutes — this page fills itself."
    );
  });
  it("sender down names the held drafts and the other sender", () => {
    const i = inputs({
      drafts: 14,
      draftsHeld: 6,
      senders: [senderFixture({ id: "s2", name: "Jonas M.", status: "disconnected" }), senderFixture()],
    });
    expect(buildStatusSentence("sender_held", i)).toBe(
      "Jonas M. is disconnected, so 6 drafts are held. Everything else is running — 8 drafts are ready on Anna K."
    );
  });
  it("paused / billing / stopped are fixed sentences", () => {
    expect(buildStatusSentence("paused", inputs())).toMatch(/^The engine is paused\./);
    expect(buildStatusSentence("stopped_billing", inputs())).toMatch(/^Sending is stopped until billing/);
    expect(buildStatusSentence("stopped_senders", inputs())).toMatch(/^No sender is connected\./);
    expect(buildStatusSentence("starved", inputs())).toMatch(/three passes/);
  });
  it("never uses the banned words", () => {
    for (const s of ["steady", "caught_up", "working_empty", "starved", "sender_held", "stopped_senders", "paused", "stopped_billing"] as const) {
      const text = buildStatusSentence(s, inputs({ draftsHeld: 1, senders: [senderFixture({ status: "disconnected" })] }));
      expect(text).not.toMatch(/welcome|great job|leverage|ai-powered|seamless|autopilot|campaign|\blead\b|seat|trial|🎉/i);
    }
  });
});

describe("sinceFragment", () => {
  it("is 'Overnight' when the last visit is unknown or > 10h ago", () => {
    expect(sinceFragment(inputs({ lastVisitAt: null })).overnight).toBe(true);
    expect(sinceFragment(inputs({ lastVisitAt: "2026-08-21T04:00:00Z" })).overnight).toBe(true);
    expect(sinceFragment(inputs({ lastVisitAt: "2026-08-21T13:30:00Z" }))).toEqual({ overnight: false, label: "Since 6:30am" });
  });
});
