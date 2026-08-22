import { describe, expect, it } from "vitest";
import { PALETTE_DESTINATIONS, filterDestinations } from "./palette-search";

const labels = (query: string) => filterDestinations(query).map((d) => d.label);

describe("filterDestinations", () => {
  it("returns every destination in list order for an empty query", () => {
    expect(filterDestinations("")).toEqual([...PALETTE_DESTINATIONS]);
    expect(filterDestinations("   ")).toEqual([...PALETTE_DESTINATIONS]);
  });

  it("ranks a label prefix first, then word prefixes, substrings, and keywords", () => {
    expect(labels("app")[0]).toBe("Approvals");
    expect(labels("in")[0]).toBe("Inbox");
    // "set" is a prefix of Settings; the pages under /settings follow via their path
    const set = labels("set");
    expect(set[0]).toBe("Settings");
    expect(set).toEqual(expect.arrayContaining(["Senders", "Billing", "Team", "Integrations", "Suppression"]));
    expect(set).not.toContain("Today");
  });

  it("matches case-insensitively", () => {
    expect(labels("PLAY")).toEqual(["Playbook"]);
    expect(labels("bIlL")).toEqual(["Billing"]);
  });

  it("reaches destinations through their path and keywords", () => {
    expect(labels("/meet")).toEqual(["Meetings"]);
    expect(labels("leads")).toContain("Prospects");
    expect(labels("plan")).toContain("Billing");
    expect(labels("blocklist")).toEqual(["Suppression"]);
  });

  it("requires every token to match somewhere", () => {
    expect(labels("settings team")).toEqual(["Team"]);
    expect(labels("settings zebra")).toEqual([]);
  });

  it("returns nothing for a query that matches no destination", () => {
    expect(labels("xyzzy")).toEqual([]);
  });

  it("does not mutate the source list", () => {
    const before = PALETTE_DESTINATIONS.map((d) => d.key);
    filterDestinations("s");
    expect(PALETTE_DESTINATIONS.map((d) => d.key)).toEqual(before);
  });
});
