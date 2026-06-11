import { describe, expect, it } from "vitest";
import { MockLanguageModelV2 } from "ai/test";
import { htmlToText, isScanStale, scanWebsite } from "./website-scan";

const NOW = new Date("2026-06-11T00:00:00Z");

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

    await expect(scanWebsite("https://acme.com", { model, fetchImpl })).resolves.toEqual(scan);
  });

  it("throws on fetch failure", async () => {
    const fetchImpl = (async () => new Response("nope", { status: 500 })) as unknown as typeof fetch;
    await expect(
      scanWebsite("https://acme.com", { model: new MockLanguageModelV2(), fetchImpl })
    ).rejects.toThrow(/website fetch failed \(500\)/);
  });
});
