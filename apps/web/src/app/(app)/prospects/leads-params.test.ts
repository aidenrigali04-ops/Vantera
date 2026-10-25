import { describe, expect, it } from "vitest";
import { EMPTY_FILTERS, LEADS_TABS, leadsHref, tabPredicate, type LeadsTab } from "./leads-params";

describe("leadsHref", () => {
  it("omits defaults", () => {
    expect(leadsHref({ tab: "all", q: "", sort: "newest" })).toBe("/prospects");
  });
  it("carries the signal filter", () => {
    const href = leadsHref({ tab: "all", q: "", sort: "newest", filters: { ...EMPTY_FILTERS, signal: "hiring" } });
    expect(href).toBe("/prospects?signal=hiring");
  });
  it("carries tab=scheduled", () => {
    expect(leadsHref({ tab: "scheduled", q: "", sort: "newest" })).toBe("/prospects?tab=scheduled");
  });
});

describe("tabPredicate", () => {
  it("covers all seven tabs in order, Scheduled between Qualified and In outreach", () => {
    expect(LEADS_TABS).toEqual(["all", "intent", "qualified", "scheduled", "in_campaign", "replied", "rejected"]);
  });
  it("maps each tab to statuses / source / scheduled", () => {
    const table: Record<LeadsTab, unknown> = {
      all: { statuses: null, source: null, scheduled: false },
      intent: { statuses: null, source: "intent", scheduled: false },
      qualified: { statuses: ["qualified", "enriched"], source: null, scheduled: false },
      scheduled: { statuses: null, source: null, scheduled: true },
      in_campaign: { statuses: ["in_campaign"], source: null, scheduled: false },
      replied: { statuses: ["replied", "converted"], source: null, scheduled: false },
      rejected: { statuses: ["rejected"], source: null, scheduled: false },
    };
    for (const t of LEADS_TABS) expect(tabPredicate(t)).toEqual(table[t]);
  });
});
