import { describe, expect, it } from "vitest";
import {
  countRows,
  featureKeys,
  fitLearner,
  isInformative,
  LEARN_MIN_N,
  predictLead,
  rankByLearned,
  signalReport,
  type LearnerRow,
} from "./learn";
import type { LeadOutcomeFlags } from "../optimize/outcomes";

const flags = (positive: boolean, accepted = positive): LeadOutcomeFlags => ({
  invited: true,
  accepted,
  interested: positive,
  negative: false,
  booked: false,
  converted: false,
});

function rows(n: number, positives: number, base: Partial<LearnerRow>): LearnerRow[] {
  return Array.from({ length: n }, (_, i) => ({
    title: "VP Sales",
    industry: "saas",
    aiScore: 75,
    ...base,
    flags: flags(i < positives),
  }));
}

describe("featureKeys", () => {
  it("emits one key per family, signals multi-valued and deduped, score banded", () => {
    expect(
      featureKeys({
        source: "intent",
        signals: ["funding", "funding", "hiring"],
        intentLevel: "high",
        title: "Co-Founder & CEO",
        industry: " SaaS ",
        companySize: "11-50",
        aiScore: 91,
      }).sort()
    ).toEqual(
      [
        "source:intent",
        "signal:funding",
        "signal:hiring",
        "intent:high",
        "seniority:founder",
        "industry:saas",
        "size:11-50",
        "score:90+",
      ].sort()
    );
  });

  it("skips families with no value", () => {
    expect(featureKeys({ title: null, industry: null, aiScore: null })).toEqual(["seniority:other"]);
  });
});

describe("fitLearner / predictLead", () => {
  it("is not informative below LEARN_MIN_N matured invites", () => {
    const model = fitLearner(countRows(rows(LEARN_MIN_N - 1, 3, {})));
    expect(isInformative(model)).toBe(false);
  });

  it("learns that a signal kind predicts positive replies and ranks it higher", () => {
    const data = [
      ...rows(40, 12, { signals: ["funding"] }), // 30%
      ...rows(40, 2, { signals: ["hiring"] }), // 5%
    ];
    const model = fitLearner(countRows(data));
    expect(isInformative(model)).toBe(true);
    const funded = predictLead(model, { title: "VP Sales", industry: "saas", aiScore: 75, signals: ["funding"] });
    const hiring = predictLead(model, { title: "VP Sales", industry: "saas", aiScore: 75, signals: ["hiring"] });
    expect(funded.p).toBeGreaterThan(hiring.p);
    expect(funded.top[0]).toMatchObject({ feature: "signal:funding" });
    expect(funded.top[0]!.lift).toBeGreaterThan(0);
  });

  it("shrinks a tiny lucky segment toward the base instead of trusting it", () => {
    const data = [...rows(100, 10, {}), ...rows(2, 2, { industry: "fintech" })];
    const model = fitLearner(countRows(data));
    const lucky = predictLead(model, { title: "VP Sales", industry: "fintech", aiScore: 75 });
    // 2/2 raw = 100%; shrunk with M=25 pseudo-obs at ~11% base stays well under 25%
    expect(lucky.p).toBeLessThan(0.25);
  });

  it("borrows strength from the global pool when the account has no data for a feature", () => {
    const global = countRows([...rows(200, 60, { signals: ["funding"] }), ...rows(200, 10, {})]);
    const account = countRows(rows(40, 4, {})); // account never saw a funding lead
    const model = fitLearner(account, global);
    const funded = predictLead(model, { title: "VP Sales", industry: "saas", aiScore: 75, signals: ["funding"] });
    const plain = predictLead(model, { title: "VP Sales", industry: "saas", aiScore: 75 });
    expect(funded.p).toBeGreaterThan(plain.p);
  });

  it("does not double-count correlated signals: two positive signals score like the stronger one", () => {
    const data = [
      ...rows(60, 18, { signals: ["funding"] }),
      ...rows(60, 15, { signals: ["exec_hire"] }),
      ...rows(60, 3, {}),
    ];
    const model = fitLearner(countRows(data));
    const both = predictLead(model, { title: "VP Sales", industry: "saas", aiScore: 75, signals: ["funding", "exec_hire"] });
    const one = predictLead(model, { title: "VP Sales", industry: "saas", aiScore: 75, signals: ["funding"] });
    expect(both.p).toBeCloseTo(one.p, 6);
  });

  it("calibrates the LLM score band against reality", () => {
    const data = [...rows(50, 2, { aiScore: 95 }), ...rows(50, 12, { aiScore: 72 })];
    const model = fitLearner(countRows(data));
    const high = predictLead(model, { title: "VP Sales", industry: "saas", aiScore: 96 });
    const low = predictLead(model, { title: "VP Sales", industry: "saas", aiScore: 71 });
    expect(low.p).toBeGreaterThan(high.p); // the account's 90+ leads actually reply less
  });

  it("only counts invited rows", () => {
    const t = countRows([{ title: null, industry: null, aiScore: null, flags: { ...flags(true), invited: false } }]);
    expect(t.n).toBe(0);
  });
});

