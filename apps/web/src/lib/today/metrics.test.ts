import { describe, expect, it } from "vitest";
import { engineLineFor } from "./engine-line";
import {
  capFraction,
  capUsage,
  fmtActivityTime,
  fmtCount,
  fmtDayTime,
  fmtRelative,
  fmtSendSlot,
  fmtTime,
  fmtWindow,
  initials,
  nextSendWindow,
  replyRate,
  shortName,
} from "./metrics";
import { inputs, NOW } from "./state.test";
import { senderFixture } from "./tiles";

const PT = "America/Los_Angeles";

describe("caps come from the sending layer (D8)", () => {
  it("steady sender: 20 invites + 25 messages a day, 100 invites a week", () => {
    const c = capUsage(senderFixture({ ageDays: 40, invitesToday: 14, messagesToday: 9, invitesThisWeek: 61 }));
    expect(c).toMatchObject({ invitesAllowed: 20, messagesAllowed: 25, allowedToday: 45, sentToday: 23, weeklyCeiling: 100, warmup: false, warmupDay: null });
    expect(capFraction(senderFixture({ ageDays: 40, invitesToday: 14, messagesToday: 9 }))).toBe("23/45");
  });
  it("warmup ramp 5 → 10 → 15 by connection age, day counter 1-based", () => {
    expect(capUsage(senderFixture({ ageDays: 2 }))).toMatchObject({ invitesAllowed: 5, warmupDay: 3, warmup: true });
    expect(capUsage(senderFixture({ ageDays: 8 }))).toMatchObject({ invitesAllowed: 10, warmupDay: 9, allowedToday: 35 });
    expect(capUsage(senderFixture({ ageDays: 20 }))).toMatchObject({ invitesAllowed: 15, warmupDay: 21 });
    expect(capUsage(senderFixture({ ageDays: 28 }))).toMatchObject({ invitesAllowed: 20, warmup: false });
  });
});

describe("replyRate", () => {
  it("is null under 20 sends, else one decimal", () => {
    expect(replyRate(3, 19)).toBeNull();
    expect(replyRate(19, 212)).toBe(9);
    expect(replyRate(7, 65)).toBe(10.8);
  });
});

describe("formatters (server-side, account timezone)", () => {
  it("times read `2:10pm`, windows `2:10–4:30pm`, dates `Aug 19`, day-times `Thu 10:30am`", () => {
    expect(fmtTime(new Date("2026-08-21T21:10:00Z"), PT)).toBe("2:10pm");
    expect(fmtTime(new Date("2026-08-21T07:00:00Z"), PT)).toBe("12:00am");
    expect(fmtWindow(new Date("2026-08-21T21:10:00Z"), new Date("2026-08-21T23:30:00Z"), PT)).toBe("2:10–4:30pm");
    expect(fmtWindow(new Date("2026-08-21T16:10:00Z"), new Date("2026-08-21T21:30:00Z"), PT)).toBe("9:10am–2:30pm");
    expect(fmtDayTime(new Date("2026-08-27T17:30:00Z"), PT)).toBe("Thu 10:30am");
  });
  it("relative ages are chip-grade", () => {
    expect(fmtRelative(new Date("2026-08-21T10:00:00Z"), NOW)).toBe("5h");
    expect(fmtRelative(new Date("2026-08-19T10:00:00Z"), NOW)).toBe("2d");
    expect(fmtRelative(new Date("2026-08-21T15:00:00Z"), NOW)).toBe("4m");
    expect(fmtRelative(NOW, NOW)).toBe("now");
  });
  it("activity times: today → time, otherwise Yesterday + time", () => {
    expect(fmtActivityTime(new Date("2026-08-21T14:58:00Z"), NOW, PT)).toBe("7:58am");
    expect(fmtActivityTime(new Date("2026-08-20T23:28:00Z"), NOW, PT)).toBe("Yesterday 4:28pm");
  });
  it("counts, names, initials", () => {
    expect(fmtCount(1204)).toBe("1,204");
    expect(shortName("Anna Kowalski")).toBe("Anna K.");
    expect(shortName("Cher")).toBe("Cher");
    expect(shortName(null)).toBe("Your sender");
    expect(initials("Maya Chen")).toBe("MC");
    expect(initials("Cher")).toBe("CH");
  });
});

