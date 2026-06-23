import { describe, expect, it } from "vitest";
import { ApifyProspectData, buildSearchInput } from "./apify";

/** Minimal fetch stub: records the request and returns a canned dataset (the run-sync items array). */
function fakeFetch(items: unknown, capture?: { url?: string; body?: Record<string, unknown> }) {
  return (async (url: string | URL, init?: RequestInit) => {
    if (capture) {
      capture.url = String(url);
      capture.body = init?.body ? JSON.parse(init.body as string) : undefined;
    }
    return { ok: true, status: 200, json: async () => items } as Response;
  }) as unknown as typeof fetch;
}

const opts = (fetchImpl: typeof fetch) => ({ token: "t", actorId: "acme/linkedin-search", fetchImpl });

describe("ApifyProspectData", () => {
  it("maps scraped LinkedIn rows to discovery candidates (profile-keyed, thin)", async () => {
    const items = [
      { profileUrl: "https://li/in/gwen", fullName: "Gwen Park", headline: "Head of CX", companyName: "Globex", location: "Austin, TX" },
      { url: "https://li/in/leo", firstName: "Leo", lastName: "Reyes", title: "VP Sales", company: "Initech" },
      { name: "no url here" }, // dropped — no profile url
    ];
    const out = await new ApifyProspectData(opts(fakeFetch(items))).discoverProspects({ titles: ["vp sales"] }, 10);

    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({
      externalRef: "https://li/in/gwen",
      linkedinUrl: "https://li/in/gwen",
      firstName: "Gwen",
      lastName: "Park",
      title: "Head of CX",
      companyName: "Globex",
      location: "Austin, TX",
    });
    expect(out[1]).toMatchObject({ externalRef: "https://li/in/leo", title: "VP Sales", companyName: "Initech" });
  });

  it("maps the ICP filters onto HarvestAPI's input (titles, industry query, locations, cap, mode)", () => {
    const input = buildSearchInput({ titles: ["VP Sales", "Head of Growth"], industries: ["SaaS"], geos: ["United States"] }, 50);
    expect(input.currentJobTitles).toEqual(["VP Sales", "Head of Growth"]);
    expect(input.searchQuery).toBe("SaaS");
    expect(input.locations).toEqual(["United States"]);
    expect(input.maxItems).toBe(50);
    expect(input.profileScraperMode).toBe("Short");
  });

  it("maps HarvestAPI's real shape — nested currentPositions, location object, no top-level headline", async () => {
    const items = [
      {
        linkedinUrl: "https://www.linkedin.com/in/greg",
        firstName: "Greg",
        lastName: "Kimmell",
        currentPositions: [{ companyName: "TwinBird Consulting", title: "VP Digital Sales", current: true }],
        location: { linkedinText: "Los Angeles, California, United States" },
      },
    ];
    const out = await new ApifyProspectData(opts(fakeFetch(items))).discoverProspects({ titles: ["vp"] }, 10);
    expect(out[0]).toMatchObject({
      externalRef: "https://www.linkedin.com/in/greg",
      linkedinUrl: "https://www.linkedin.com/in/greg",
      firstName: "Greg",
      lastName: "Kimmell",
      title: "VP Digital Sales", // currentPositions[0].title
      companyName: "TwinBird Consulting", // currentPositions[0].companyName
      location: "Los Angeles, California, United States", // location.linkedinText
    });
  });

  it("runs the configured actor (~ form) with bearer auth and merges actor-specific input", async () => {
    const cap: { url?: string; body?: Record<string, unknown> } = {};
    const provider = new ApifyProspectData({ token: "t", actorId: "acme/linkedin-search", extraInput: { cookie: "x" }, fetchImpl: fakeFetch([], cap) });
    await provider.discoverProspects({ titles: ["cto"] }, 5);
    expect(cap.url).toContain("/v2/acts/acme~linkedin-search/run-sync-get-dataset-items");
    expect(cap.body?.maxItems).toBe(5);
    expect(cap.body?.cookie).toBe("x"); // APIFY_ACTOR_INPUT static fields ride through
  });

  it("dedupes by profile url and caps to the limit", async () => {
    const items = [
      { profileUrl: "u1", name: "A A", companyName: "X" },
      { profileUrl: "u1", name: "A dup", companyName: "X" },
      { profileUrl: "u2", name: "B B", companyName: "Y" },
    ];
    const out = await new ApifyProspectData(opts(fakeFetch(items))).discoverProspects({}, 1);
    expect(out).toHaveLength(1);
  });

  it("tolerates a {items:[...]} wrapper shape", async () => {
    const out = await new ApifyProspectData(opts(fakeFetch({ items: [{ profileUrl: "u9", companyName: "Z" }] }))).discoverProspects({}, 10);
    expect(out.map((c) => c.externalRef)).toEqual(["u9"]);
  });

  it("enrichProspects is a no-op and credit balance is unknown (Apify-only)", async () => {
    const provider = new ApifyProspectData(opts(fakeFetch([])));
    expect(await provider.enrichProspects([{ externalRef: "u1" }])).toEqual([]);
    expect(await provider.getCreditBalance()).toBeNull();
  });

  it("throws when the token or actor is not configured", () => {
    expect(() => new ApifyProspectData({ actorId: "a/b", fetchImpl: fakeFetch([]) })).toThrow(/APIFY_TOKEN/);
    expect(() => new ApifyProspectData({ token: "t", fetchImpl: fakeFetch([]) })).toThrow(/APIFY_LINKEDIN_ACTOR/);
  });
});
