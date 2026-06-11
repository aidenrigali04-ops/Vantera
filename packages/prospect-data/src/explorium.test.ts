import { describe, expect, it } from "vitest";
import { ExploriumProspectData } from "./explorium";

function fetchStub(responses: Record<string, unknown>) {
  const calls: { url: string; init: RequestInit }[] = [];
  const impl = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const match = Object.entries(responses).find(([path]) => url.includes(path));
    if (!match) return new Response("not found", { status: 404 });
    return new Response(JSON.stringify(match[1]), { status: 200 });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

describe("ExploriumProspectData", () => {
  it("sends the api key header and maps discovery responses to candidates", async () => {
    const { impl, calls } = fetchStub({
      "/prospects": {
        data: [
          {
            prospect_id: "ref_1",
            company_name: "Acme",
            company_website: "acme.com",
            company_size: "11-50",
            company_industry: "Software",
            country_name: "United States",
            first_name: "Dana",
            last_name: "Reed",
            job_title: "VP Sales",
            linkedin: "https://linkedin.com/in/dana-reed",
          },
        ],
      },
    });
    const source = new ExploriumProspectData({ apiKey: "k", fetchImpl: impl });

    const found = await source.discoverProspects({ industries: ["software"], titles: ["vp sales"] }, 5);

    expect(found).toEqual([
      {
        externalRef: "ref_1",
        companyName: "Acme",
        companyDomain: "acme.com",
        companySize: "11-50",
        industry: "Software",
        location: "United States",
        firstName: "Dana",
        lastName: "Reed",
        title: "VP Sales",
        linkedinUrl: "https://linkedin.com/in/dana-reed",
      },
    ]);
    expect(calls[0]!.init.headers).toMatchObject({ api_key: "k" });
    const body = JSON.parse(String(calls[0]!.init.body));
    expect(body.size).toBe(5);
    expect(body.filters.job_title.values).toEqual(["vp sales"]);
  });

  it("maps enrichment responses onto enriched prospects", async () => {
    const { impl } = fetchStub({
      "/prospects": {
        data: [
          {
            prospect_id: "ref_1",
            company_name: "Acme",
            emails: [{ email: "dana@acme.com", status: "valid" }],
            phone_numbers: [{ phone_number: "+15555550100", status: "valid" }],
            technologies: ["salesforce"],
            events: [{ event_name: "new_funding_round", event_description: "Series B", event_time: "2026-05-01" }],
          },
        ],
      },
    });
    const source = new ExploriumProspectData({ apiKey: "k", fetchImpl: impl });

    const enriched = await source.enrichProspects(["ref_1"]);

    expect(enriched[0]).toMatchObject({
      externalRef: "ref_1",
      email: "dana@acme.com",
      emailStatus: "valid",
      phone: "+15555550100",
      phoneStatus: "valid",
      technographics: ["salesforce"],
      signals: [{ kind: "new_funding_round", detail: "Series B", observedAt: "2026-05-01" }],
    });
  });

  it("throws a useful error on non-2xx responses without leaking the api key", async () => {
    const impl = (async () => new Response("denied", { status: 401 })) as unknown as typeof fetch;
    const source = new ExploriumProspectData({ apiKey: "secret-key", fetchImpl: impl });

    await expect(source.discoverProspects({}, 1)).rejects.toThrow(/prospect data request failed \(401\)/);
    await expect(source.discoverProspects({}, 1)).rejects.not.toThrow(/secret-key/);
  });
});
