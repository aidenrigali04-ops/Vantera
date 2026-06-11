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
    aiInsights: {
      pain_points: ["pipeline"],
      triggers: ["hiring"],
      motivations: ["growth"],
      value_angle: "agents",
      aha_moment: "meetings week one",
      summary: "fit",
    },
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

  constructor(channels = { linkedin: true, email: true }) {
    this.context = {
      agent: {
        id: "copy1",
        accountId: "acc1",
        status: "live",
        campaignId: "camp1",
        config: { cta: "book a 15-min intro", channels },
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
  async isSuppressed(_accountId: string, kind: "email" | "linkedin", value: string) {
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
    this.sends.push(send);
  }
  async setLeadStatus(leadId: string, status: string) {
    this.leadStatuses.set(leadId, status);
  }
}

function makeDeps(store: FakeCopyStore): CopyDraftDeps {
  return {
    store,
    draftEmailFn: async () => ({ subject: "subj", body: "email body", violations: [] }),
    draftLinkedInFn: async () => ({
      connectionNote: "note",
      followupMessage: "follow",
      violations: [],
    }),
  };
}

const PAYLOAD = { copyAgentId: "copy1", accountId: "acc1", leadIds: ["l1"] };

describe("runCopyDraft — suppression gate (rule 11)", () => {
  it("a suppressed email lead gets ZERO scheduled_sends rows and is marked suppressed", async () => {
    const store = new FakeCopyStore({ linkedin: false, email: true });
    store.leads = [lead("l1", { email: "Dana@ACME.com" })];
    // suppression entries store lowercased values; the check must match case-insensitively
    store.suppressedValues.add("email:dana@acme.com");

    const summary = await runCopyDraft(PAYLOAD, makeDeps(store));

    expect(store.sends).toHaveLength(0);
    expect(store.campaignLeads.get("l1")).toBe("suppressed");
    expect(store.leadStatuses.has("l1")).toBe(false);
    expect(summary).toMatchObject({ drafted: 0, suppressed: 1 });
  });

  it("a suppressed linkedin profile is matched on the normalized URL", async () => {
    const store = new FakeCopyStore({ linkedin: true, email: false });
    store.leads = [lead("l1", { linkedinUrl: "https://LinkedIn.com/in/Dana-Reed/" })];
    store.suppressedValues.add("linkedin:https://linkedin.com/in/dana-reed");

    const summary = await runCopyDraft(PAYLOAD, makeDeps(store));

    expect(store.sends).toHaveLength(0);
    expect(summary.suppressed).toBe(1);
  });

  it("checks suppression BEFORE drafting: the copy brain is never called for a suppressed lead", async () => {
    const store = new FakeCopyStore({ linkedin: false, email: true });
    store.leads = [lead("l1")];
    store.suppressedValues.add("email:l1@acme.com");
    const deps = makeDeps(store);
    let brainCalled = false;
    deps.draftEmailFn = async () => {
      brainCalled = true;
      return { subject: "s", body: "b", violations: [] };
    };

    await runCopyDraft(PAYLOAD, deps);

    expect(brainCalled).toBe(false);
    expect(store.suppressionLookups).toContain("email:l1@acme.com");
  });

  it("suppression on one channel still drafts the other", async () => {
    const store = new FakeCopyStore({ linkedin: true, email: true });
    store.leads = [lead("l1")];
    store.suppressedValues.add("email:l1@acme.com");

    const summary = await runCopyDraft(PAYLOAD, makeDeps(store));

    expect(store.sends.map((s) => s.channel)).toEqual(["linkedin"]);
    expect(summary).toMatchObject({ drafted: 1, suppressed: 1 });
  });
});

describe("runCopyDraft — drafted queue", () => {
  it("drafts per enabled channel into pending_review and never beyond", async () => {
    const store = new FakeCopyStore();
    store.leads = [lead("l1")];

    const summary = await runCopyDraft(PAYLOAD, makeDeps(store));

    expect(summary.drafted).toBe(2);
    expect(store.sends).toHaveLength(2);
    for (const send of store.sends) {
      expect(send.status).toBe("pending_review");
      expect(send.campaignId).toBe("camp1");
    }
    expect(store.sends.find((s) => s.channel === "email")?.subject).toBe("subj");
    expect(store.sends.find((s) => s.channel === "linkedin")?.body).toBe("note");
    expect(store.campaignLeads.get("l1")).toBe("queued");
    expect(store.leadStatuses.get("l1")).toBe("in_campaign");
  });

  it("respects channel toggles", async () => {
    const store = new FakeCopyStore({ linkedin: false, email: true });
    store.leads = [lead("l1")];

    await runCopyDraft(PAYLOAD, makeDeps(store));

    expect(store.sends.map((s) => s.channel)).toEqual(["email"]);
  });

  it("skips unscored leads (no ai_insights) without drafting", async () => {
    const store = new FakeCopyStore();
    store.leads = [lead("l1", { aiInsights: null })];

    const summary = await runCopyDraft(PAYLOAD, makeDeps(store));

    expect(store.sends).toHaveLength(0);
    expect(summary.skipped).toBe(1);
  });

  it("flags unresolved humanizer violations on the draft row", async () => {
    const store = new FakeCopyStore({ linkedin: false, email: true });
    store.leads = [lead("l1")];
    const deps = makeDeps(store);
    deps.draftEmailFn = async () => ({
      subject: "s",
      body: "b",
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
