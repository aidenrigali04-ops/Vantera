import { describe, expect, it } from "vitest";
import { parseSchedulingForm, schedulingError } from "./scheduling-validation";

const form = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};

describe("parseSchedulingForm", () => {
  it("accepts a supported tool and a plausible key", () => {
    expect(parseSchedulingForm(form({ provider: "calendly", apiKey: "  test-token-0123456789  " }))).toEqual({
      ok: true,
      values: { provider: "calendly", apiKey: "test-token-0123456789" },
    });
  });

  it("rejects unknown tools and empty/oversized keys", () => {
    expect(parseSchedulingForm(form({ provider: "zoom", apiKey: "x".repeat(30) })).ok).toBe(false);
    expect(parseSchedulingForm(form({ provider: "calcom", apiKey: "" })).ok).toBe(false);
    expect(parseSchedulingForm(form({ provider: "calcom", apiKey: "x".repeat(5000) })).ok).toBe(false);
  });
});

describe("schedulingError", () => {
  it("turns adapter failure reasons into plain, actionable messages", () => {
    expect(schedulingError("calendly", "plan")).toMatch(/paid Calendly plan/);
    expect(schedulingError("calendly", "scope")).toMatch(/users:read/);
    expect(schedulingError("calcom", "invalid")).toMatch(/key/);
  });
});
