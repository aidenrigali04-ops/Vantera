import { describe, expect, it, vi } from "vitest";
import { normalizeLinkedInUrl, runCopyDraft, MAX_BEST_OF_N } from "./copy-draft";
import type {
  CopyContext,
  CopyDraftDeps,
  CopyDraftStore,
  DraftableLead,
  NewScheduledSend,
} from "./types";
import { LINKEDIN_SYSTEM, LINKEDIN_NOTE_SYSTEM, LINKEDIN_PAIR_MESSAGE_TYPE, buildTargetingProfile, leadBlock, rankByTilt, type CopyStrategy, type DraftInput, type JudgeFn, type LeadOutcomeFlags } from "@vantera/agent-brains";
import { getModelId } from "@vantera/ai";

/** The follow-up part of the labeled pair the best-of-N judge reads (linkedinJudgeText). */
function followupOf(judgeText: string): string {
  return judgeText.split("Follow-up:\n")[1] ?? judgeText;
}

function scored(id: string, score: number): DraftableLead {
  return lead(id, { aiScore: score });
}

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
    aiScore: null,
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
  // Playbook champion — defaults to an empty playbook.
  champion: { strategy: CopyStrategy; version: number | null } = { strategy: {}, version: null };

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
      account: { industry: "devtools", websiteScan: null, valueProp: null, brandVoice: null, guardrails: null },
      avoidPhrases: [],
      winningOpeners: [],
    };
  }
  async getCopyContext() {
    return this.context;
  }
  async getDraftableLeads() {
    return this.leads;
  }
  async leadsWithExistingSends() {
    return new Set<string>();
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
  targetingProfile = buildTargetingProfile([]);
  async rankLeadIds(_accountId: string, leadIds: string[]) {
    const byId = new Map(this.leads.map((l) => [l.id, l]));
    const known = leadIds.map((id) => byId.get(id)).filter((l): l is DraftableLead => !!l);
    return rankByTilt(known, this.targetingProfile).map((l) => l.id);
  }
  async getChampion() {
    return this.champion;
  }
  // Task 3: only the thin trigger reads this (the core reads deps.bestOfN directly) — present
  // solely to satisfy CopyDraftStore; no test below depends on its value.
  async getBestOfN() {
    return 1;
  }
  firstTouchDraftsToday = 0;
  async countFirstTouchDraftsSince() {
    return this.firstTouchDraftsToday;
  }
  // Message-shape selector: only the thin trigger reads this (the core reads deps.messageShapeAuto
  // directly) — present solely to satisfy CopyDraftStore.
  async getMessageShapeAuto() {
    return false;
  }
}

/** Conversation intelligence off: today's pair path. The note brain must never run here. */
const OFF_MODE = {
  conversationMode: "off" as const,
  draftLinkedInNoteFn: async (): Promise<never> => {
    throw new Error("note brain must not run when conversation_policy is off");
  },
};

function makeDeps(store: FakeCopyStore): CopyDraftDeps {
  return {
    ...OFF_MODE,
    store,
    draftLinkedInFn: async () => ({
      connectionNote: "note",
      followupMessage: "follow",
      violations: [],
    }),
  };
}

const PAYLOAD = { copyAgentId: "copy1", accountId: "acc1", leadIds: ["l1"] };

