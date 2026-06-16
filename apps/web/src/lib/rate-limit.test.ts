import { describe, expect, it } from "vitest";
import { checkLimit, clientIp, rateLimitResponse } from "./rate-limit";

describe("rate-limit", () => {
  it("checkLimit is a no-op success when Upstash is unconfigured", async () => {
    // UPSTASH_* are unset in the test env → fail-open so dev never blocks.
    const r = await checkLimit("copilot", "user-123");
    expect(r.success).toBe(true);
  });

  it("rateLimitResponse returns null when allowed", () => {
    expect(rateLimitResponse({ success: true, limit: 10, remaining: 9, reset: 0 })).toBeNull();
  });

  it("rateLimitResponse returns 429 with a Retry-After header when blocked", () => {
    const res = rateLimitResponse({ success: false, limit: 10, remaining: 0, reset: Date.now() + 5000 });
    expect(res).not.toBeNull();
    expect(res!.status).toBe(429);
    const retry = Number(res!.headers.get("Retry-After"));
    expect(retry).toBeGreaterThanOrEqual(1);
    expect(retry).toBeLessThanOrEqual(6);
  });

  it("clientIp prefers the first x-forwarded-for hop", () => {
    const req = new Request("https://x.com", { headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" } });
    expect(clientIp(req)).toBe("1.2.3.4");
  });

  it("clientIp falls back to x-real-ip, then 'unknown'", () => {
    expect(clientIp(new Request("https://x.com", { headers: { "x-real-ip": "9.9.9.9" } }))).toBe("9.9.9.9");
    expect(clientIp(new Request("https://x.com"))).toBe("unknown");
  });
});
