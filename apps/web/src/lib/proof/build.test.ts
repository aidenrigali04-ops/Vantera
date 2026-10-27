import { describe, expect, it } from "vitest";
import { buildProof } from "./build";
import { empty, lead } from "./fixtures";
import type { ProofInput } from "./types";

const inv = "2026-01-01";
function fixture(): ProofInput {
  return {
    ...empty(),
    leads: [
      lead("A"),
      lead("B", { status: "qualified", linkedin_invited_at: inv }),
      lead("C", { status: "enriched", linkedin_invited_at: inv, linkedin_connected_at: inv }),
      lead("D", { status: "in_campaign", linkedin_connected_at: inv }),
      lead("E", { status: "converted", meeting_booked_at: inv, linkedin_connected_at: inv }),
      lead("F", { status: "rejected" }),
    ],
    sendLeadIds: ["D", "E"],
    replies: [
      { lead_id: "C", classification: "neutral" },
      { lead_id: "D", classification: "interested" },
      { lead_id: "E", classification: "neutral" },
    ],
  };
}

describe("buildProof", () => {
  it("counts the eight stages from rows, not from leads.status", () => {
    const m = buildProof(fixture());
    expect(m.funnel.map((s) => [s.key, s.count])).toEqual([
      ["found", 6], ["qualified", 4], ["contacted", 4], ["accepted", 3],
      ["replied", 3], ["interested", 1], ["meetings", 1], ["closed", 1],
    ]);
    expect(m.funnel[2]!.pct).toBe(100);
    expect(m.funnel[5]!.pct).toBe(33);
  });
  it("contacted = outreach_sends ∪ linkedin_invited_at, each lead once", () => {
    const m = buildProof({
      ...empty(),
      leads: [lead("A", { linkedin_invited_at: inv }), lead("B")],
      sendLeadIds: ["A", "A", "B"],
    });
    expect(m.funnel.find((s) => s.key === "contacted")!.count).toBe(2);
  });
  it("replies without sends: replied exceeds contacted, pct null, nonMonotonic", () => {
    const m = buildProof({ ...empty(), leads: [lead("A")], replies: [{ lead_id: "A", classification: "neutral" }] });
    expect(m.funnel.find((s) => s.key === "contacted")!.count).toBe(0);
    expect(m.funnel.find((s) => s.key === "replied")!.pct).toBeNull();
    expect(m.nonMonotonic).toBe(true);
  });
  it("meetings is cumulative: a straight-to-close deal counts as a meeting", () => {
    const m = buildProof({ ...empty(), leads: [lead("A", { status: "converted" })] });
    expect(m.funnel.find((s) => s.key === "meetings")!.count).toBe(1);
  });
  it("passes capped through", () => {
    expect(buildProof({ ...empty(), capped: true }).capped).toBe(true);
  });
});