describe("runCopyDraft — seller positioning (0061)", () => {
  const fullScan = {
    headline: "",
    summary: "Scanned.",
    offerings: [],
    value_props: [],
    scope_of_industry: "",
    suggested_icp: "",
  };

  async function captureContext(store: FakeCopyStore): Promise<DraftInput["context"] | null> {
    const deps = makeDeps(store);
    let seen: DraftInput["context"] | null = null;
    deps.draftLinkedInFn = async (input) => {
      seen = input.context;
      return { connectionNote: "note", followupMessage: "follow", violations: [] };
    };
    await runCopyDraft(PAYLOAD, deps);
    return seen;
  }

  it("prefers the seller's authored value prop over the scan summary", async () => {
    const store = new FakeCopyStore();
    store.context.account = { industry: "devtools", websiteScan: fullScan, valueProp: "Authored offer.", brandVoice: null, guardrails: null };
    store.leads = [lead("l1")];
    const ctx = await captureContext(store);
    expect(ctx?.valueProp).toBe("Authored offer.");
  });

  it("falls back to the scan summary when value_prop is null (no regression)", async () => {
    const store = new FakeCopyStore();
    store.context.account = { industry: "devtools", websiteScan: fullScan, valueProp: null, brandVoice: null, guardrails: null };
    store.leads = [lead("l1")];
    const ctx = await captureContext(store);
    expect(ctx?.valueProp).toBe("Scanned.");
  });

  it("passes brand voice + guardrails through to the draft context", async () => {
    const store = new FakeCopyStore();
    store.context.account = { industry: "devtools", websiteScan: null, valueProp: null, brandVoice: "warm, direct", guardrails: "never claim SOC 2" };
    store.leads = [lead("l1")];
    const ctx = await captureContext(store);
    expect(ctx?.brandVoice).toBe("warm, direct");
    expect(ctx?.guardrails).toBe("never claim SOC 2");
  });
});

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

  it("automatic mode: a flagged pair gets one fix pass, and a clean fix auto-approves the fixed copy", async () => {
    const store = new FakeCopyStore({ linkedin: true }, "automatic");
    store.leads = [lead("l1")];
    const deps = makeDeps(store);
    deps.draftLinkedInFn = async () => ({
      connectionNote: "salesy note",
      followupMessage: "salesy follow-up",
      violations: [{ rule: "banned-phrase", detail: 'remove "game-changer"' }],
    });
    const fixFn = vi.fn(async () => ({
      connectionNote: "clean note",
      followupMessage: "clean follow-up",
      violations: [],
    }));
    deps.fixLinkedInFn = fixFn;

    await runCopyDraft(PAYLOAD, deps);

    expect(fixFn).toHaveBeenCalledOnce();
    expect(store.sends.map((x) => x.body).sort()).toEqual(["clean follow-up", "clean note"]);
    for (const send of store.sends) {
      expect(send.status).toBe("approved");
      expect(send.styleFlags).toBeNull();
    }
  });

  it("automatic mode: a still-flagged fix waits in review with its flags (never silent-sends)", async () => {
    const store = new FakeCopyStore({ linkedin: true }, "automatic");
    store.leads = [lead("l1")];
    const deps = makeDeps(store);
    deps.draftLinkedInFn = async () => ({
      connectionNote: "salesy note",
      followupMessage: "salesy follow-up",
      violations: [{ rule: "banned-phrase", detail: 'remove "game-changer"' }],
    });
    deps.fixLinkedInFn = async () => ({
      connectionNote: "still salesy",
      followupMessage: "still salesy follow-up",
      violations: [{ rule: "banned-phrase", detail: 'remove "seamless"' }],
    });

    await runCopyDraft(PAYLOAD, deps);

    for (const send of store.sends) {
      expect(send.status).toBe("pending_review");
      expect(send.styleFlags).toContain("banned-phrase");
    }
  });

  it("review mode: the fix pass is not spent — flags go straight to the queue's Fix button", async () => {
    const store = new FakeCopyStore({ linkedin: true }, "review");
    store.leads = [lead("l1")];
    const deps = makeDeps(store);
    deps.draftLinkedInFn = async () => ({
      connectionNote: "salesy note",
      followupMessage: "salesy follow-up",
      violations: [{ rule: "banned-phrase", detail: 'remove "game-changer"' }],
    });
    const fixFn = vi.fn(async () => ({ connectionNote: "unused", followupMessage: "unused", violations: [] }));
    deps.fixLinkedInFn = fixFn;

    await runCopyDraft(PAYLOAD, deps);

    expect(fixFn).not.toHaveBeenCalled();
    for (const send of store.sends) {
      expect(send.status).toBe("pending_review");
    }
  });
});

// ── Phase 3: experiment strategy plumbing ────────────────────────────────────
function makeCapturingDeps(store: FakeCopyStore): { deps: CopyDraftDeps; inputs: DraftInput[] } {
  const inputs: DraftInput[] = [];
  return {
    inputs,
    deps: {
      ...OFF_MODE,
      store,
      draftLinkedInFn: async (input) => {
        inputs.push(input);
        return { connectionNote: "note", followupMessage: "follow", violations: [] };
      },
    },
  };
}

describe("runCopyDraft — playbook champion", () => {
  it("empty playbook: no strategy directives", async () => {
    const store = new FakeCopyStore();
    store.leads = [lead("l1")];
    const { deps, inputs } = makeCapturingDeps(store);
    await runCopyDraft(PAYLOAD, deps);
    expect(inputs[0]!.context.strategy).toEqual({});
  });

  it("applies the playbook champion strategy to every lead", async () => {
    const store = new FakeCopyStore();
    store.leads = [lead("l1"), lead("l2")];
    store.champion = { strategy: { openWith: "trigger" }, version: 1 };
    const { deps, inputs } = makeCapturingDeps(store);
    await runCopyDraft(PAYLOAD, deps);
    expect(inputs.map((i) => i.context.strategy)).toEqual([{ openWith: "trigger" }, { openWith: "trigger" }]);
  });
});

// ── Stage 1: message-level recipe attribution ────────────────────────────────
describe("runCopyDraft — recipe stamp (Stage 1)", () => {
  it("stamps both rows of the pair with the first-touch recipe (playbook champion)", async () => {
    const store = new FakeCopyStore();
    store.leads = [lead("l1")];
    store.champion = { strategy: { openWith: "trigger" }, version: 2 };
    store.context.winningOpeners = ["Saw the Series B announcement"];
    await runCopyDraft(PAYLOAD, makeDeps(store));
    expect(store.sends).toHaveLength(2);
    for (const row of store.sends) {
      expect(row.recipe).toEqual({
        v: 2,
        brain: "first_touch",
        strategy: { openWith: "trigger" },
        experimentId: null,
        variant: null,
        playbookVersion: 2,
        exemplars: 1,
        promptHash: LINKEDIN_SYSTEM.hash,
        modelId: getModelId(),
      });
    }
  });

  it("stamps an empty-strategy recipe when no playbook exists", async () => {
    const store = new FakeCopyStore();
    store.leads = [lead("l1")];
    await runCopyDraft(PAYLOAD, makeDeps(store));
    expect(store.sends).toHaveLength(2);
    expect(store.sends[0]!.recipe).toEqual({
      v: 2,
      brain: "first_touch",
      strategy: {},
      experimentId: null,
      variant: null,
      playbookVersion: null,
      exemplars: 0,
      promptHash: LINKEDIN_SYSTEM.hash,
      modelId: getModelId(),
    });
  });
});

