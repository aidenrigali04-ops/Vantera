import { describe, expect, it } from "vitest";
import { parseDealValue } from "./deal-value";

describe("parseDealValue", () => {
  it("accepts a plain integer dollar amount", () => {
    expect(parseDealValue("5000")).toEqual({ ok: true, cents: 500_000 });
  });
  it("strips $ and commas", () => {
    expect(parseDealValue(" $12,500 ")).toEqual({ ok: true, cents: 1_250_000 });
  });
  it("rejects empty, zero, decimals and words", () => {
    for (const raw of ["", "  ", "0", "12.5", "abc", "-5"]) {
      expect(parseDealValue(raw)).toEqual({ ok: false, message: "Enter a dollar amount." });
    }
  });
  it("accepts the bounds", () => {
    expect(parseDealValue("1")).toEqual({ ok: true, cents: 100 });
    expect(parseDealValue("10,000,000")).toEqual({ ok: true, cents: 1_000_000_000 });
  });
  it("rejects anything over $10,000,000", () => {
    expect(parseDealValue("10000001")).toEqual({ ok: false, message: "Keep it under $10,000,000." });
  });
});
