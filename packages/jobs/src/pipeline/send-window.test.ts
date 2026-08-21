import { describe, expect, it } from "vitest";
import { isWithinSendWindow, timezoneForLocation } from "./send-window";

describe("timezoneForLocation", () => {
  it("maps the markets the accounts sell into", () => {
    expect(timezoneForLocation("Doha, Qatar")).toBe("Asia/Qatar");
    expect(timezoneForLocation("Riyadh, Saudi Arabia")).toBe("Asia/Riyadh");
    expect(timezoneForLocation("Austin, Texas, United States")).toBe("America/Chicago");
    expect(timezoneForLocation("London, England, United Kingdom")).toBe("Europe/London");
  });

  it("returns null for unknown or missing locations", () => {
    expect(timezoneForLocation("Remote")).toBeNull();
    expect(timezoneForLocation(null)).toBeNull();
  });
});

describe("isWithinSendWindow", () => {
  // 2026-07-04 was a Saturday; 2026-07-07 a Tuesday.
  it("blocks weekends everywhere — the burst that hit prospects on a Saturday night can't recur", () => {
    expect(isWithinSendWindow(new Date("2026-07-04T21:00:00Z"), null)).toBe(false);
    expect(isWithinSendWindow(new Date("2026-07-04T10:00:00Z"), "Doha, Qatar")).toBe(false);
  });

  it("allows weekday business hours in the prospect's local time", () => {
    // Tue 10:00 UTC = Tue 13:00 in Doha (UTC+3) — inside 8-17
    expect(isWithinSendWindow(new Date("2026-07-07T10:00:00Z"), "Doha, Qatar")).toBe(true);
    // Tue 14:00 UTC = Tue 09:00 in Chicago — inside
    expect(isWithinSendWindow(new Date("2026-07-07T14:00:00Z"), "Austin, Texas")).toBe(true);
  });

  it("blocks a prospect's local night even when it's daytime UTC", () => {
    // Tue 15:00 UTC = Tue 08:00 in Los Angeles — inside; Tue 04:00 UTC = Mon 21:00 LA — outside
    expect(isWithinSendWindow(new Date("2026-07-07T04:00:00Z"), "San Francisco, California")).toBe(false);
    // Tue 16:00 UTC = Tue 19:00 Doha — outside (after 17:00)
    expect(isWithinSendWindow(new Date("2026-07-07T16:00:00Z"), "Doha, Qatar")).toBe(false);
  });

  it("unknown location falls back to a UTC business-hours band", () => {
    expect(isWithinSendWindow(new Date("2026-07-07T10:00:00Z"), "Remote")).toBe(true);
    expect(isWithinSendWindow(new Date("2026-07-07T22:00:00Z"), "Remote")).toBe(false);
  });
});