describe("runCopyDraft — Vera's winning-opener memory (Stage 0.5)", () => {
  it("passes winning openers to the draft brain and filters them out of avoidPhrases", async () => {
    const store = new FakeCopyStore();
    store.leads = [lead("l1")];
    store.context.winningOpeners = ["Saw your post on hiring SDRs"];
    store.context.avoidPhrases = ["saw your post on hiring sdrs", "Congrats on the new role"];
    const captured: DraftInput[] = [];
    const deps: CopyDraftDeps = {
      ...OFF_MODE,
      store,
      draftLinkedInFn: async (input) => {
        captured.push(input);
        return { connectionNote: "note", followupMessage: "follow", violations: [] };
      },
    };

    await runCopyDraft(PAYLOAD, deps);

    // exemplars reach the brain; the same opener never appears in BOTH lists
    // (guide-for-angle beats do-not-reuse — a contradictory prompt is worse than either)
    expect(captured[0]?.context.winningExemplars).toEqual(["Saw your post on hiring SDRs"]);
    expect(captured[0]?.context.avoidPhrases).toEqual(["Congrats on the new role"]);
  });

  it("is inert when there are no wins yet", async () => {
    const store = new FakeCopyStore();
    store.leads = [lead("l1")];
    const captured: DraftInput[] = [];
    const deps: CopyDraftDeps = {
      ...OFF_MODE,
      store,
      draftLinkedInFn: async (input) => {
        captured.push(input);
        return { connectionNote: "n", followupMessage: "f", violations: [] };
      },
    };

    await runCopyDraft(PAYLOAD, deps);

    expect(captured[0]?.context.winningExemplars ?? []).toEqual([]);
  });
});

// ── message-shape selector: config-gated champion default (spec 2026-07-20) ──
describe("runCopyDraft — message-shape champion default (config-gated, OFF by default)", () => {
  it("OFF (default): the champion strategy is byte-identical — no messageShape reaches the brain or the recipe", async () => {
    const store = new FakeCopyStore();
    store.leads = [lead("l1")]; // has triggers: ["hiring"]
    const { deps, inputs } = makeCapturingDeps(store); // deps.messageShapeAuto is undefined = OFF
    await runCopyDraft(PAYLOAD, deps);
    expect(inputs[0]!.context.strategy).toEqual({});
    for (const row of store.sends) {
      expect(row.recipe!.strategy).toEqual({});
      expect(row.recipe!.strategy).not.toHaveProperty("messageShape");
    }
  });

  it("ON + a real trigger: the champion opener structure becomes trigger_consequence and rides the recipe", async () => {
    const store = new FakeCopyStore();
    store.leads = [lead("l1")]; // triggers: ["hiring"] → signal present
    const { deps, inputs } = makeCapturingDeps(store);
    deps.messageShapeAuto = true;
    await runCopyDraft(PAYLOAD, deps);
    expect(inputs[0]!.context.strategy).toEqual({ messageShape: "trigger_consequence" });
    // attribution: messageShape rides buildSendRecipe → scheduled_sends.recipe with no new plumbing
    for (const row of store.sends) {
      expect(row.recipe!.strategy).toEqual({ messageShape: "trigger_consequence" });
    }
  });

  it("ON + thin signal (no trigger, no artifact): resolves to the safe floor and is NOT stamped (byte-identical)", async () => {
    const store = new FakeCopyStore();
    store.context.assets = []; // no giftable artifact
    store.leads = [lead("l1", { aiInsights: { ...lead("l1").aiInsights!, triggers: [] } })];
    const { deps, inputs } = makeCapturingDeps(store);
    deps.messageShapeAuto = true;
    await runCopyDraft(PAYLOAD, deps);
    // observation_question is the default → left OFF the strategy so the recipe/signature is
    // identical to a no-shape champion (the safe floor is a no-op).
    expect(inputs[0]!.context.strategy).toEqual({});
    for (const row of store.sends) expect(row.recipe!.strategy).toEqual({});
  });

  it("ON never overrides a champion that already pins a shape", async () => {
    const store = new FakeCopyStore();
    store.champion = { strategy: { messageShape: "peer_insider" }, version: 3 };
    store.leads = [lead("l1")]; // has a trigger, but the champion's explicit shape wins
    const { deps, inputs } = makeCapturingDeps(store);
    deps.messageShapeAuto = true;
    await runCopyDraft(PAYLOAD, deps);
    expect(inputs[0]!.context.strategy).toEqual({ messageShape: "peer_insider" });
  });

  // ── config-aware approach selection (spec 2026-07-21): the profile derived from the account's
  //    real config biases the champion default (APPROACH only, never facts) ──
  it("ON + self_serve cta + an artifact + no trigger → the champion default becomes gift", async () => {
    const store = new FakeCopyStore();
    store.context.agent.config.cta = "start a free trial"; // self_serve arc
    store.context.assets = [{ kind: "link", url: "https://acme.com/teardown.pdf", filename: null }];
    store.leads = [lead("l1", { aiInsights: { ...lead("l1").aiInsights!, triggers: [] } })];
    const { deps, inputs } = makeCapturingDeps(store);
    deps.messageShapeAuto = true;
    await runCopyDraft(PAYLOAD, deps);
    expect(inputs[0]!.context.strategy).toEqual({ messageShape: "gift" });
    for (const row of store.sends) expect(row.recipe!.strategy).toEqual({ messageShape: "gift" });
  });

  it("ON + a regulated (high-trust) industry + no trigger → observation_question, NOT stamped, even with an artifact", async () => {
    const store = new FakeCopyStore();
    store.context.account.industry = "wealth management"; // regulated → trust high
    store.context.agent.config.cta = "start a free trial"; // would be self_serve, but trust wins
    store.context.assets = [{ kind: "link", url: "https://acme.com/teardown.pdf", filename: null }];
    store.leads = [lead("l1", { aiInsights: { ...lead("l1").aiInsights!, triggers: [] } })];
    const { deps, inputs } = makeCapturingDeps(store);
    deps.messageShapeAuto = true;
    await runCopyDraft(PAYLOAD, deps);
    // high-trust sellers get the calm shape; observation_question is the default so it is left OFF
    // the strategy (byte-identical to a no-shape champion — the safe floor is a no-op).
    expect(inputs[0]!.context.strategy).toEqual({});
    for (const row of store.sends) expect(row.recipe!.strategy).toEqual({});
  });
});

