import { describe, expect, it } from "vitest";
import { aggregateSignalAttribution, signalKindLabel } from "./analytics";

describe("aggregateSignalAttribution", () => {
  it("counts each win once per distinct signal kind it carried", () => {
    const result = aggregateSignalAttribution([
      { lead_signals: [{ kind: "funding" }, { kind: "funding" }, { kind: "intent" }] }, // dedupes funding
      { lead_signals: [{ kind: "funding" }] },
      { lead_signals: [{ kind: "exec_hire" }] },
    ]);
    expect(result).toEqual([
      { kind: "funding", label: "Funding rounds", wins: 2 },
      { kind: "exec_hire", label: "Exec hires", wins: 1 },
      { kind: "intent", label: "Buying intent", wins: 1 },
    ]);
  });

  it("ignores wins with no captured signals and returns empty when none have any", () => {
    expect(aggregateSignalAttribution([{ lead_signals: [] }, { lead_signals: null }])).toEqual([]);
    expect(aggregateSignalAttribution([])).toEqual([]);
  });
});

describe("signalKindLabel", () => {
  it("maps known kinds to friendly labels and passes through the unknown", () => {
    expect(signalKindLabel("funding")).toBe("Funding rounds");
    expect(signalKindLabel("intent")).toBe("Buying intent");
    expect(signalKindLabel("some_new_kind")).toBe("some_new_kind");
  });
});