describe("rankByLearned", () => {
  it("orders by predicted p, ties broken by ai score", () => {
    const model = fitLearner(countRows([...rows(40, 14, { signals: ["funding"] }), ...rows(40, 2, {})]));
    const leads = [
      { id: "plain-high", title: "VP Sales", industry: "saas", aiScore: 95 },
      { id: "funded", title: "VP Sales", industry: "saas", aiScore: 75, signals: ["funding"] },
      { id: "plain-low", title: "VP Sales", industry: "saas", aiScore: 80 },
    ];
    const ranked = rankByLearned(leads, model).map((l) => l.id);
    expect(ranked[0]).toBe("funded");
    expect(ranked.indexOf("plain-high")).toBeLessThan(ranked.indexOf("plain-low"));
  });
});

describe("signalReport", () => {
  it("lists the strongest positive and negative features with their evidence", () => {
    const model = fitLearner(
      countRows([...rows(60, 20, { signals: ["funding"] }), ...rows(60, 1, { signals: ["cost_cutting"] }), ...rows(60, 6, {})])
    );
    const report = signalReport(model, 3);
    expect(report.positive[0]).toMatchObject({ feature: "signal:funding" });
    expect(report.positive[0]!.n).toBe(60);
    expect(report.negative.some((r) => r.feature === "signal:cost_cutting")).toBe(true);
  });
});

describe("orderLeads", () => {
  const leads = [
    { id: "a", title: "VP Sales", industry: "saas", aiScore: 72, signals: ["funding"] },
    { id: "b", title: "VP Sales", industry: "saas", aiScore: 90 },
  ];

  it("uses the learned model when it is informative", async () => {
    const { orderLeads, buildLeadOrdering } = await import("./learn");
    const account = countRows([...rows(40, 14, { signals: ["funding"] }), ...rows(40, 1, {})]);
    const ordering = buildLeadOrdering(account, undefined, []);
    expect(ordering.kind).toBe("learned");
    expect(orderLeads(leads, ordering).map((l) => l.id)).toEqual(["a", "b"]);
  });

  it("falls back to the ML-0 tilt order (score + tilt) when the learner is not informative", async () => {
    const { orderLeads, buildLeadOrdering } = await import("./learn");
    const ordering = buildLeadOrdering(countRows(rows(5, 1, {})), undefined, []);
    expect(ordering.kind).toBe("tilt");
    expect(orderLeads(leads, ordering).map((l) => l.id)).toEqual(["b", "a"]);
  });
});

