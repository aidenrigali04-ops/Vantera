import { describe, expect, it, vi } from "vitest";

// Make the service client blow up so we can prove recordSecurityEvent is best-effort.
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => {
    throw new Error("boom");
  },
}));

import { eventRequestMeta, recordSecurityEvent } from "./audit";

describe("recordSecurityEvent", () => {
  it("never throws even when the client blows up (best-effort)", async () => {
    await expect(recordSecurityEvent({ eventType: "test.event" })).resolves.toBeUndefined();
  });
});

describe("eventRequestMeta", () => {
  it("extracts ip and user-agent", () => {
    const req = new Request("https://x.com", {
      headers: { "x-forwarded-for": "1.2.3.4", "user-agent": "UA/1.0" },
    });
    expect(eventRequestMeta(req)).toEqual({ ip: "1.2.3.4", userAgent: "UA/1.0" });
  });

  it("falls back to 'unknown' user-agent", () => {
    const req = new Request("https://x.com", { headers: { "x-real-ip": "9.9.9.9" } });
    expect(eventRequestMeta(req)).toEqual({ ip: "9.9.9.9", userAgent: "unknown" });
  });
});
