import { describe, expect, it } from "vitest";
import { parseCopyForm, parseScoutForm, parseCallerForm, validateCallerConfig, clampCallingWindow, BRAND_FIELD_MAX, TCPA_EARLIEST, TCPA_LATEST } from "./validation";

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

function callerForm(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set("name", "Aria");
  fd.set("cta", "book a 15-min intro");
  fd.set("bookingLink", "https://cal.com/x/intro");
  fd.set("voiceId", "voice-natural-en-1");
  fd.set("personaName", "Alex");
  fd.set("language", "en-US");
  fd.set("callingWindowDays", JSON.stringify(["Mon", "Tue"]));
  fd.set("startLocal", "09:00");
  fd.set("endLocal", "17:00");
  fd.set("maxAttempts", "3");
  for (const [k, v] of Object.entries(overrides)) fd.set(k, v);
  return fd;
}

describe("parseCallerForm — brand voice & guardrails", () => {
  it("captures brand voice and guardrails when provided", () => {
    const r = parseCallerForm(callerForm({ brandVoice: "warm, consultative", guardrails: "never name competitors" }));
    expect(r).toMatchObject({ ok: true, values: { brandVoice: "warm, consultative", guardrails: "never name competitors" } });
  });

  it("leaves them undefined when blank (so the brief omits them)", () => {
    const r = parseCallerForm(callerForm());
    expect(r.ok && r.values.brandVoice).toBeUndefined();
    expect(r.ok && r.values.guardrails).toBeUndefined();
  });

  it("caps each field length to keep the call prompt lean", () => {
    const r = parseCallerForm(callerForm({ brandVoice: "x".repeat(BRAND_FIELD_MAX + 50) }));
    expect(r.ok && r.values.brandVoice?.length).toBe(BRAND_FIELD_MAX);
  });
});

describe("validateCallerConfig", () => {
  it("accepts a complete config", () => {
    expect(validateCallerConfig({
      cta: "book a demo", bookingLink: "https://cal.com/x",
      voice: { voiceId: "v1", personaName: "Alex", language: "en-US" },
      recordingConsentMode: "two_party",
      callingWindow: { days: ["mon"], startLocal: "09:00", endLocal: "17:00" }, maxAttempts: 3,
    }).ok).toBe(true);
  });

  it("rejects a non-URL booking link", () => {
    const r = validateCallerConfig({ cta: "x", bookingLink: "not-a-url", voice: { voiceId: "v", personaName: "A", language: "en-US" }, recordingConsentMode: "one_party", callingWindow: { days: ["mon"], startLocal: "09:00", endLocal: "17:00" }, maxAttempts: 1 });
    expect(r.ok).toBe(false);
  });

  it("clamps the calling window into TCPA bounds (08:00-21:00)", () => {
    expect(clampCallingWindow({ days: ["mon"], startLocal: "06:00", endLocal: "23:00" }))
      .toEqual({ days: ["mon"], startLocal: TCPA_EARLIEST, endLocal: TCPA_LATEST });
  });

  it("rejects an empty day list", () => {
    const r = validateCallerConfig({ cta: "x", bookingLink: "https://cal.com/x", voice: { voiceId: "v", personaName: "A", language: "en-US" }, recordingConsentMode: "one_party", callingWindow: { days: [], startLocal: "09:00", endLocal: "17:00" }, maxAttempts: 1 });
    expect(r.ok).toBe(false);
  });
});