// ── Task 3: best-of-N judge-ranked draft selection ───────────────────────────
describe("runCopyDraft — best-of-N (Task 3, off by default)", () => {
  it("no bestOfN config, no judgeFn: byte-identical to pre-Task-3 — one draft call, no bestOfN key on the recipe", async () => {
    const store = new FakeCopyStore();
    store.leads = [lead("l1")];
    const draftLinkedInFn = vi.fn(async () => ({
      connectionNote: "note",
      followupMessage: "follow",
      violations: [],
    }));
    const deps: CopyDraftDeps = { ...OFF_MODE, store, draftLinkedInFn };

    await runCopyDraft(PAYLOAD, deps);

    expect(draftLinkedInFn).toHaveBeenCalledTimes(1);
    expect(store.sends[0]!.recipe).not.toHaveProperty("bestOfN");
  });

  it("bestOfN=5 configured but judgeFn absent: forced to n=1 — one draft call, judge never wired, no bestOfN stamp", async () => {
    const store = new FakeCopyStore();
    store.leads = [lead("l1")];
    const draftLinkedInFn = vi.fn(async () => ({
      connectionNote: "note",
      followupMessage: "follow",
      violations: [],
    }));
    const deps: CopyDraftDeps = { ...OFF_MODE, store, draftLinkedInFn, bestOfN: 5 };

    await runCopyDraft(PAYLOAD, deps);

    expect(draftLinkedInFn).toHaveBeenCalledTimes(1);
    expect(store.sends[0]!.recipe).not.toHaveProperty("bestOfN");
  });

  it("bestOfN=1 with a judgeFn wired: still exactly one draft call and zero judge calls", async () => {
    const store = new FakeCopyStore();
    store.leads = [lead("l1")];
    const draftLinkedInFn = vi.fn(async () => ({
      connectionNote: "note",
      followupMessage: "follow",
      violations: [],
    }));
    const judgeFn = vi.fn<JudgeFn>();
    const deps: CopyDraftDeps = { ...OFF_MODE, store, draftLinkedInFn, bestOfN: 1, judgeFn };

    await runCopyDraft(PAYLOAD, deps);

    expect(draftLinkedInFn).toHaveBeenCalledTimes(1);
    expect(judgeFn).not.toHaveBeenCalled();
    expect(store.sends[0]!.recipe).not.toHaveProperty("bestOfN");
  });

  it("bestOfN=3 + a judge: drafts 3 candidates, judges each on the SAME grounding/cta the humanizer uses, and stamps + lints the highest-scored one", async () => {
    const store = new FakeCopyStore();
    store.leads = [lead("l1")];
    let call = 0;
    const draftLinkedInFn = vi.fn(async () => {
      call += 1;
      return { connectionNote: `note-${call}`, followupMessage: `follow-${call}`, violations: [] };
    });
    const scoreByFollowup: Record<string, number> = { "follow-1": 2, "follow-2": 4, "follow-3": 3 };
    const seenContexts: { grounding: string; cta?: string; messageType?: string }[] = [];
    const seenTexts: string[] = [];
    const judgeFn: JudgeFn = vi.fn(async (draft, ctx) => {
      seenContexts.push(ctx);
      seenTexts.push(draft.text);
      // the judge now reads the labeled pair (note, then follow-up) — key the score by the follow-up part
      return { overall: scoreByFollowup[followupOf(draft.text)]! };
    });
    let capturedInput: DraftInput | undefined;
    const wrappedDraftFn: CopyDraftDeps["draftLinkedInFn"] = async (input) => {
      capturedInput = input;
      return draftLinkedInFn();
    };
    const deps: CopyDraftDeps = { ...OFF_MODE, store, draftLinkedInFn: wrappedDraftFn, bestOfN: 3, judgeFn };

    await runCopyDraft(PAYLOAD, deps);

    expect(draftLinkedInFn).toHaveBeenCalledTimes(3);
    expect(judgeFn).toHaveBeenCalledTimes(3);
    // follow-2 scored highest (4) — its pair is what gets stored/linted/stamped.
    expect(store.sends.find((s) => s.linkedinStage === "invite")?.body).toBe("note-2");
    expect(store.sends.find((s) => s.linkedinStage === "message")?.body).toBe("follow-2");
    for (const row of store.sends) {
      expect(row.recipe).toMatchObject({ bestOfN: 3 });
    }
    // the judge saw the exact same grounding block the humanizer/draft brain builds from this input.
    expect(capturedInput).toBeDefined();
    const expectedGrounding = leadBlock(capturedInput!);
    for (const ctx of seenContexts) {
      expect(ctx.grounding).toBe(expectedGrounding);
      expect(ctx.cta).toBe("book a 15-min intro");
      expect(ctx.messageType).toBe(LINKEDIN_PAIR_MESSAGE_TYPE);
    }
    // labeled parts: the judge sees the note AND the follow-up, in the order the prospect reads them
    expect(seenTexts).toContain("Connection note:\nnote-2\n\nFollow-up:\nfollow-2");
  });

  it("caps the effective n at MAX_BEST_OF_N regardless of a larger configured value", async () => {
    const store = new FakeCopyStore();
    store.leads = [lead("l1")];
    const draftLinkedInFn = vi.fn(async () => ({
      connectionNote: "note",
      followupMessage: "follow",
      violations: [],
    }));
    const judgeFn: JudgeFn = vi.fn(async () => ({ overall: 3 }));
    const deps: CopyDraftDeps = { ...OFF_MODE, store, draftLinkedInFn, bestOfN: 999, judgeFn };

    await runCopyDraft(PAYLOAD, deps);

    expect(draftLinkedInFn).toHaveBeenCalledTimes(MAX_BEST_OF_N);
    expect(judgeFn).toHaveBeenCalledTimes(MAX_BEST_OF_N);
    expect(store.sends[0]!.recipe).toMatchObject({ bestOfN: MAX_BEST_OF_N });
  });

  it("suppression still runs BEFORE any draft, even with best-of-N configured — the brain is never called", async () => {
    const store = new FakeCopyStore();
    store.leads = [lead("l1")];
    store.suppressedValues.add("linkedin:https://linkedin.com/in/l1");
    const draftLinkedInFn = vi.fn(async () => ({
      connectionNote: "note",
      followupMessage: "follow",
      violations: [],
    }));
    const judgeFn: JudgeFn = vi.fn(async () => ({ overall: 5 }));
    const deps: CopyDraftDeps = { ...OFF_MODE, store, draftLinkedInFn, bestOfN: 3, judgeFn };

    const summary = await runCopyDraft(PAYLOAD, deps);

    expect(draftLinkedInFn).not.toHaveBeenCalled();
    expect(judgeFn).not.toHaveBeenCalled();
    expect(store.sends).toHaveLength(0);
    expect(summary).toMatchObject({ drafted: 0, suppressed: 1 });
  });

  it("a judge-preferred candidate that's lint-dirty still gets ONE fix pass and routes to review if still dirty — the humanizer stays the hard floor", async () => {
    const store = new FakeCopyStore({ linkedin: true }, "automatic");
    store.leads = [lead("l1")];
    let call = 0;
    const draftLinkedInFn = vi.fn(async () => {
      call += 1;
      // candidate 2 is the one the judge will prefer, and it's the lint-dirty one.
      return call === 2
        ? {
            connectionNote: "dirty note",
            followupMessage: "dirty follow",
            violations: [{ rule: "banned-phrase", detail: 'remove "game-changer"' }],
          }
        : { connectionNote: `clean note ${call}`, followupMessage: `clean follow ${call}`, violations: [] };
    });
    const judgeFn: JudgeFn = vi.fn(async (draft) => ({
      overall: followupOf(draft.text) === "dirty follow" ? 5 : 1,
    }));
    const fixLinkedInFn = vi.fn(async () => ({
      connectionNote: "still dirty note",
      followupMessage: "still dirty follow",
      violations: [{ rule: "banned-phrase", detail: 'remove "seamless"' }],
    }));
    const deps: CopyDraftDeps = { ...OFF_MODE, store, draftLinkedInFn, bestOfN: 3, judgeFn, fixLinkedInFn };

    await runCopyDraft(PAYLOAD, deps);

    // the fix pass ran exactly once, on the CHOSEN (dirty) candidate — never on the clean ones.
    expect(fixLinkedInFn).toHaveBeenCalledOnce();
    expect(fixLinkedInFn).toHaveBeenCalledWith(
      expect.objectContaining({ followupMessage: "dirty follow" }),
      expect.anything()
    );
    // still flagged after the fix ⇒ never silently approved, exactly like today's single-draft path.
    for (const send of store.sends) {
      expect(send.status).toBe("pending_review");
      expect(send.styleFlags).toContain("banned-phrase");
    }
  });

  it("a judge-preferred candidate that's lint-dirty auto-approves once the fix pass cleans it (automatic mode)", async () => {
    const store = new FakeCopyStore({ linkedin: true }, "automatic");
    store.leads = [lead("l1")];
    let call = 0;
    const draftLinkedInFn = vi.fn(async () => {
      call += 1;
      return call === 2
        ? {
            connectionNote: "dirty note",
            followupMessage: "dirty follow",
            violations: [{ rule: "banned-phrase", detail: 'remove "game-changer"' }],
          }
        : { connectionNote: `clean note ${call}`, followupMessage: `clean follow ${call}`, violations: [] };
    });
    const judgeFn: JudgeFn = vi.fn(async (draft) => ({
      overall: followupOf(draft.text) === "dirty follow" ? 5 : 1,
    }));
    const fixLinkedInFn = vi.fn(async () => ({
      connectionNote: "fixed note",
      followupMessage: "fixed follow",
      violations: [],
    }));
    const deps: CopyDraftDeps = { ...OFF_MODE, store, draftLinkedInFn, bestOfN: 3, judgeFn, fixLinkedInFn };

    await runCopyDraft(PAYLOAD, deps);

    expect(fixLinkedInFn).toHaveBeenCalledOnce();
    for (const send of store.sends) {
      expect(send.status).toBe("approved");
      expect(send.styleFlags).toBeNull();
    }
    expect(store.sends.find((s) => s.linkedinStage === "message")?.body).toBe("fixed follow");
  });
});

