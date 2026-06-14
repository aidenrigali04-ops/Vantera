import { describe, expect, it } from "vitest";
import { InMemoryConnector } from "./in-memory";
import type { ClosedDeal, ConnectorCtx } from "./types";

const ctx: ConnectorCtx = { accessToken: "tok", config: {} };

const deal: ClosedDeal = {
  leadId: "lead-1",
  contact: { firstName: "Ada", lastName: "Lovelace", email: "ada@example.com", company: "Analytical" },
  dealValueCents: 500_00,
  closedAt: new Date().toISOString(),
  source: "Vantera",
  config: {},
};

describe("InMemoryConnector", () => {
  it("records a pushed deal and returns an external ref", async () => {
    const c = new InMemoryConnector("hubspot");
    const res = await c.pushClosedDeal(ctx, deal);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.externalRef).toBe("fake-ref-1");
    expect(c.pushed).toHaveLength(1);
  });

  it("failNext flips a single push to a retryable failure", async () => {
    const c = new InMemoryConnector("slack");
    c.failNext = true;
    const fail = await c.pushClosedDeal(ctx, deal);
    expect(fail.ok).toBe(false);
    if (!fail.ok) expect(fail.retryable).toBe(true);
    // next push succeeds again
    const ok = await c.pushClosedDeal(ctx, deal);
    expect(ok.ok).toBe(true);
    expect(c.pushed).toHaveLength(1);
  });

  it("testConnection reports the destination label", async () => {
    const c = new InMemoryConnector("monday");
    const res = await c.testConnection(ctx);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.detail).toContain("Monday");
  });

  it("exchangeCode and refreshToken return token sets", async () => {
    const c = new InMemoryConnector();
    const t = await c.exchangeCode("code-1", "https://redir");
    expect(t.accessToken).toContain("code-1");
    const r = await c.refreshToken("refresh-1");
    expect(r.accessToken).toContain("refresh-1");
  });
});
