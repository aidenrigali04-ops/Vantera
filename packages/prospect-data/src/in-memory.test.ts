import { describe, expect, it } from "vitest";
import { InMemoryProspectData, makeCandidate } from "./in-memory";

describe("InMemoryProspectData", () => {
  it("returns seeded candidates up to the limit and records the call", async () => {
    const pool = [
      makeCandidate({ externalRef: "p1", industry: "saas" }),
      makeCandidate({ externalRef: "p2", industry: "saas" }),
      makeCandidate({ externalRef: "p3", industry: "logistics" }),
    ];
    const source = new InMemoryProspectData(pool);

    const found = await source.discoverProspects({ industries: ["saas"] }, 1);

    expect(found).toHaveLength(1);
    expect(found[0]!.externalRef).toBe("p1");
    expect(source.discoverCalls).toEqual([{ filters: { industries: ["saas"] }, limit: 1 }]);
  });

  it("filters candidates by industry, size, geo, and title case-insensitively", async () => {
    const pool = [
      makeCandidate({ externalRef: "p1", industry: "SaaS", title: "CTO" }),
      makeCandidate({ externalRef: "p2", industry: "saas", title: "Head of Sales" }),
    ];
    const source = new InMemoryProspectData(pool);

    const found = await source.discoverProspects({ industries: ["saas"], titles: ["cto"] }, 10);

    expect(found.map((c) => c.externalRef)).toEqual(["p1"]);
  });

  it("enriches only known refs with deterministic contact data", async () => {
    const source = new InMemoryProspectData([makeCandidate({ externalRef: "p1" })]);

    const enriched = await source.enrichProspects([{ externalRef: "p1" }, { externalRef: "unknown" }]);

    expect(enriched).toHaveLength(1);
    expect(enriched[0]!.email).toBe("p1@enriched.example.com");
    expect(enriched[0]!.emailStatus).toBe("valid");
    expect(enriched[0]!.signals?.length).toBeGreaterThan(0);
    expect(source.enrichCalls).toEqual([[{ externalRef: "p1" }, { externalRef: "unknown" }]]);
  });
});