describe("buildReadout / explainLead (what users see — their OWN data only)", () => {
  it("is built from the account's counts alone — there is no way to pass the cross-account pool", async () => {
    const { buildReadout } = await import("./learn");
    expect(buildReadout.length).toBe(1); // (account) only — guardrail: displayed numbers never blend other tenants
  });

  it("lists features with enough of the account's own evidence, strongest first, as ratios", async () => {
    const { buildReadout } = await import("./learn");
    const readout = buildReadout(
      countRows([...rows(40, 14, { signals: ["funding"] }), ...rows(40, 2, { title: "Sales Manager" }), ...rows(3, 3, { industry: "fintech" })])
    );
    expect(readout.evidence).toBe(83);
    const keys = readout.features.map((f) => f.feature);
    expect(keys).toContain("signal:funding");
    expect(keys).not.toContain("industry:fintech"); // 3 own observations — below the display floor
    expect(readout.features.find((f) => f.feature === "signal:funding")!.ratio).toBeGreaterThan(1);
    expect(readout.features.find((f) => f.feature === "seniority:manager")!.ratio).toBeLessThan(1);
    // strongest first, in either direction
    const mags = readout.features.map((f) => Math.abs(f.lift));
    expect(mags).toEqual([...mags].sort((a, b) => b - a));
  });

  it("explains a lead with up to 3 human-readable reasons from the readout", async () => {
    const { buildReadout, explainLead } = await import("./learn");
    const readout = buildReadout(countRows([...rows(40, 14, { signals: ["funding"] }), ...rows(40, 2, {})]));
    const reasons = explainLead(readout, { title: "VP Sales", industry: "saas", aiScore: 75, signals: ["funding"] });
    expect(reasons[0]).toMatchObject({ feature: "signal:funding", label: "Funding signal" });
    expect(reasons[0]!.ratio).toBeGreaterThan(1);
    expect(reasons.length).toBeLessThanOrEqual(3);
  });

  it("explains nothing until the account has enough matured invites", async () => {
    const { buildReadout, explainLead } = await import("./learn");
    const readout = buildReadout(countRows(rows(10, 5, { signals: ["funding"] })));
    expect(explainLead(readout, { title: "VP Sales", industry: "saas", aiScore: 75, signals: ["funding"] })).toEqual([]);
  });
});

describe("featureLabel", () => {
  it("turns feature keys into plain words", async () => {
    const { featureLabel } = await import("./learn");
    expect(featureLabel("signal:exec_hire")).toBe("New executive hire signal");
    expect(featureLabel("seniority:founder")).toBe("Founders");
    expect(featureLabel("industry:saas")).toBe("SaaS industry");
    expect(featureLabel("size:11-50")).toBe("11-50 employees");
    expect(featureLabel("score:90+")).toBe("Score 90+");
    expect(featureLabel("source:intent")).toBe("Found showing intent");
    expect(featureLabel("intent:high")).toBe("High intent");
  });
});

describe("lookalike as a learner feature (ML-7)", () => {
  it("emits a lookalike:<bucket> key and learns its lift like any other feature", () => {
    expect(featureKeys({ title: null, industry: null, aiScore: null, lookalike: "high" })).toContain("lookalike:high");
    const model = fitLearner(countRows([...rows(40, 14, { lookalike: "high" }), ...rows(40, 2, { lookalike: "low" })]));
    const hi = predictLead(model, { title: "VP Sales", industry: "saas", aiScore: 75, lookalike: "high" });
    const lo = predictLead(model, { title: "VP Sales", industry: "saas", aiScore: 75, lookalike: "low" });
    expect(hi.p).toBeGreaterThan(lo.p);
  });

  it("labels lookalike buckets in plain words", async () => {
    const { featureLabel } = await import("./learn");
    expect(featureLabel("lookalike:high")).toBe("Looks like your best replies");
    expect(featureLabel("lookalike:mid")).toBe("Somewhat like your best replies");
    expect(featureLabel("lookalike:low")).toBe("Unlike your best replies");
  });
});
