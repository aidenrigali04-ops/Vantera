import { describe, expect, it } from "vitest";
import { parseCopyForm, parseIntentForm, parseScoutForm } from "./validation";

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
  for (const [k, v] of Object.entries(overrides)) fd.set(k, v);
  return fd;
}

describe("parseCopyForm", () => {
  it("accepts a complete form — LinkedIn is the only channel, always enabled", () => {
    expect(parseCopyForm(copyForm())).toEqual({
      ok: true,
      values: {
        name: "Penn",
        cta: "book a 15-min intro",
        links: ["https://acme.com/case-study"],
        channels: { linkedin: true },
        sendMode: "review",
      },
    });
  });

  it("defaults sendMode to review and accepts automatic", () => {
    expect(parseCopyForm(copyForm())).toMatchObject({ values: { sendMode: "review" } });
    expect(parseCopyForm(copyForm({ sendMode: "automatic" }))).toMatchObject({
      values: { sendMode: "automatic" },
    });
  });

  it("rejects an unknown sendMode (manual deferred, rule 08)", () => {
    expect(parseCopyForm(copyForm({ sendMode: "manual" })).ok).toBe(false);
    expect(parseCopyForm(copyForm({ sendMode: "blast" })).ok).toBe(false);
  });

  it("rejects non-http links and short CTAs", () => {
    expect(parseCopyForm(copyForm({ links: "ftp://nope" })).ok).toBe(false);
    expect(parseCopyForm(copyForm({ cta: "go" })).ok).toBe(false);
  });
});

function intentForm(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set("name", "Sonar");
  fd.set("creators", JSON.stringify(["https://www.linkedin.com/in/creator"]));
  fd.set("competitors", "[]");
  fd.set("keywords", JSON.stringify(["onboarding churn"]));
  fd.set("hashtags", JSON.stringify(["revops"]));
  fd.set("signalEngagement", "on");
  fd.set("signalContent", "on");
  fd.set("runAtTime", "09:00");
  fd.set("cadence", "weekly");
  fd.set("timezone", "America/New_York");
  for (const [k, v] of Object.entries(overrides)) fd.set(k, v);
  return fd;
}

describe("parseIntentForm", () => {
  it("parses watch-list, signals, and schedule; normalizes hashtags", () => {
    const r = parseIntentForm(intentForm());
    expect(r).toMatchObject({
      ok: true,
      values: {
        name: "Sonar",
        watch: { creators: ["https://www.linkedin.com/in/creator"], competitors: [], keywords: ["onboarding churn"], hashtags: ["#revops"] },
        signals: { engagement: true, content: true },
        cadence: "weekly",
      },
    });
  });

  it("requires at least one watch target and one signal", () => {
    expect(parseIntentForm(intentForm({ creators: "[]", competitors: "[]", keywords: "[]", hashtags: "[]" })).ok).toBe(false);
    const noSignal = intentForm();
    noSignal.delete("signalEngagement");
    noSignal.delete("signalContent");
    expect(parseIntentForm(noSignal).ok).toBe(false);
  });

  it("rejects non-LinkedIn creator/competitor URLs", () => {
    expect(parseIntentForm(intentForm({ creators: JSON.stringify(["https://twitter.com/x"]) })).ok).toBe(false);
  });
});
