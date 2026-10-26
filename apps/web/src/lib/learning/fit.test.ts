import { describe, expect, it } from "vitest";
import { fitVerdictFromRows, parseFitReason, parseFitVerdict } from "./fit";

describe("parseFitVerdict", () => {
  it("accepts only the known verdicts (and clear)", () => {
    expect(parseFitVerdict("good_fit")).toBe("good_fit");
    expect(parseFitVerdict("not_fit")).toBe("not_fit");
    expect(parseFitVerdict("clear")).toBe("clear");
    expect(parseFitVerdict("great")).toBeNull();
    expect(parseFitVerdict(null)).toBeNull();
  });
});

describe("fitVerdictFromRows", () => {
  it("maps feedback rows to a per-lead verdict lookup", () => {
    const m = fitVerdictFromRows([
      { lead_id: "a", verdict: "not_fit" },
      { lead_id: "b", verdict: "good_fit" },
      { lead_id: "c", verdict: "bogus" },
    ]);
    expect(m.get("a")).toBe("not_fit");
    expect(m.get("b")).toBe("good_fit");
    expect(m.has("c")).toBe(false);
  });

  it("is empty for a failed or missing read", () => {
    expect(fitVerdictFromRows(null).size).toBe(0);
  });
});

describe("parseFitReason", () => {
  it("trims, drops blanks, and rejects over 200 chars", () => {
    expect(parseFitReason("  Too small  ")).toEqual({ ok: true, reason: "Too small" });
    expect(parseFitReason("   ")).toEqual({ ok: true, reason: null });
    expect(parseFitReason(null)).toEqual({ ok: true, reason: null });
    expect(parseFitReason("x".repeat(200))).toEqual({ ok: true, reason: "x".repeat(200) });
    expect(parseFitReason("x".repeat(201))).toEqual({ ok: false });
  });
});