describe("nextSendWindow — the prospect-local window from the sending layer", () => {
  it("open now for a prospect in Chicago at 10:04am local", () => {
    const slot = nextSendWindow(NOW, "Austin, Texas, United States"); // 10:04am CT
    expect(slot.openNow).toBe(true);
    expect(fmtSendSlot(slot, PT)).toBe("8:04am–3:00pm"); // now → 5pm CT, shown in PT
  });
  it("before the window opens: 'today' at the start hour", () => {
    const early = new Date("2026-08-21T11:30:00Z"); // 4:30am PT / 12:30pm London
    const slot = nextSendWindow(early, "San Francisco, California"); // PT prospect
    expect(slot.openNow).toBe(false);
    expect(fmtSendSlot(slot, PT)).toBe("today 8:00am");
  });
  it("after the window closes: tomorrow", () => {
    const late = new Date("2026-08-21T01:00:00Z"); // 6pm PT Thu
    const slot = nextSendWindow(late, "Los Angeles");
    expect(slot.dayLabel).toBe("tomorrow");
    expect(fmtSendSlot(slot, PT)).toBe("tomorrow 8:00am");
  });
  it("skips the weekend", () => {
    const sat = new Date("2026-08-22T18:00:00Z"); // Saturday
    const slot = nextSendWindow(sat, "London");
    expect(slot.dayLabel).toBe("Mon");
  });
});

describe("engineLineFor", () => {
  it("running: next send, today's usage, the window", () => {
    const line = engineLineFor("steady", inputs(), { nextSendAt: "2026-08-21T21:10:00Z", sentToday: 31, allowedToday: 80 });
    expect(line.dot).toBe("running");
    expect(line.status).toBe("Running");
    expect(line.facts).toEqual(["next send ‹2:10pm› via Anna K.", "today ‹31› of ‹80›", "window Mon–Fri ‹8:00am–5:00pm› prospect time"]);
    expect(line.link).toBeNull();
  });
  it("sender held → attention dot + reconnect link", () => {
    const i = inputs({ draftsHeld: 6, senders: [senderFixture({ id: "s2", name: "Jonas M.", status: "disconnected" }), senderFixture()] });
    const line = engineLineFor("sender_held", i, { nextSendAt: null, sentToday: 0, allowedToday: 45 });
    expect(line).toMatchObject({ dot: "attention", status: "Jonas M. disconnected", link: { label: "Reconnect", href: "/settings/senders#s2" } });
    expect(line.facts).toEqual(["‹6› drafts held", "Anna K. sending normally"]);
  });
  it("warmup-only sender reads the ramp", () => {
    const i = inputs({ senders: [senderFixture({ id: "j", name: "Jonas M.", ageDays: 8 })] });
    const line = engineLineFor("steady", i, { nextSendAt: "2026-08-21T21:10:00Z", sentToday: 3, allowedToday: 35 });
    expect(line.facts).toEqual(["Warmup day ‹9› of ‹28›", "up to ‹10› invites/day", "next send ‹2:10pm›"]);
  });
  it("weekly ceiling reached", () => {
    const i = inputs({ senders: [senderFixture({ invitesThisWeek: 100 })] });
    const line = engineLineFor("steady", i, { nextSendAt: "2026-08-21T21:10:00Z", sentToday: 3, allowedToday: 45 });
    expect(line.facts[0]).toBe("weekly invite ceiling reached (‹100›)");
  });
  it("paused and stopped carry the resume / repair link", () => {
    expect(engineLineFor("paused", inputs({ pausedAt: "2026-08-18T23:12:00Z" }), { nextSendAt: null, sentToday: 0, allowedToday: 0 })).toMatchObject({
      dot: "paused",
      status: "Paused by you ‹4:12pm›",
      link: { label: "Resume", inline: "resume" },
    });
    expect(engineLineFor("stopped_billing", inputs(), { nextSendAt: null, sentToday: 0, allowedToday: 0 })).toMatchObject({ dot: "stopped", link: { href: "/settings/billing" } });
    expect(engineLineFor("stopped_senders", inputs(), { nextSendAt: null, sentToday: 0, allowedToday: 0 })).toMatchObject({ dot: "stopped", link: { href: "/settings/senders" } });
  });
});
