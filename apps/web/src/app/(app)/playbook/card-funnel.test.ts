import { describe, expect, it } from "vitest";
import type { ProofModel, ProofRow } from "@/lib/proof/types";
import { cardFunnels, funnelEmpty, FUNNEL_EMPTY } from "./card-funnel";

const row = (key: string, o: Partial<ProofRow> = {}): ProofRow => ({
  key, label: key, group: "agent", found: 0, contacted: 0, accepted: 0, replied: 0, interested: 0, closed: 0, ...o,
});
const proof = (agents: ProofRow[]): ProofModel => ({
  funnel: [], sources: [], agents, capped: false, nonMonotonic: false,
});

describe("cardFunnels", () => {
  it("scout: found → contacted → replied from the scout row, pct vs previous stage", () => {
    const f = cardFunnels(proof([row("agent:scout", { found: 40, contacted: 20, replied: 5 })]), { intentSummary: null });
    expect(f.scout).toEqual([
      { label: "Found", count: 40, pct: null },
      { label: "Contacted", count: 20, pct: 50 },
      { label: "Replied", count: 5, pct: 25 },
    ]);
  });

  it("copy: contacted → accepted → replied → interested from the outreach row", () => {
    const f = cardFunnels(
      proof([row("agent:outreach", { found: null, contacted: 30, accepted: 10, replied: 3, interested: 1 })]),
      { intentSummary: null },
    );
    expect(f.copy).toEqual([
      { label: "Contacted", count: 30, pct: null },
      { label: "Accepted", count: 10, pct: 33 },
      { label: "Replied", count: 3, pct: 30 },
      { label: "Interested", count: 1, pct: 33 },
    ]);
  });

  it("intent: observed → intent → qualified from the latest run summary", () => {
    const f = cardFunnels(proof([]), { intentSummary: { observed: 200, intent: 12, qualified: 3 } });
    expect(f.intent).toEqual([
      { label: "Observed", count: 200, pct: null },
      { label: "Intent", count: 12, pct: 6 },
      { label: "Qualified", count: 3, pct: 25 },
    ]);
  });

  it("missing rows and no intent run read as zeros with null pct, never NaN", () => {
    const f = cardFunnels(proof([]), { intentSummary: null });
    for (const stages of [f.scout, f.intent, f.copy]) {
      for (const s of stages) expect(s).toMatchObject({ count: 0, pct: null });
    }
    expect(f.intent.map((s) => s.label)).toEqual(["Observed", "Intent", "Qualified"]);
  });

  it("a zero previous stage gives a null pct for the next one", () => {
    const f = cardFunnels(proof([row("agent:scout", { found: 0, contacted: 0, replied: 0 })]), {
      intentSummary: { observed: 0, intent: 0 },
    });
    expect(f.scout[1].pct).toBeNull();
    expect(f.intent[2]).toEqual({ label: "Qualified", count: 0, pct: null });
  });

  it("non-monotonic rows give pct over 100, never NaN", () => {
    const f = cardFunnels(proof([row("agent:scout", { found: 4, contacted: 10, replied: 2 })]), { intentSummary: null });
    expect(f.scout[1]).toEqual({ label: "Contacted", count: 10, pct: 250 });
    expect(f.scout.every((s) => s.pct === null || Number.isFinite(s.pct))).toBe(true);
  });

  it("a missing outreach row beside an existing scout row reads as zeros", () => {
    const f = cardFunnels(proof([row("agent:scout", { found: 9, contacted: 3, replied: 1 })]), { intentSummary: null });
    expect(f.scout[0].count).toBe(9);
    expect(f.copy).toEqual([
      { label: "Contacted", count: 0, pct: null },
      { label: "Accepted", count: 0, pct: null },
      { label: "Replied", count: 0, pct: null },
      { label: "Interested", count: 0, pct: null },
    ]);
  });

  it("intent empty state distinguishes no run from a run that found nothing", () => {
    const none = cardFunnels(proof([]), { intentSummary: null });
    const ran = cardFunnels(proof([]), { intentSummary: { observed: 0 } });
    expect(none.intentRan).toBe(false);
    expect(ran.intentRan).toBe(true);
    expect(funnelEmpty("intent", none)).toBe(FUNNEL_EMPTY.intentNoRun);
    expect(funnelEmpty("intent", ran)).toBe("Last run found nothing");
    expect(funnelEmpty("scout", ran)).toBe(FUNNEL_EMPTY.scout);
    expect(funnelEmpty("copy", ran)).toBe(FUNNEL_EMPTY.copy);
  });
});
