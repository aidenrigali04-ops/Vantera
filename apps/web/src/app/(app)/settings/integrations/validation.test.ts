import { describe, expect, it } from "vitest";
import { validateProvider, validateConnectionConfig, nextActivityConfig } from "./validation";

describe("nextActivityConfig", () => {
  const NOW = new Date("2026-07-04T12:00:00.000Z");
  const on = { enabled: true, outreach: true, replies: true, meetings: true };

  it("stamps the watermark at now on a fresh enable — history is never back-dumped", () => {
    const next = nextActivityConfig(undefined, on, NOW);
    expect(next.enabled).toBe(true);
    expect(next.watermark).toBe(NOW.toISOString());
  });

  it("keeps the existing watermark while staying enabled", () => {
    const prev = { enabled: true, watermark: "2026-07-01T00:00:00.000Z" };
    expect(nextActivityConfig(prev, on, NOW).watermark).toBe("2026-07-01T00:00:00.000Z");
  });

  it("drops the watermark on disable so a re-enable starts fresh (the gap is never back-filled)", () => {
    const prev = { enabled: true, watermark: "2026-07-01T00:00:00.000Z" };
    const off = nextActivityConfig(prev, { ...on, enabled: false }, NOW);
    expect(off.enabled).toBe(false);
    expect(off.watermark).toBeUndefined();
    const reOn = nextActivityConfig(off, on, NOW);
    expect(reOn.watermark).toBe(NOW.toISOString());
  });

  it("carries the per-event toggles through", () => {
    const next = nextActivityConfig(undefined, { enabled: true, outreach: false, replies: true, meetings: true }, NOW);
    expect(next.events).toEqual({ outreach: false, replies: true, meetings: true });
  });
});

describe("validateProvider", () => {
  it("accepts a registry provider", () => {
    expect(validateProvider("hubspot")).toEqual({ ok: true, values: "hubspot" });
  });
  it("rejects an unknown provider", () => {
    expect(validateProvider("pipedrive").ok).toBe(false);
    expect(validateProvider("").ok).toBe(false);
  });
});

describe("validateConnectionConfig", () => {
  it("requires required targets (HubSpot pipeline + stage)", () => {
    const res = validateConnectionConfig("hubspot", { target: { pipelineId: "p1" } });
    expect(res.ok).toBe(false);
  });

  it("accepts a fully specified CRM config and coerces autoPush", () => {
    const res = validateConnectionConfig("hubspot", {
      autoPush: "true",
      target: { pipelineId: "p1", stageId: "s1" },
      mapping: { "contact.firstName": "fname" },
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.values.autoPush).toBe(true);
      expect(res.values.target).toEqual({ pipelineId: "p1", stageId: "s1" });
      expect(res.values.mapping["contact.firstName"]).toBe("fname");
    }
  });

  it("ignores client overrides of locked fields (email stays the dedupe default)", () => {
    const res = validateConnectionConfig("hubspot", {
      target: { pipelineId: "p1", stageId: "s1" },
      mapping: { "contact.email": "hacked_field" },
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.values.mapping["contact.email"]).toBe("email");
  });

  it("drops unknown mapping keys", () => {
    const res = validateConnectionConfig("hubspot", {
      target: { pipelineId: "p1", stageId: "s1" },
      mapping: { "contact.notreal": "x" },
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.values.mapping["contact.notreal"]).toBeUndefined();
  });

  it("validates a notify destination (Slack channel required)", () => {
    expect(validateConnectionConfig("slack", { target: {} }).ok).toBe(false);
    const ok = validateConnectionConfig("slack", { target: { channelId: "C123" } });
    expect(ok.ok).toBe(true);
  });
});
