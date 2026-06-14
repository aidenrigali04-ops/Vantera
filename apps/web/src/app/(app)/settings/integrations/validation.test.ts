import { describe, expect, it } from "vitest";
import { validateProvider, validateConnectionConfig } from "./validation";

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
