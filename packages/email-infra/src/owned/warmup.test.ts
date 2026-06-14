import { describe, expect, it, vi } from "vitest";
import { InMemoryWarmup } from "./warmup";

describe("InMemoryWarmup", () => {
  it("enrolls a mailbox and reports warming then ready", async () => {
    const w = new InMemoryWarmup();
    await w.enroll("sdr0@acme.com");
    expect(await w.status("sdr0@acme.com")).toEqual({ phase: "warming", dailyCap: 10 });
    w.markReady("sdr0@acme.com", 50);
    expect(await w.status("sdr0@acme.com")).toEqual({ phase: "ready", dailyCap: 50 });
  });
});

import { ApiWarmup } from "./warmup";

describe("ApiWarmup", () => {
  it("maps a ready status payload to a snapshot", async () => {
    const fetchFn = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ state: "ready", daily_limit: 45 }), text: async () => "" })) as unknown as typeof fetch;
    const w = new ApiWarmup({ apiKey: "k", fetchFn });
    expect(await w.status("sdr0@acme.com")).toEqual({ phase: "ready", dailyCap: 45 });
  });
});
