import { describe, expect, it } from "vitest";
import { parseReadout, reasonsForLead, whatsWorking } from "./readout";

const readout = {
  mode: "learned",
  evidence: 120,
  features: [
    { feature: "signal:funding", lift: 0.74, ratio: 2.1, n: 40 },
    { feature: "seniority:manager", lift: -0.69, ratio: 0.5, n: 30 },
    { feature: "seniority:founder", lift: 0.47, ratio: 1.6, n: 22 },
    { feature: "industry:saas", lift: 0.18, ratio: 1.2, n: 60 },
    { feature: "intent:high", lift: 0.55, ratio: 1.7, n: 12 },
  ],
};

describe("parseReadout", () => {
  it("reads the learned readout out of a scout run summary", () => {
    expect(parseReadout({ discovered: 10, learned: readout })?.evidence).toBe(120);
  });

  it("returns null for missing or malformed data instead of throwing", () => {
    expect(parseReadout(null)).toBeNull();
    expect(parseReadout({})).toBeNull();
    expect(parseReadout({ learned: null })).toBeNull();
    expect(parseReadout({ learned: { evidence: "x", features: [] } })).toBeNull();
    // drops malformed feature rows, keeps good ones
    expect(parseReadout({ learned: { evidence: 50, features: [{ feature: 3 }, readout.features[0]] } })?.features).toHaveLength(1);
  });
});

describe("reasonsForLead", () => {
  const parsed = parseReadout({ learned: readout })!;

  it("maps a prospect row to the learner's features and returns its strongest reasons", () => {
    const reasons = reasonsForLead(parsed, {
      source: "intent",
      title: "Co-founder & CEO",
      industry: "SaaS",
      company_size: "11-50",
      ai_score: 84,
      lead_signals: [{ kind: "funding" }, { kind: "intent", level: "high" }],
    });
    expect(reasons.map((r) => r.label)).toEqual(["Funding signal", "High intent", "Founders"]);
  });

  it("returns nothing when there is no readout", () => {
    expect(reasonsForLead(null, { title: "CEO", industry: null, ai_score: 80 })).toEqual([]);
  });
});

describe("whatsWorking", () => {
  it("splits the readout into what's replying more and less, top 3 each", () => {
    const w = whatsWorking(parseReadout({ learned: readout }));
    expect(w?.up.map((r) => r.label)).toEqual(["Funding signal", "High intent", "Founders"]);
    expect(w?.down.map((r) => r.label)).toEqual(["Managers"]);
    expect(w?.evidence).toBe(120);
  });

  it("is null until there is enough evidence or anything to say", () => {
    expect(whatsWorking(parseReadout({ learned: { ...readout, evidence: 12 } }))).toBeNull();
    expect(whatsWorking(parseReadout({ learned: { ...readout, features: [] } }))).toBeNull();
    expect(whatsWorking(null)).toBeNull();
  });
});
