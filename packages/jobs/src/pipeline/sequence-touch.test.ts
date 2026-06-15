import { describe, expect, it, vi } from "vitest";
import { runSequenceTouch } from "./sequence-touch";
import type { SequenceTouchDeps, SequenceTouchDispatch } from "./types";

const NOW = new Date("2026-06-15T00:00:00Z");

const lead = {
  id: "l1",
  firstName: "Sam",
  lastName: "Lee",
  title: "VP",
  companyName: "Acme",
  industry: "saas",
  email: "sam@acme.com",
  linkedinUrl: "https://linkedin.com/in/sam",
  phone: "+15555550100",
  aiInsights: null,
  scoredAt: null as Date | null,
};

function deps(
  over: Partial<SequenceTouchDeps["store"]> = {},
  refreshResult: "ok" | "dropped" = "ok",
  refreshedLeadIds: string[] = []
): SequenceTouchDeps {
  return {
    store: {
      getDraftableLead: async () => lead,
      getCampaignCta: async () => "Book a 15-min call",
      isSuppressed: async () => false,
      insertScheduledSend: vi.fn(async () => {}),
      ...over,
    },
    draftEmailFn: async () => ({ subject: "Hi", body: "hello", styleFlags: null } as never),
    draftLinkedInFn: async () => ({ body: "hey there", styleFlags: null } as never),
    now: () => NOW,
    refreshLead: async (_accountId, leadId) => {
      refreshedLeadIds.push(leadId);
      return refreshResult;
    },
  };
}

const dispatch: SequenceTouchDispatch = {
  runId: "r1",
  accountId: "a1",
  campaignId: "c1",
  leadId: "l1",
  stage: "imessage",
  touchNo: 1,
};

describe("runSequenceTouch", () => {
  it("drafts an iMessage touch via the short-form drafter and records channel imessage", async () => {
    const d = deps();
    const out = await runSequenceTouch(dispatch, d);
    expect(out).toBe("drafted");
    expect(d.store.insertScheduledSend).toHaveBeenCalledWith(
      expect.objectContaining({ channel: "imessage" })
    );
  });

  it("never drafts when the channel value is suppressed", async () => {
    const insert = vi.fn(async () => {});
    const d = deps({ isSuppressed: async () => true, insertScheduledSend: insert });
    const out = await runSequenceTouch(dispatch, d);
    expect(out).toBe("suppressed");
    expect(insert).not.toHaveBeenCalled();
  });

  it("skips when the lead has no value for the channel", async () => {
    const d = deps({ getDraftableLead: async () => ({ ...lead, email: null }) });
    const out = await runSequenceTouch({ ...dispatch, stage: "email" }, d);
    expect(out).toBe("skipped");
  });
});

describe("runSequenceTouch — refresh-on-release (email-only)", () => {
  // scoredAt ~45 days before NOW
  const agedScoredAt = new Date("2026-05-01T00:00:00Z");
  // scoredAt ~2 days before NOW
  const freshScoredAt = new Date("2026-06-13T00:00:00Z");

  const emailDispatch: SequenceTouchDispatch = {
    ...dispatch,
    stage: "email",
  };
  const linkedinDispatch: SequenceTouchDispatch = {
    ...dispatch,
    stage: "linkedin",
  };

  it("calls refreshLead for an aged email lead and drafts when refresh returns ok", async () => {
    const insert = vi.fn(async () => {});
    const refreshedLeadIds: string[] = [];
    const d = deps(
      {
        getDraftableLead: async () => ({ ...lead, scoredAt: agedScoredAt }),
        insertScheduledSend: insert,
      },
      "ok",
      refreshedLeadIds
    );
    const out = await runSequenceTouch(emailDispatch, d);
    expect(refreshedLeadIds).toContain("l1");
    expect(out).toBe("drafted");
  });

  it("returns 'dropped' for an aged email lead when refresh returns dropped — no draft, no suppression write", async () => {
    const insert = vi.fn(async () => {});
    const suppressionStore = vi.fn(async () => false);
    const refreshedLeadIds: string[] = [];
    const d = deps(
      {
        getDraftableLead: async () => ({ ...lead, scoredAt: agedScoredAt }),
        insertScheduledSend: insert,
        isSuppressed: suppressionStore,
      },
      "dropped",
      refreshedLeadIds
    );
    const out = await runSequenceTouch(emailDispatch, d);
    expect(out).toBe("dropped");
    expect(insert).not.toHaveBeenCalled();
    // suppression was checked (the check runs before refresh), but the suppression STORE is
    // never written — isSuppressed only reads; no write path exists in SequenceTouchStore
    // Confirm no draft was inserted
    expect(insert).not.toHaveBeenCalled();
  });

  it("does NOT call refreshLead for a fresh email lead", async () => {
    const refreshedLeadIds: string[] = [];
    const d = deps(
      { getDraftableLead: async () => ({ ...lead, scoredAt: freshScoredAt }) },
      "ok",
      refreshedLeadIds
    );
    await runSequenceTouch(emailDispatch, d);
    expect(refreshedLeadIds).toHaveLength(0);
  });

  it("does NOT call refreshLead for an aged LinkedIn lead (refresh is email-only)", async () => {
    const refreshedLeadIds: string[] = [];
    const d = deps(
      { getDraftableLead: async () => ({ ...lead, scoredAt: agedScoredAt }) },
      "ok",
      refreshedLeadIds
    );
    await runSequenceTouch(linkedinDispatch, d);
    expect(refreshedLeadIds).toHaveLength(0);
  });
});
