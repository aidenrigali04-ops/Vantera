import { describe, expect, it } from "vitest";
import { parseCopyForm, parseScoutForm } from "./validation";

function scoutForm(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set("name", "Scout");
  fd.set("icps", JSON.stringify(["VP Sales at SaaS"]));
  fd.set("runAtTime", "08:00");
  fd.set("cadence", "daily");
  fd.set("timezone", "America/New_York");
  for (const [k, v] of Object.entries(overrides)) fd.set(k, v);
  return fd;
}

describe("parseScoutForm", () => {
  it("accepts a complete form", () => {
    const result = parseScoutForm(scoutForm());
    expect(result).toEqual({
      ok: true,
      values: {
        name: "Scout",
        icps: ["VP Sales at SaaS"],
        runAtTime: "08:00",
        cadence: "daily",
        timezone: "America/New_York",
      },
    });
  });

  it("rejects more than 3 ICPs (rule 08)", () => {
    const result = parseScoutForm(scoutForm({ icps: JSON.stringify(["a", "b", "c", "d"]) }));
    expect(result.ok).toBe(false);
  });

  it("dedupes ICPs before counting", () => {
    const result = parseScoutForm(scoutForm({ icps: JSON.stringify(["a", "a", "b", "b"]) }));
    expect(result).toMatchObject({ ok: true, values: { icps: ["a", "b"] } });
  });

  it("rejects zero ICPs, bad times, bad cadence, missing name", () => {
    expect(parseScoutForm(scoutForm({ icps: "[]" })).ok).toBe(false);
    expect(parseScoutForm(scoutForm({ runAtTime: "25:00" })).ok).toBe(false);
    expect(parseScoutForm(scoutForm({ cadence: "hourly" })).ok).toBe(false);
    expect(parseScoutForm(scoutForm({ name: "  " })).ok).toBe(false);
  });

  it("defaults a missing timezone to UTC", () => {
    expect(parseScoutForm(scoutForm({ timezone: "" }))).toMatchObject({
      ok: true,
      values: { timezone: "UTC" },
    });
  });
});

function copyForm(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set("name", "Penn");
  fd.set("cta", "book a 15-min intro");
  fd.set("links", "https://acme.com/case-study");
  fd.set("channelEmail", "on");
  for (const [k, v] of Object.entries(overrides)) fd.set(k, v);
  return fd;
}

describe("parseCopyForm", () => {
  it("accepts a complete form", () => {
    expect(parseCopyForm(copyForm())).toEqual({
      ok: true,
      values: {
        name: "Penn",
        cta: "book a 15-min intro",
        links: ["https://acme.com/case-study"],
        channels: { linkedin: false, email: true },
      },
    });
  });

  it("requires at least one channel", () => {
    const fd = copyForm();
    fd.delete("channelEmail");
    expect(parseCopyForm(fd).ok).toBe(false);
  });

  it("rejects non-http links and short CTAs", () => {
    expect(parseCopyForm(copyForm({ links: "ftp://nope" })).ok).toBe(false);
    expect(parseCopyForm(copyForm({ cta: "go" })).ok).toBe(false);
  });
});
