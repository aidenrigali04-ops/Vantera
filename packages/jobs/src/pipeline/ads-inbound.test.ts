import { describe, expect, it, vi } from "vitest";
import { runAdInbound } from "./ads-inbound";
import type { AdInboundEvent, AdInboundStore } from "./types";

const event: AdInboundEvent = {
  providerLeadId: "L1",
  campaignRef: "ref-1",
  email: "Jordan@Acme.com",
  firstName: "Jordan",
  companyName: "Acme",
};

function store(over: Partial<AdInboundStore> = {}): AdInboundStore {
  return {
    getAdCampaignByRef: vi.fn(async () => ({ adCampaignId: "ad1", accountId: "acc1", campaignId: "camp1" })),
    isSuppressed: vi.fn(async () => false),
    upsertAdLead: vi.fn(async () => "lead1"),
    ensureCampaignLead: vi.fn(async () => {}),
    setLeadInCampaign: vi.fn(async () => {}),
    ...over,
  };
}

describe("runAdInbound", () => {
  it("skips when there's no email or no campaign ref", async () => {
    expect((await runAdInbound({ ...event, email: null }, { store: store() })).outcome).toBe("skipped");
    expect((await runAdInbound({ ...event, campaignRef: null }, { store: store() })).outcome).toBe("skipped");
  });

  it("skips an unknown campaign ref", async () => {
    const s = store({ getAdCampaignByRef: vi.fn(async () => null) });
    const res = await runAdInbound(event, { store: s });
    expect(res.outcome).toBe("skipped");
    expect(s.upsertAdLead).not.toHaveBeenCalled();
  });

  it("never enrolls a suppressed contact (rule 11)", async () => {
    const s = store({ isSuppressed: vi.fn(async () => true) });
    const res = await runAdInbound(event, { store: s });
    expect(res.outcome).toBe("suppressed");
    expect(s.upsertAdLead).not.toHaveBeenCalled();
  });

  it("creates the ad lead (lowercased email) and enrolls it into nurture", async () => {
    const s = store();
    const res = await runAdInbound(event, { store: s });
    expect(res.outcome).toBe("enrolled");
    expect(res.leadId).toBe("lead1");
    expect(s.upsertAdLead).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: "acc1", email: "jordan@acme.com" })
    );
    expect(s.ensureCampaignLead).toHaveBeenCalledWith("camp1", "lead1", "acc1");
    expect(s.setLeadInCampaign).toHaveBeenCalledWith("lead1");
  });

  it("still records the lead when the ad campaign has no nurture campaign yet", async () => {
    const s = store({
      getAdCampaignByRef: vi.fn(async () => ({ adCampaignId: "ad1", accountId: "acc1", campaignId: null })),
    });
    const res = await runAdInbound(event, { store: s });
    expect(res.outcome).toBe("enrolled");
    expect(s.ensureCampaignLead).not.toHaveBeenCalled();
    expect(s.setLeadInCampaign).not.toHaveBeenCalled();
  });
});
