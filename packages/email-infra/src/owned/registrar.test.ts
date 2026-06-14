import { describe, expect, it, vi } from "vitest";
import { InMemoryRegistrar } from "./registrar";

describe("InMemoryRegistrar", () => {
  it("reports availability and records purchases", async () => {
    const r = new InMemoryRegistrar({ taken: ["taken.com"] });
    expect(await r.isAvailable("free.com")).toBe(true);
    expect(await r.isAvailable("taken.com")).toBe(false);
    await r.buy("free.com");
    expect(r.purchased).toContain("free.com");
    await expect(r.buy("taken.com")).rejects.toThrow(/unavailable/);
  });
});

import { CloudflareRegistrar } from "./registrar";

const cfFetch = (body: unknown, ok = true) =>
  vi.fn(async () => ({ ok, status: ok ? 200 : 400, json: async () => body, text: async () => "" })) as unknown as typeof fetch;

describe("CloudflareRegistrar", () => {
  it("isAvailable true when the registrar reports available", async () => {
    const r = new CloudflareRegistrar({ apiToken: "t", accountId: "a", fetchFn: cfFetch({ result: { available: true } }) });
    expect(await r.isAvailable("free.com")).toBe(true);
  });
  it("buy throws on a non-ok response", async () => {
    const r = new CloudflareRegistrar({ apiToken: "t", accountId: "a", fetchFn: cfFetch({ success: false, errors: [{ message: "nope" }] }, false) });
    await expect(r.buy("x.com")).rejects.toThrow(/registrar/i);
  });
});