const CLEAN = { connectionNote: "note", followupMessage: "follow", violations: [] as [] };

describe("runCopyDraft — daily first-touch cap", () => {
  it("drafts at most 15 first touches and leaves the rest unqualified-for-today only", async () => {
    const store = new FakeCopyStore();
    store.firstTouchDraftsToday = 14;
    for (const id of ["a", "b", "c"]) store.leads.push(lead(id));
    const draftLinkedInFn = vi.fn(async () => CLEAN);
    const summary = await runCopyDraft(
      { copyAgentId: "copy1", accountId: "acc1", leadIds: ["a", "b", "c"] },
      { ...OFF_MODE, store, draftLinkedInFn }
    );
    expect(draftLinkedInFn).toHaveBeenCalledTimes(1);
    expect(summary).toMatchObject({ drafted: 1, deferred: 2, skipped: 0 });
    const draftedIds = new Set(store.sends.map((s) => s.leadId));
    expect(draftedIds.size).toBe(1);
    for (const id of ["a", "b", "c"]) {
      if (!draftedIds.has(id)) expect(store.campaignLeads.has(id)).toBe(false);
    }
  });

  it("does not call the model when 15 invites were already drafted today", async () => {
    const store = new FakeCopyStore();
    store.firstTouchDraftsToday = 15;
    store.leads.push(lead("a"));
    const draftLinkedInFn = vi.fn(async () => CLEAN);
    const summary = await runCopyDraft(
      { copyAgentId: "copy1", accountId: "acc1", leadIds: ["a"] },
      { ...OFF_MODE, store, draftLinkedInFn }
    );
    expect(draftLinkedInFn).not.toHaveBeenCalled();
    expect(summary).toMatchObject({ drafted: 0, deferred: 1, skipped: 0 });
    expect(store.campaignLeads.has("a")).toBe(false);
  });

  it("spends the last slot on the higher score", async () => {
    const store = new FakeCopyStore();
    store.firstTouchDraftsToday = 14;
    store.leads.push(scored("low", 71), scored("high", 96));
    const draftLinkedInFn = vi.fn(async () => CLEAN);
    await runCopyDraft(
      { copyAgentId: "copy1", accountId: "acc1", leadIds: ["low", "high"] },
      { ...OFF_MODE, store, draftLinkedInFn }
    );
    expect(store.sends.map((s) => s.leadId)).toEqual(["high", "high"]);
  });

  it("spends the last slot by score + the learned outcome tilt, matching the drain order", async () => {
    const store = new FakeCopyStore();
    store.firstTouchDraftsToday = 14;
    const flags = (accepted: boolean, interested: boolean): LeadOutcomeFlags => ({
      invited: true, accepted, interested, negative: false, booked: false, converted: false,
    });
    // founders reply far above baseline, VPs far below → founder tilt +, VP tilt −
    store.targetingProfile = buildTargetingProfile([
      ...Array.from({ length: 30 }, () => ({ title: "Founder", industry: "saas", flags: flags(true, true) })),
      ...Array.from({ length: 30 }, () => ({ title: "VP Sales", industry: "saas", flags: flags(false, false) })),
    ]);
    store.leads.push(lead("vp", { aiScore: 73, title: "VP Sales" }), lead("founder", { aiScore: 70, title: "Founder" }));
    const draftLinkedInFn = vi.fn(async () => CLEAN);
    await runCopyDraft(
      { copyAgentId: "copy1", accountId: "acc1", leadIds: ["vp", "founder"] },
      { ...OFF_MODE, store, draftLinkedInFn }
    );
    expect(store.sends.map((s) => s.leadId)).toEqual(["founder", "founder"]);
  });

  it("does not spend the last slot on a suppressed higher score", async () => {
    const store = new FakeCopyStore();
    store.firstTouchDraftsToday = 14;
    store.leads.push(scored("low", 71), scored("high", 96));
    store.suppressedValues.add("linkedin:https://linkedin.com/in/high");
    const draftLinkedInFn = vi.fn(async () => CLEAN);
    await runCopyDraft(
      { copyAgentId: "copy1", accountId: "acc1", leadIds: ["low", "high"] },
      { ...OFF_MODE, store, draftLinkedInFn }
    );
    expect(draftLinkedInFn).toHaveBeenCalledTimes(1);
    expect(store.sends.map((s) => s.leadId)).toEqual(["low", "low"]);
    expect(store.campaignLeads.get("high")).toBe("suppressed");
    expect(store.campaignLeads.has("low")).toBe(true);
  });

  it("hands the lead's verified why-now to the copy brain (ML-3)", async () => {
    const store = new FakeCopyStore();
    const why = { kind: "intent", text: "Commented asking for a churn tool on a RevOps post", ageDays: 2 };
    store.leads.push(lead("w", { whyNow: why }), lead("plain"));
    const seen: DraftInput[] = [];
    const draftLinkedInFn = vi.fn(async (input: DraftInput) => {
      seen.push(input);
      return CLEAN;
    });
    await runCopyDraft({ copyAgentId: "copy1", accountId: "acc1", leadIds: ["w", "plain"] }, { ...OFF_MODE, store, draftLinkedInFn });
    expect(seen.some((i) => i.lead.whyNow?.text === why.text)).toBe(true);
    expect(seen.filter((i) => i.lead.whyNow).length).toBe(1);
  });
});


