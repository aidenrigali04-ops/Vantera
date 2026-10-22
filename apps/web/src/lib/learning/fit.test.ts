import { describe, expect, it } from "vitest";
import { fitVerdictFromRows, parseFitVerdict } from "./fit";

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
