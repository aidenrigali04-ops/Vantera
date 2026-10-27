import { describe, expect, it } from "vitest";
import type { ProofModel, ProofRow } from "@/lib/proof/types";
import { cardFunnels } from "./card-funnel";

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
});
