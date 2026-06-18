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
    expect(body.mode).toBe("full");
    expect(body.size).toBe(5);
    expect(body.page_size).toBe(5); // required by /v1/prospects — its omission was the 422
    // titles collapse onto the verified job_level enum; "vp sales" → "vice president"
    expect(body.filters.job_level.values).toEqual(["vice president"]);
    expect(body.filters.company_country_code.values).toEqual(["US"]); // default
    // industries are NOT sent — no supported free-text industry filter key
    expect(body.filters.company_industry).toBeUndefined();
    expect(body.filters.job_title).toBeUndefined();
  });

  it("maps ICP filters onto the live-verified discovery contract (keys + enums)", async () => {
    const { impl, calls } = fetchStub({ "/prospects": { data: [] } });
    const source = new ExploriumProspectData({ apiKey: "k", fetchImpl: impl });

    await source.discoverProspects(
      {
        titles: ["VP of Sales"],
        seniorities: ["director"],
        companySizes: ["11-50", "200"],
        geos: ["united states", "canada"],
        industries: ["fintech"], // → linkedin_category (mapped to the LinkedIn taxonomy)
        techStack: ["salesforce"], // dropped
        signals: ["funding"], // dropped
      },
      50
    );

    const body = JSON.parse(String(calls[0]!.init.body));
    expect(body.page_size).toBe(50);
    expect(body.filters.job_level.values).toEqual(expect.arrayContaining(["vice president", "director"]));
    expect(body.filters.company_size.values).toEqual(["11-50", "51-200"]); // "200" bins to 51-200
    expect(body.filters.company_country_code.values).toEqual(["US", "CA"]);
    // industry maps onto the verified LinkedIn taxonomy (raw free-text would 422)
    expect(body.filters.linkedin_category.values).toEqual(["financial services"]);
    // unsupported keys never leave the adapter — each would 422 or silently return 0
    for (const k of ["company_industry", "company_technologies", "events"]) {
      expect(body.filters[k]).toBeUndefined();
    }
  });

  it("maps ICP industries onto verified LinkedIn categories, and drops unmappable ones (no 422)", async () => {
    const { impl, calls } = fetchStub({ "/prospects": { data: [] } });
    const source = new ExploriumProspectData({ apiKey: "k", fetchImpl: impl });

    await source.discoverProspects({ industries: ["software", "AI", "marketing agency"] }, 5);
    const body = JSON.parse(String(calls[0]!.init.body));
    expect(body.filters.linkedin_category.values).toEqual(
      expect.arrayContaining(["software development", "technology, information and internet", "marketing services", "advertising services"])
    );

    // a fully-unmappable ICP sends no industry filter at all (falls back to broad, never errors)
    const { impl: impl2, calls: calls2 } = fetchStub({ "/prospects": { data: [] } });
    await new ExploriumProspectData({ apiKey: "k", fetchImpl: impl2 }).discoverProspects(
      { industries: ["underwater basket weaving"] },
      5
    );
    expect(JSON.parse(String(calls2[0]!.init.body)).filters.linkedin_category).toBeUndefined();
  });

  it("defaults job_level to the full decision-maker spread (incl. VP + director) for a title-less ICP", async () => {
    const { impl, calls } = fetchStub({ "/prospects": { data: [] } });
    const source = new ExploriumProspectData({ apiKey: "k", fetchImpl: impl });

    await source.discoverProspects({ companySizes: ["51-200"] }, 5);

    const body = JSON.parse(String(calls[0]!.init.body));
    expect(body.filters.job_level.values).toEqual(
      expect.arrayContaining(["owner", "founder", "c-suite", "vice president", "director"])
    );
  });

  it("enriches via the contacts_information bulk_enrich path (contacts only when no businessId)", async () => {
    const { impl, calls } = fetchStub({ "/prospects/contacts_information/bulk_enrich": { data: [] } });
    const source = new ExploriumProspectData({ apiKey: "k", fetchImpl: impl });

    await source.enrichProspects([{ externalRef: "ref_1" }]);

    expect(calls).toHaveLength(1); // no businessId → firmographics endpoint not called
    expect(calls[0]!.url).toContain("/prospects/contacts_information/bulk_enrich");
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({ prospect_ids: ["ref_1"] });
  });

  it("joins the nested contacts payload with firmographics (by business_id) onto enriched prospects", async () => {
    const { impl, calls } = fetchStub({
      "/prospects/contacts_information/bulk_enrich": {
        data: [
          {
            prospect_id: "ref_1",
            data: {
              emails: [
                { address: "dana.personal@gmail.com", type: "personal" },
                { address: "dana@acme.com", type: "current_professional" },
              ],
              professions_email: "dana@acme.com",
              professional_email_status: "valid",
              phone_numbers: [{ phone_number: "+15555550100" }],
              mobile_phone: "+15555550100",
            },
          },
        ],
      },
      "/businesses/firmographics/bulk_enrich": {
        data: [
          {
            business_id: "biz_1",
            data: {
              name: "Acme",
              website: "https://acme.com",
              linkedin_industry_category: "software development",
              number_of_employees_range: "11-50",
              country_name: "united states",
            },
          },
        ],
      },
    });
    const source = new ExploriumProspectData({ apiKey: "k", fetchImpl: impl });

    const enriched = await source.enrichProspects([{ externalRef: "ref_1", businessId: "biz_1" }]);

    // both endpoints are hit; firmographics is keyed by the unique business_ids
    const firmoCall = calls.find((c) => c.url.includes("/businesses/firmographics/bulk_enrich"));
    expect(firmoCall).toBeDefined();
    expect(JSON.parse(String(firmoCall!.init.body))).toEqual({ business_ids: ["biz_1"] });

    expect(enriched[0]).toMatchObject({
      externalRef: "ref_1",
      companyName: "Acme",
      email: "dana@acme.com",
      emailStatus: "valid",
      phone: "+15555550100",
      phoneStatus: "valid",
      industry: "software development",
      companySize: "11-50",
    });
  });

  it("rolls company events (output_events shape) into per-business signals, real title preferred", async () => {
    const { impl } = fetchStub({
      "/prospects/contacts_information/bulk_enrich": { data: [{ prospect_id: "ref_1", data: {} }] },
      "/businesses/firmographics/bulk_enrich": { data: [{ business_id: "biz_1", data: { name: "Acme" } }] },
      "/businesses/events": {
        output_events: [
          {
            business_id: "biz_1",
            event_name: "new_funding_round",
            event_time: "2026-06-01",
            data: { title: "Acme raises $40M Series B", snippet: "Series B led by Acme Capital" },
          },
          {
            business_id: "biz_1",
            event_name: "new_product",
            event_time: "2026-05-20",
            data: { title: "Acme launches Copilot" },
          },
        ],
      },
    });
    const source = new ExploriumProspectData({ apiKey: "k", fetchImpl: impl });

    const [enriched] = await source.enrichProspects([{ externalRef: "ref_1", businessId: "biz_1" }]);

    expect(enriched!.signals).toEqual([
      // label prefers the event's real title; detail falls back to title when no snippet
      { kind: "funding", label: "Acme raises $40M Series B", detail: "Series B led by Acme Capital", observedAt: "2026-06-01" },
      { kind: "product_launch", label: "Acme launches Copilot", detail: "Acme launches Copilot", observedAt: "2026-05-20" },
    ]);
  });

  it("maps the canonical AgentSource event_name tokens to the right kinds", async () => {
    const evt = (event_name: string) => ({ business_id: "biz_1", event_name, event_time: "2026-06-01" });
    const { impl } = fetchStub({
      "/prospects/contacts_information/bulk_enrich": { data: [{ prospect_id: "ref_1", data: {} }] },
      "/businesses/firmographics/bulk_enrich": { data: [{ business_id: "biz_1", data: { name: "Acme" } }] },
      "/businesses/events": {
        output_events: [
          evt("new_funding_round"),
          evt("new_product"),
          evt("closing_office"),
          evt("merger_and_acquisitions"),
          evt("cost_cutting"),
          evt("hiring_in_sales_department"),
          evt("increase_in_all_departments"),
          evt("outages_and_security_breaches"),
          evt("lawsuits_and_legal_issues"),
        ],
      },
    });
    const source = new ExploriumProspectData({ apiKey: "k", fetchImpl: impl });

    const [enriched] = await source.enrichProspects([{ externalRef: "ref_1", businessId: "biz_1" }]);
    expect(enriched!.signals?.map((s) => s.kind)).toEqual([
      "funding",
      "product_launch",
      "office_closing",
      "m_and_a",
      "cost_cutting",
      "hiring",
      "workforce",
      "security",
      "legal",
    ]);
  });

  it("sends the required event_types in the events request body", async () => {
    const { impl, calls } = fetchStub({
      "/prospects/contacts_information/bulk_enrich": { data: [{ prospect_id: "ref_1", data: {} }] },
      "/businesses/firmographics/bulk_enrich": { data: [{ business_id: "biz_1", data: { name: "Acme" } }] },
      "/businesses/events": { output_events: [] },
    });
    await new ExploriumProspectData({ apiKey: "k", fetchImpl: impl }).enrichProspects([
      { externalRef: "ref_1", businessId: "biz_1" },
    ]);
    const eventsCall = calls.find((c) => c.url.includes("/businesses/events"));
    expect(eventsCall).toBeDefined();
    const body = JSON.parse(String(eventsCall!.init.body));
    expect(body.business_ids).toEqual(["biz_1"]);
    expect(Array.isArray(body.event_types) && body.event_types.length).toBeTruthy();
    expect(body.event_types).toContain("new_funding_round");
  });

  it("degrades gracefully when the events endpoint fails (no signals, core enrichment intact)", async () => {
    // events is NOT stubbed → 404 → postSafeJson returns null; contacts/firmographics still resolve.
    const { impl } = fetchStub({
      "/prospects/contacts_information/bulk_enrich": {
        data: [{ prospect_id: "ref_1", data: { professions_email: "dana@acme.com", professional_email_status: "valid" } }],
      },
      "/businesses/firmographics/bulk_enrich": { data: [{ business_id: "biz_1", data: { name: "Acme" } }] },
    });
    const source = new ExploriumProspectData({ apiKey: "k", fetchImpl: impl });

    const [enriched] = await source.enrichProspects([{ externalRef: "ref_1", businessId: "biz_1" }]);

    expect(enriched!.email).toBe("dana@acme.com");
    expect(enriched!.signals).toBeUndefined();
  });

  it("throws a useful error on non-2xx responses without leaking the api key", async () => {
    const impl = (async () => new Response("denied", { status: 401 })) as unknown as typeof fetch;
    const source = new ExploriumProspectData({ apiKey: "secret-key", fetchImpl: impl });

    await expect(source.discoverProspects({}, 1)).rejects.toThrow(/prospect data request failed \(401\)/);
    await expect(source.discoverProspects({}, 1)).rejects.not.toThrow(/secret-key/);
  });
});