describe("runCopyDraft — opener skeletons (copy-quality fix)", () => {
  it("passes skeletons from recent openers AND winning exemplars to the brain (code-only, not the prompt list)", async () => {
    const store = new FakeCopyStore();
    store.leads = [lead("l1")];
    store.context.winningOpeners = ["Saw your post on hiring SDRs"];
    store.context.avoidPhrases = ["saw your post on hiring sdrs", "Thanks for connecting. Curious how you run outbound?"];
    const captured: DraftInput[] = [];
    const deps: CopyDraftDeps = {
      ...OFF_MODE,
      store,
      draftLinkedInFn: async (input) => {
        captured.push(input);
        return { connectionNote: "note", followupMessage: "A distinct opener for this one.", violations: [] };
      },
    };

    await runCopyDraft(PAYLOAD, deps);

    expect(captured[0]?.context.avoidSkeletons).toEqual(
      expect.arrayContaining(["saw your post on hiring", "thanks for connecting curious how"])
    );
    // the winner stays out of the PROMPT's avoid list (no contradictory instruction)
    expect(captured[0]?.context.avoidPhrases).toEqual(["Thanks for connecting. Curious how you run outbound?"]);
  });

  it("drafts later in the same run see earlier drafts' skeletons, and an in-run repeat routes to review", async () => {
    const store = new FakeCopyStore({ linkedin: true }, "automatic");
    store.leads = [lead("l1"), lead("l2", { firstName: "Sam", companyName: "Globex" })];
    const captured: DraftInput[] = [];
    let call = 0;
    const deps: CopyDraftDeps = {
      ...OFF_MODE,
      store,
      draftLinkedInFn: async (input) => {
        captured.push(input);
        call += 1;
        // both drafts open with the same five words, only the name differs
        const name = call === 1 ? "Dana" : "Sam";
        return { connectionNote: "note", followupMessage: `Three new reps at once, ${name}, is a lot. How's ramp?`, violations: [] };
      },
    };

    await runCopyDraft({ ...PAYLOAD, leadIds: ["l1", "l2"] }, deps);

    const messages = store.sends.filter((s) => s.linkedinStage === "message");
    expect(messages).toHaveLength(2);
    const flagged = messages.filter((m) => m.styleFlags?.includes("repeated-opener"));
    // exactly one of the pair is flagged (whichever finished second) and it is held for review
    expect(flagged).toHaveLength(1);
    expect(store.sends.filter((s) => s.leadId === flagged[0]!.leadId).every((s) => s.status === "pending_review")).toBe(true);
    const clean = messages.find((m) => !m.styleFlags);
    expect(clean?.status).toBe("approved");
  });
});

