import { describe, expect, it } from "vitest";
import { normalizeLinkedInUrl, runCopyDraft } from "./copy-draft";
import type {
  CopyContext,
  CopyDraftDeps,
  CopyDraftStore,
  DraftableLead,
  NewScheduledSend,
} from "./types";

function lead(id: string, overrides: Partial<DraftableLead> = {}): DraftableLead {
  return {
    id,
    firstName: "Dana",
    lastName: "Reed",
    title: "VP Sales",
    companyName: "Acme",
    industry: "saas",
    email: `${id}@acme.com`,
    linkedinUrl: `https://linkedin.com/in/${id}`,
    phone: null,
    aiInsights: {
      pain_points: ["pipeline"],
      triggers: ["hiring"],
      motivations: ["growth"],
      value_angle: "agents",
      aha_moment: "meetings week one",
      summary: "fit",
    },
    scoredAt: null,
    ...overrides,
  };
}

class FakeCopyStore implements CopyDraftStore {
  context: CopyContext;
  leads: DraftableLead[] = [];
  /** suppression list: `${kind}:${value}` — values stored lowercased per rule 11 */
  suppressedValues = new Set<string>();
  sends: NewScheduledSend[] = [];
  campaignLeads = new Map<string, string>();
  leadStatuses = new Map<string, string>();
  suppressionLookups: string[] = [];
  /** tracks which store method was used per LinkedIn draft: 'pair' or 'single' */
  linkedInCallKinds: ("pair" | "single")[] = [];

  constructor(channels = { linkedin: true }, sendMode: "review" | "automatic" = "review") {
    this.context = {
      agent: {
        id: "copy1",
        accountId: "acc1",
        status: "live",
        campaignId: "camp1",
        config: { cta: "book a 15-min intro", channels },
        sendMode,
      },
      assets: [{ kind: "link", url: "https://acme.com/case-study", filename: null }],
      account: { industry: "devtools", websiteScan: null },
    };
  }
  async getCopyContext() {
    return this.context;
  }
  async getDraftableLeads() {
    return this.leads;
  }
  async isSuppressed(_accountId: string, kind: "linkedin", value: string) {
    this.suppressionLookups.push(`${kind}:${value}`);
    return this.suppressedValues.has(`${kind}:${value}`);
  }
  async ensureCampaignLead(_campaignId: string, leadId: string) {
    this.campaignLeads.set(leadId, "pending");
  }
  async setCampaignLeadStatus(_campaignId: string, leadId: string, status: string) {
    this.campaignLeads.set(leadId, status);
  }
  async insertScheduledSend(send: NewScheduledSend) {
    this.linkedInCallKinds.push("single");
    this.sends.push(send);
  }
  async insertLinkedInSendPair(invite: NewScheduledSend, message: NewScheduledSend) {
    this.linkedInCallKinds.push("pair");
    this.sends.push(invite, message);
  }
  async setLeadStatus(leadId: string, status: string) {
    this.leadStatuses.set(leadId, status);
  }
}

function makeDeps(store: FakeCopyStore): CopyDraftDeps {
  return {
    store,
    draftLinkedInFn: async () => ({
      connectionNote: "note",
      followupMessage: "follow",
      violations: [],
    }),
  };
}

const PAYLOAD = { copyAgentId: "copy1", accountId: "acc1", leadIds: ["l1"] };

describe("runCopyDraft — suppression gate (rule 11)", () => {
  it("a suppressed linkedin profile is matched on the normalized URL and gets ZERO rows", async () => {
    const store = new FakeCopyStore();
    store.leads = [lead("l1", { linkedinUrl: "https://LinkedIn.com/in/Dana-Reed/" })];
    store.suppressedValues.add("linkedin:https://linkedin.com/in/dana-reed");

    const summary = await runCopyDraft(PAYLOAD, makeDeps(store));

    expect(store.sends).toHaveLength(0);
    expect(store.campaignLeads.get("l1")).toBe("suppressed");
    expect(store.leadStatuses.has("l1")).toBe(false);
    expect(summary).toMatchObject({ drafted: 0, suppressed: 1 });
  });

  it("checks suppression BEFORE drafting: the copy brain is never called for a suppressed lead", async () => {
    const store = new FakeCopyStore();
    store.leads = [lead("l1")];
    store.suppressedValues.add("linkedin:https://linkedin.com/in/l1");
    const deps = makeDeps(store);
    let brainCalled = false;
    deps.draftLinkedInFn = async () => {
      brainCalled = true;
      return { connectionNote: "n", followupMessage: "f", violations: [] };
    };

    await runCopyDraft(PAYLOAD, deps);

    expect(brainCalled).toBe(false);
    expect(store.suppressionLookups).toContain("linkedin:https://linkedin.com/in/l1");
  });
});

