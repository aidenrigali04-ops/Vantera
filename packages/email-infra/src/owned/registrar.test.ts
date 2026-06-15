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

import { NameComRegistrar } from "./registrar";

const ncFetch = (body: unknown, ok = true) =>
  vi.fn(async () => ({ ok, status: ok ? 200 : 400, json: async () => body, text: async () => "" })) as unknown as typeof fetch;

describe("NameComRegistrar", () => {
  it("isAvailable true when the registrar reports the name purchasable", async () => {
    const r = new NameComRegistrar({
      username: "u", token: "t",
      fetchFn: ncFetch({ results: [{ domainName: "free.com", purchasable: true, purchasePrice: 12.99 }] }),
    });
    expect(await r.isAvailable("free.com")).toBe(true);
  });

  it("buy checks availability then registers via POST /v4/domains with the quoted price", async () => {
    const calls: Array<[string, RequestInit | undefined]> = [];
    const fetchFn = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push([url, init]);
      return { ok: true, status: 200, json: async () => ({ results: [{ domainName: "buy.com", purchasable: true, purchasePrice: 11.5 }] }), text: async () => "" };
    }) as unknown as typeof fetch;
    const r = new NameComRegistrar({ username: "u", token: "t", fetchFn });
    await r.buy("buy.com");

    expect(calls.some(([u]) => u.includes("/v4/domains:checkAvailability"))).toBe(true);
    const register = calls.find(([u, init]) => init?.method === "POST" && u.endsWith("/v4/domains"));
    expect(register).toBeDefined();
    expect(JSON.parse(register![1]!.body as string)).toMatchObject({ domain: { domainName: "buy.com" }, purchasePrice: 11.5 });
  });

  it("buy throws when the name is not purchasable", async () => {
    const r = new NameComRegistrar({
      username: "u", token: "t",
      fetchFn: ncFetch({ results: [{ domainName: "taken.com", purchasable: false }] }),
    });
    await expect(r.buy("taken.com")).rejects.toThrow(/unavailable/);
  });
});
