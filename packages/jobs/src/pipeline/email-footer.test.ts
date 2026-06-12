import { describe, expect, it } from "vitest";
import { appendComplianceFooter, formatSenderAddress, parseSenderAddress } from "./email-footer";

const address = { line1: "100 Main St", line2: "Suite 4", city: "Austin", region: "TX", postal: "78701", country: "USA" };

describe("compliance footer (rule 11: unsubscribe + physical address)", () => {
  it("formats the address on one line, skipping empty parts", () => {
    expect(formatSenderAddress(address)).toBe("100 Main St, Suite 4, Austin, TX 78701, USA");
    expect(formatSenderAddress({ ...address, line2: null, region: null })).toBe("100 Main St, Austin 78701, USA");
  });
  it("appends address and unsubscribe link after the body", () => {
    const out = appendComplianceFooter("Hi Jane,\n\nshort pitch", "https://app.example.com/api/unsubscribe/tok1", address);
    expect(out).toContain("short pitch");
    expect(out).toMatch(/100 Main St.*Austin/);
    expect(out).toContain("https://app.example.com/api/unsubscribe/tok1");
    expect(out.indexOf("short pitch")).toBeLessThan(out.indexOf("unsubscribe/tok1"));
  });
  it("round-trips a full address through parse → format", () => {
    const parsed = parseSenderAddress({ ...address });
    expect(parsed).not.toBeNull();
    expect(formatSenderAddress(parsed!)).toBe("100 Main St, Suite 4, Austin, TX 78701, USA");
  });
  it("parseSenderAddress rejects rows missing required fields", () => {
    expect(parseSenderAddress({ line1: "x", city: "y", postal: "1", country: "US" })).not.toBeNull();
    expect(parseSenderAddress({ city: "y" })).toBeNull();
    expect(parseSenderAddress(null)).toBeNull();
  });
});
