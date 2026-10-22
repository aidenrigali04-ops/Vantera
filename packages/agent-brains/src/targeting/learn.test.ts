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
