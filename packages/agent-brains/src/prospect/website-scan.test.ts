import { describe, expect, it } from "vitest";
import { MockLanguageModelV2 } from "ai/test";
import { htmlToText, isScanStale, scanWebsite } from "./website-scan";

const NOW = new Date("2026-06-11T00:00:00Z");
// Skip the network-resolving SSRF guard in unit tests that inject a mock fetch.
const noValidate = async () => {};

describe("isScanStale", () => {
  it("is stale when never scanned", () => {
    expect(isScanStale(null, null, "https://a.com", NOW)).toBe(true);
  });

  it("is stale when the url changed", () => {
    expect(isScanStale(NOW, "https://old.com", "https://a.com", NOW)).toBe(true);
  });

  it("is stale after 30 days, fresh before", () => {
    const recent = new Date("2026-06-01T00:00:00Z");
    const old = new Date("2026-05-01T00:00:00Z");
    expect(isScanStale(recent, "https://a.com", "https://a.com", NOW)).toBe(false);
    expect(isScanStale(old, "https://a.com", "https://a.com", NOW)).toBe(true);
  });
});

describe("htmlToText", () => {
  it("strips tags, scripts, and entities", () => {
    const html = `<html><script>var x=1;</script><style>.a{}</style><h1>Acme&nbsp;Inc</h1><p>We sell tools.</p></html>`;
    expect(htmlToText(html)).toBe("Acme Inc We sell tools.");
  });
});

describe("scanWebsite", () => {
  const scan = {
    summary: "Acme sells revenue tools to B2B SaaS teams.",
    offerings: ["pipeline analytics"],
    value_props: ["close more deals"],
    scope_of_industry: "B2B SaaS sales tooling",
  };

  it("fetches the page and extracts a structured scan", async () => {
    const fetchImpl = (async () =>
      new Response("<html><p>Acme sells revenue tools.</p></html>", { status: 200 })) as unknown as typeof fetch;
    const model = new MockLanguageModelV2({
      doGenerate: {
        finishReason: "stop",
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        content: [{ type: "text", text: JSON.stringify(scan) }],
        warnings: [],
      },
    });

    await expect(scanWebsite("https://acme.com", { model, fetchImpl, validate: noValidate })).resolves.toEqual(scan);
  });

  it("clamps oversized model output to 5 list items instead of throwing", async () => {
    // real content-rich sites make the model return many items; the schema must not
    // reject them (root cause of the onboarding scan silently failing) — clamp instead.
    const big = {
      summary: "x".repeat(800),
      offerings: Array.from({ length: 16 }, (_, i) => `offering ${i}`),
      value_props: Array.from({ length: 12 }, (_, i) => `value ${i}`),
      scope_of_industry: "y".repeat(400),
    };
    const fetchImpl = (async () =>
      new Response("<html><p>lots of real content here</p></html>", { status: 200 })) as unknown as typeof fetch;
    const model = new MockLanguageModelV2({
      doGenerate: {
        finishReason: "stop",
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        content: [{ type: "text", text: JSON.stringify(big) }],
        warnings: [],
      },
    });

    const result = await scanWebsite("https://acme.com", { model, fetchImpl, validate: noValidate });
    expect(result.offerings).toHaveLength(5);
    expect(result.value_props).toHaveLength(5);
    expect(result.summary.length).toBeLessThanOrEqual(500);
    expect(result.scope_of_industry.length).toBeLessThanOrEqual(200);
  });

  it("throws on fetch failure", async () => {
    const fetchImpl = (async () => new Response("nope", { status: 500 })) as unknown as typeof fetch;
    await expect(
      scanWebsite("https://acme.com", { model: new MockLanguageModelV2(), fetchImpl, validate: noValidate })
    ).rejects.toThrow(/website fetch failed \(500\)/);
  });

  it("refuses an SSRF-blocked URL before fetching (guard is wired in)", async () => {
    let fetched = false;
    const fetchImpl = (async () => {
      fetched = true;
      return new Response("<html></html>", { status: 200 });
    }) as unknown as typeof fetch;
    const validate = async () => {
      throw new Error("URL resolves to a private address");
    };
    await expect(
      scanWebsite("http://169.254.169.254/", { model: new MockLanguageModelV2(), fetchImpl, validate })
    ).rejects.toThrow(/private address/);
    expect(fetched).toBe(false);
  });
});
