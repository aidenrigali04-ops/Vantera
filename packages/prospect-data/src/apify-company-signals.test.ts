import { describe, expect, it } from "vitest";
import { ApifyCompanySignals } from "./apify-company-signals";

function fakeFetch(items: unknown): typeof fetch {
  return (async () => new Response(JSON.stringify(items), { status: 200 })) as unknown as typeof fetch;
}

describe("ApifyCompanySignals", () => {
  const now = () => new Date("2026-06-24T00:00:00Z");

  it("classifies + normalizes recent news into ProspectSignal, keyed by company", async () => {
    const src = new ApifyCompanySignals({
      token: "t",
      actorId: "user/news",
      now,
      fetchImpl: fakeFetch([
        { companyName: "Acme", companyDomain: "acme.com", title: "Acme raises $20M Series B", date: "2026-06-20" },
        { companyName: "Acme", companyDomain: "acme.com", title: "Acme quarterly blog recap", date: "2026-06-21" },
      ]),
    });
    const out = await src.getCompanySignals([{ name: "Acme", domain: "acme.com" }]);
    const sigs = out.get("acme.com")!;
    expect(sigs).toHaveLength(1); // the blog recap is unmatched → dropped
    expect(sigs[0]!.kind).toBe("funding");
    expect(sigs[0]!.observedAt).toBe("2026-06-20");
    expect(JSON.stringify(sigs)).not.toMatch(/apify/i); // white-label
  });

  it("drops events older than the recency window", async () => {
    const src = new ApifyCompanySignals({
      token: "t",
      actorId: "user/news",
      recencyDays: 90,
      now,
      fetchImpl: fakeFetch([{ companyName: "Old", title: "Old raises Series A round", date: "2026-01-01" }]),
    });
    const out = await src.getCompanySignals([{ name: "Old" }]);
    expect(out.get("old")).toBeUndefined();
  });

  it("fails open on a non-200 (returns empty map, never throws)", async () => {
    const src = new ApifyCompanySignals({
      token: "t",
      actorId: "user/news",
      fetchImpl: (async () => new Response("nope", { status: 500 })) as unknown as typeof fetch,
    });
    await expect(src.getCompanySignals([{ name: "Acme" }])).resolves.toEqual(new Map());
  });

  it("returns an empty map for an empty company list without calling fetch", async () => {
    let called = false;
    const src = new ApifyCompanySignals({
      token: "t",
      actorId: "user/news",
      fetchImpl: (async () => {
        called = true;
        return new Response("[]", { status: 200 });
      }) as unknown as typeof fetch,
    });
    expect(await src.getCompanySignals([])).toEqual(new Map());
    expect(called).toBe(false);
  });
});