describe("runCopyDraft — drafted queue", () => {
  it("drafts the LinkedIn invite+message pair into pending_review (default review mode)", async () => {
    const store = new FakeCopyStore();
    store.leads = [lead("l1")];

    const summary = await runCopyDraft(PAYLOAD, makeDeps(store));

    expect(summary.drafted).toBe(1);
    expect(store.sends).toHaveLength(2);
    for (const send of store.sends) {
      expect(send.status).toBe("pending_review");
      expect(send.campaignId).toBe("camp1");
      expect(send.channel).toBe("linkedin");
    }
    expect(store.sends.find((s) => s.linkedinStage === "invite")?.body).toBe("note");
    expect(store.sends.find((s) => s.linkedinStage === "message")?.body).toBe("follow");
    expect(store.campaignLeads.get("l1")).toBe("queued");
    expect(store.leadStatuses.get("l1")).toBe("in_campaign");
  });

  it("skips a lead with no LinkedIn URL", async () => {
    const store = new FakeCopyStore();
    store.leads = [lead("l1", { linkedinUrl: null })];

    const summary = await runCopyDraft(PAYLOAD, makeDeps(store));

    expect(store.sends).toHaveLength(0);
    expect(summary.skipped).toBe(1);
  });

  it("skips unscored leads (no ai_insights) without drafting", async () => {
    const store = new FakeCopyStore();
    store.leads = [lead("l1", { aiInsights: null })];

    const summary = await runCopyDraft(PAYLOAD, makeDeps(store));

    expect(store.sends).toHaveLength(0);
    expect(summary.skipped).toBe(1);
  });

  it("flags unresolved humanizer violations on the draft rows", async () => {
    const store = new FakeCopyStore();
    store.leads = [lead("l1")];
    const deps = makeDeps(store);
    deps.draftLinkedInFn = async () => ({
      connectionNote: "note",
      followupMessage: "follow",
      violations: [{ rule: "banned-phrase", detail: 'remove "game-changer"' }],
    });

    await runCopyDraft(PAYLOAD, deps);

    expect(store.sends[0]!.styleFlags).toContain("banned-phrase");
  });

  it("skips when the agent is not live or has no campaign", async () => {
    const store = new FakeCopyStore();
    store.context.agent.status = "paused";
    expect((await runCopyDraft(PAYLOAD, makeDeps(store))).status).toBe("skipped");
  });
});

describe("normalizeLinkedInUrl", () => {
  it("lowercases and strips trailing slashes", () => {
    expect(normalizeLinkedInUrl("https://LinkedIn.com/in/Dana-Reed/")).toBe(
      "https://linkedin.com/in/dana-reed"
    );
  });
});

describe("runCopyDraft — LinkedIn invite+message pair", () => {
  it("uses insertLinkedInSendPair (not two single inserts) for the LinkedIn pair", async () => {
    const store = new FakeCopyStore();
    store.leads = [lead("l1")];

    await runCopyDraft(PAYLOAD, makeDeps(store));

    expect(store.linkedInCallKinds).toEqual(["pair"]);
    expect(store.sends).toHaveLength(2);
  });

  it("inserts an invite AND a message row per LinkedIn lead", async () => {
    const store = new FakeCopyStore();
    store.leads = [lead("l1")];
    const deps = makeDeps(store);
    deps.draftLinkedInFn = async () => ({
      connectionNote: "note",
      followupMessage: "follow-up",
      violations: [],
    });

    await runCopyDraft(PAYLOAD, deps);

    const linkedinSends = store.sends.filter((s) => s.channel === "linkedin");
    expect(linkedinSends).toHaveLength(2);
    expect(linkedinSends.map((s) => s.linkedinStage)).toEqual(["invite", "message"]);
    expect(linkedinSends.find((s) => s.linkedinStage === "invite")?.body).toBe("note");
    expect(linkedinSends.find((s) => s.linkedinStage === "message")?.body).toBe("follow-up");
    // both rows share the same status and styleFlags
    expect(linkedinSends[0]!.status).toBe(linkedinSends[1]!.status);
    expect(linkedinSends[0]!.styleFlags).toBe(linkedinSends[1]!.styleFlags);
  });

  it("automatic mode inserts clean drafts as approved", async () => {
    const store = new FakeCopyStore({ linkedin: true }, "automatic");
    store.leads = [lead("l1")];
    const deps = makeDeps(store);
    deps.draftLinkedInFn = async () => ({
      connectionNote: "note",
      followupMessage: "follow-up",
      violations: [],
    });

    await runCopyDraft(PAYLOAD, deps);

    expect(store.sends.length).toBeGreaterThan(0);
    for (const send of store.sends) {
      expect(send.status).toBe("approved");
    }
  });

  it("automatic mode still routes style-flagged drafts to review", async () => {
    const store = new FakeCopyStore({ linkedin: true }, "automatic");
    store.leads = [lead("l1")];
    const deps = makeDeps(store);
    deps.draftLinkedInFn = async () => ({
      connectionNote: "note",
      followupMessage: "follow-up",
      violations: [{ rule: "banned-phrase", detail: 'remove "game-changer"' }],
    });

    await runCopyDraft(PAYLOAD, deps);

    for (const send of store.sends) {
      expect(send.status).toBe("pending_review");
    }
  });
});
