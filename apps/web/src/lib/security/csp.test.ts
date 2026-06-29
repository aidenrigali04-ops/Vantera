import { describe, expect, it } from "vitest";
import { buildCsp } from "./csp";

describe("buildCsp", () => {
  const csp = buildCsp("abc123");

  it("embeds the nonce in script-src with strict-dynamic, no unsafe-inline scripts", () => {
    expect(csp).toContain("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
  });

  it("locks down the dangerous directives", () => {
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("base-uri 'self'");
  });

  it("points reports at the collector", () => {
    expect(csp).toContain("report-uri /api/csp-report");
  });

  it("allows Google Analytics endpoints in connect-src so GA4 event beacons aren't blocked", () => {
    const connectSrc = csp.split(";").find((d) => d.trim().startsWith("connect-src")) ?? "";
    expect(connectSrc).toContain("https://*.google-analytics.com");
    expect(connectSrc).toContain("https://*.analytics.google.com");
    expect(connectSrc).toContain("https://www.googletagmanager.com");
  });
});