describe("runCopyDraft — first touch by conversation mode (spec §7.2)", () => {
  it("copy-draft mode off: inserts the invite+message pair via the pair brain (unchanged)", async () => {
    const store = new FakeCopyStore();
    store.leads = [lead("l1")];
    const draftLinkedInFn = vi.fn(async () => ({ connectionNote: "note", followupMessage: "follow", violations: [] }));
    const draftLinkedInNoteFn = vi.fn(async () => ({ connectionNote: "n", violations: [] }));

    await runCopyDraft(PAYLOAD, { store, conversationMode: "off", draftLinkedInFn, draftLinkedInNoteFn });

    expect(draftLinkedInFn).toHaveBeenCalledTimes(1);
    expect(draftLinkedInNoteFn).not.toHaveBeenCalled();
    expect(store.linkedInCallKinds).toEqual(["pair"]);
    expect(store.sends.map((s) => [s.linkedinStage, s.body])).toEqual([
      ["invite", "note"],
      ["message", "follow"],
    ]);
    expect(store.sends[0]!.recipe?.promptHash).toBe(LINKEDIN_SYSTEM.hash);
  });

  for (const mode of ["shadow", "live_replies", "live"] as const) {
    it(`copy-draft mode ${mode}: inserts only the invite from the note brain; no message row`, async () => {
      const store = new FakeCopyStore();
      store.leads = [lead("l1")];
      store.champion = { strategy: {}, version: 7 };
      const draftLinkedInFn = vi.fn(async () => ({ connectionNote: "pair note", followupMessage: "follow", violations: [] }));
      const draftLinkedInNoteFn = vi.fn(async () => ({ connectionNote: "Saw the Series A, Dana.", violations: [] }));

      const summary = await runCopyDraft(PAYLOAD, { store, conversationMode: mode, draftLinkedInFn, draftLinkedInNoteFn });

      expect(summary.drafted).toBe(1);
      expect(draftLinkedInFn).not.toHaveBeenCalled();
      expect(draftLinkedInNoteFn).toHaveBeenCalledTimes(1);
      expect(store.linkedInCallKinds).toEqual(["single"]);
      expect(store.sends).toHaveLength(1);
      const invite = store.sends[0]!;
      expect(invite).toMatchObject({ linkedinStage: "invite", body: "Saw the Series A, Dana.", status: "pending_review", styleFlags: null });
      expect(store.sends.some((s) => s.linkedinStage === "message")).toBe(false);
      expect(invite.recipe?.brain).toBe("first_touch");
      expect(invite.recipe?.promptHash).toBe(LINKEDIN_NOTE_SYSTEM.hash);
      expect(invite.recipe?.playbookVersion).toBe(7);
      expect(invite.recipe?.modelId).toBe(getModelId());
      expect(store.campaignLeads.get("l1")).toBe("queued");
      expect(store.leadStatuses.get("l1")).toBe("in_campaign");
    });
  }

  it("note mode: a suppressed profile gets no draft and no row (rule 11)", async () => {
    const store = new FakeCopyStore();
    store.leads = [lead("l1")];
    store.suppressedValues.add(`linkedin:${normalizeLinkedInUrl("https://linkedin.com/in/l1")}`);
    const draftLinkedInNoteFn = vi.fn(async () => ({ connectionNote: "n", violations: [] }));

    const summary = await runCopyDraft(PAYLOAD, { ...OFF_MODE, store, draftLinkedInFn: vi.fn(), conversationMode: "live", draftLinkedInNoteFn });

    expect(summary.suppressed).toBe(1);
    expect(draftLinkedInNoteFn).not.toHaveBeenCalled();
    expect(store.sends).toHaveLength(0);
  });

  it("note mode: automatic sender auto-approves a clean note; a flagged note waits in review", async () => {
    const store = new FakeCopyStore({ linkedin: true }, "automatic");
    store.leads = [lead("l1"), lead("l2", { firstName: "Sam", companyName: "Globex" })];
    const draftLinkedInNoteFn = vi.fn(async (input: DraftInput) =>
      input.lead.firstName === "Dana"
        ? { connectionNote: "Clean note, Dana.", violations: [] }
        : { connectionNote: "Flagged note.", violations: [{ rule: "no-links", detail: "no links", part: "invite" as const }] }
    );

    await runCopyDraft({ ...PAYLOAD, leadIds: ["l1", "l2"] }, { store, conversationMode: "live", draftLinkedInFn: vi.fn(), draftLinkedInNoteFn });

    const byLead = new Map(store.sends.map((s) => [s.leadId, s]));
    expect(byLead.get("l1")?.status).toBe("approved");
    expect(byLead.get("l2")?.status).toBe("pending_review");
    expect(byLead.get("l2")?.styleFlags).toContain("no-links");
  });

  it("note mode: in-run skeleton collision runs on the NOTE text", async () => {
    const store = new FakeCopyStore({ linkedin: true }, "automatic");
    store.leads = [lead("l1"), lead("l2", { firstName: "Sam", companyName: "Globex" })];
    const draftLinkedInNoteFn = vi.fn(async (input: DraftInput) => ({
      connectionNote: `Three new reps at once, ${input.lead.firstName}, is a lot.`,
      violations: [],
    }));

    await runCopyDraft({ ...PAYLOAD, leadIds: ["l1", "l2"] }, { store, conversationMode: "live", draftLinkedInFn: vi.fn(), draftLinkedInNoteFn });

    expect(store.sends).toHaveLength(2);
    const flagged = store.sends.filter((s) => s.styleFlags?.includes("repeated-opener"));
    expect(flagged).toHaveLength(1);
    expect(flagged[0]!.status).toBe("pending_review");
  });

  it("note mode: best-of-N ranks note candidates with the judge reading the note text", async () => {
    const store = new FakeCopyStore();
    store.leads = [lead("l1")];
    let call = 0;
    const draftLinkedInNoteFn = vi.fn(async () => ({ connectionNote: `note ${++call}`, violations: [] }));
    const judged: string[] = [];
    const judgeFn: JudgeFn = vi.fn(async (draft) => {
      judged.push(draft.text);
      return { overall: draft.text === "note 2" ? 9 : 1 };
    });

    await runCopyDraft(PAYLOAD, { store, conversationMode: "shadow", draftLinkedInFn: vi.fn(), draftLinkedInNoteFn, judgeFn, bestOfN: 3 });

    expect(draftLinkedInNoteFn).toHaveBeenCalledTimes(3);
    expect(judged.sort()).toEqual(["note 1", "note 2", "note 3"]);
    expect(store.sends[0]!.body).toBe("note 2");
    expect(store.sends[0]!.recipe?.bestOfN).toBe(3);
  });
});
