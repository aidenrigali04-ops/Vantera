import { describe, expect, it } from "vitest";
import { normalizeSuppressionValue, parseSuppressionInput } from "./suppression";

describe("normalizeSuppressionValue", () => {
  it("lowercases and trims emails (DB check: value = lower(value))", () => {
    expect(normalizeSuppressionValue("email", "  Jane.Doe@ACME.com ")).toBe("jane.doe@acme.com");
  });

  it("lowercases linkedin URLs and strips trailing slashes (matches pipeline normalizeLinkedInUrl)", () => {
    expect(normalizeSuppressionValue("linkedin", "https://LinkedIn.com/in/Jane-Doe//")).toBe(
      "https://linkedin.com/in/jane-doe"
    );
  });
});

describe("parseSuppressionInput", () => {
  it("accepts a valid email", () => {
    const r = parseSuppressionInput("email", "jane@acme.com", "bounced before");
    expect(r).toEqual({
      ok: true,
      values: { kind: "email", value: "jane@acme.com", note: "bounced before" },
    });
  });

  it("rejects malformed emails", () => {
    expect(parseSuppressionInput("email", "not-an-email", null).ok).toBe(false);
  });

  it("requires linkedin values to be linkedin.com URLs", () => {
    expect(parseSuppressionInput("linkedin", "https://x.com/jane", null).ok).toBe(false);
    expect(parseSuppressionInput("linkedin", "https://www.linkedin.com/in/jane", null).ok).toBe(true);
  });

  it("rejects unknown kinds and empty values", () => {
    expect(parseSuppressionInput("sms", "x", null).ok).toBe(false);
    expect(parseSuppressionInput("email", "   ", null).ok).toBe(false);
  });

  it("caps notes at 500 chars", () => {
    expect(parseSuppressionInput("email", "a@b.co", "x".repeat(501)).ok).toBe(false);
  });
});
