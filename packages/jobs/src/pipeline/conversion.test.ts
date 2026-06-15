import { describe, expect, it, vi } from "vitest";
import { markConverted } from "./conversion";
import type { ConversionDeps } from "./types";

function deps(token: string | null): { deps: ConversionDeps; calls: Record<string, ReturnType<typeof vi.fn>> } {
  const calls = {
    setLeadConverted: vi.fn(async () => {}),
    closeSequenceRun: vi.fn(async () => {}),
    cancelPendingSends: vi.fn(async () => 3),
    setCampaignLeadStatus: vi.fn(async () => {}),
    insertLeadNotification: vi.fn(async () => {}),
  };
  return {
    calls,
    deps: { store: {
      resolveConversionToken: async () => token ? { accountId: "a1", leadId: "l1", campaignId: "c1", targetUrl: "https://cal.com/x" } : null,
      ...calls,
    } },
  };
}

describe("markConverted", () => {
  it("converts the lead, closes the run, cancels pending sends, notifies, and returns the redirect", async () => {
    const { deps: d, calls } = deps("tok");
    const r = await markConverted("tok", d);
    expect(r).toEqual({ converted: true, redirectUrl: "https://cal.com/x" });
    expect(calls.setLeadConverted).toHaveBeenCalledWith("l1");
    expect(calls.closeSequenceRun).toHaveBeenCalledWith("c1", "l1");
    expect(calls.cancelPendingSends).toHaveBeenCalledWith("l1");
    expect(calls.setCampaignLeadStatus).toHaveBeenCalledWith("c1", "l1", "completed");
    expect(calls.insertLeadNotification).toHaveBeenCalledWith(expect.objectContaining({ kind: "converted" }));
  });

  it("returns not-converted for an unknown token", async () => {
    const { deps: d } = deps(null);
    expect(await markConverted("bad", d)).toEqual({ converted: false, redirectUrl: null });
  });
});
