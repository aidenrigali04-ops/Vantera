import { describe, expect, it, vi } from "vitest";
import { normalizeLinkedInUrl, runCopyDraft, MAX_BEST_OF_N } from "./copy-draft";
import type {
  ActiveExperiment,
  CopyContext,
  CopyDraftDeps,
  CopyDraftStore,
  DraftableLead,
  NewScheduledSend,
} from "./types";
import { LINKEDIN_SYSTEM, leadBlock, type CopyStrategy, type DraftInput, type JudgeFn } from "@vantera/agent-brains";
import { getModelId } from "@vantera/ai";

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
  // Phase 3 experiment plumbing — default to inert (no experiment, empty champion).
  activeExperiment: ActiveExperiment | null = null;
  champion: { strategy: CopyStrategy; version: number | null } = { strategy: {}, version: null };
  stamps: { leadId: string; experimentId: string; variant: string }[] = [];

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
  async getActiveExperiment() {
    return this.activeExperiment;
  }
  async getChampion() {
    return this.champion;
  }
  async stampLeadExperiment(
    leadId: string,
    experimentId: string,
    variant: "champion" | "challenger"
  ) {
    this.stamps.push({ leadId, experimentId, variant });
  }
  // Task 3: only the thin trigger reads this (the core reads deps.bestOfN directly) — present
  // solely to satisfy CopyDraftStore; no test below depends on its value.
  async getBestOfN() {
    return 1;
  }
  // Message-shape selector: only the thin trigger reads this (the core reads deps.messageShapeAuto
  // directly) — present solely to satisfy CopyDraftStore.
  async getMessageShapeAuto() {
    return false;
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
      store,
      draftLinkedInFn: async (input) => {
        inputs.push(input);
        return { connectionNote: "note", followupMessage: "follow", violations: [] };
      },
    },
  };
}

describe("runCopyDraft — experiment plumbing (Phase 3)", () => {
  it("no experiment: champion is empty, no directives, no stamp (identical to before)", async () => {
    const store = new FakeCopyStore();
    store.leads = [lead("l1")];
    const { deps, inputs } = makeCapturingDeps(store);
    await runCopyDraft(PAYLOAD, deps);
    expect(inputs[0]!.context.strategy).toEqual({});
    expect(store.stamps).toHaveLength(0);
  });

  it("active experiment at 100%: the challenger strategy is applied and the lead is stamped challenger", async () => {
    const store = new FakeCopyStore();
    store.leads = [lead("l1")];
    store.activeExperiment = {
      id: "exp1",
      allocationPct: 100,
      challengerStrategy: { followupLength: "tight" },
    };
    const { deps, inputs } = makeCapturingDeps(store);
    await runCopyDraft(PAYLOAD, deps);
    expect(inputs[0]!.context.strategy).toEqual({ followupLength: "tight" });
    expect(store.stamps).toEqual([{ leadId: "l1", experimentId: "exp1", variant: "challenger" }]);
  });

  it("active experiment at 0%: the adopted champion strategy is applied and the lead is stamped champion", async () => {
    const store = new FakeCopyStore();
    store.leads = [lead("l1")];
    store.champion = { strategy: { openWith: "trigger" }, version: 1 };
    store.activeExperiment = {
      id: "exp1",
      allocationPct: 0,
      challengerStrategy: { followupLength: "tight" },
    };
    const { deps, inputs } = makeCapturingDeps(store);
    await runCopyDraft(PAYLOAD, deps);
    expect(inputs[0]!.context.strategy).toEqual({ openWith: "trigger" });
    expect(store.stamps).toEqual([{ leadId: "l1", experimentId: "exp1", variant: "champion" }]);
  });
});

// ── Stage 1: message-level recipe attribution ────────────────────────────────
describe("runCopyDraft — recipe stamp (Stage 1)", () => {
  it("stamps both rows of the pair with the first-touch recipe (challenger arm)", async () => {
    const store = new FakeCopyStore();
    store.leads = [lead("l1")];
    store.champion = { strategy: { openWith: "trigger" }, version: 2 };
    store.context.winningOpeners = ["Saw the Series B announcement"];
    store.activeExperiment = {
      id: "exp-1",
      allocationPct: 100,
      challengerStrategy: { openWith: "pain" },
    };
    await runCopyDraft(PAYLOAD, makeDeps(store));
    expect(store.sends).toHaveLength(2);
    for (const row of store.sends) {
      expect(row.recipe).toEqual({
        v: 2,
        brain: "first_touch",
        strategy: { openWith: "pain" },
        experimentId: "exp-1",
        variant: "challenger",
        playbookVersion: 2,
        exemplars: 1,
        promptHash: LINKEDIN_SYSTEM.hash,
        modelId: getModelId(),
      });
    }
  });

  it("stamps a champion recipe with null experiment when nothing is running", async () => {
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

  it("ON never overrides the challenger arm's own strategy", async () => {
    const store = new FakeCopyStore();
    store.leads = [lead("l1")];
    store.activeExperiment = {
      id: "exp1",
      allocationPct: 100,
      challengerStrategy: { followupLength: "tight" },
    };
    const { deps, inputs } = makeCapturingDeps(store);
    deps.messageShapeAuto = true;
    await runCopyDraft(PAYLOAD, deps);
    // challenger strategy is applied verbatim — the champion default never touches a challenger.
    expect(inputs[0]!.context.strategy).toEqual({ followupLength: "tight" });
    expect(inputs[0]!.context.strategy).not.toHaveProperty("messageShape");
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
    const deps: CopyDraftDeps = { store, draftLinkedInFn };

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
    const deps: CopyDraftDeps = { store, draftLinkedInFn, bestOfN: 5 };

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
    const deps: CopyDraftDeps = { store, draftLinkedInFn, bestOfN: 1, judgeFn };

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
    const seenContexts: { grounding: string; cta?: string }[] = [];
    const judgeFn: JudgeFn = vi.fn(async (draft, ctx) => {
      seenContexts.push(ctx);
      return { overall: scoreByFollowup[draft.text]! };
    });
    let capturedInput: DraftInput | undefined;
    const wrappedDraftFn: CopyDraftDeps["draftLinkedInFn"] = async (input) => {
      capturedInput = input;
      return draftLinkedInFn();
    };
    const deps: CopyDraftDeps = { store, draftLinkedInFn: wrappedDraftFn, bestOfN: 3, judgeFn };

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
    }
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
    const deps: CopyDraftDeps = { store, draftLinkedInFn, bestOfN: 999, judgeFn };

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
    const deps: CopyDraftDeps = { store, draftLinkedInFn, bestOfN: 3, judgeFn };

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
      overall: draft.text === "dirty follow" ? 5 : 1,
    }));
    const fixLinkedInFn = vi.fn(async () => ({
      connectionNote: "still dirty note",
      followupMessage: "still dirty follow",
      violations: [{ rule: "banned-phrase", detail: 'remove "seamless"' }],
    }));
    const deps: CopyDraftDeps = { store, draftLinkedInFn, bestOfN: 3, judgeFn, fixLinkedInFn };

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
      overall: draft.text === "dirty follow" ? 5 : 1,
    }));
    const fixLinkedInFn = vi.fn(async () => ({
      connectionNote: "fixed note",
      followupMessage: "fixed follow",
      violations: [],
    }));
    const deps: CopyDraftDeps = { store, draftLinkedInFn, bestOfN: 3, judgeFn, fixLinkedInFn };

    await runCopyDraft(PAYLOAD, deps);

    expect(fixLinkedInFn).toHaveBeenCalledOnce();
    for (const send of store.sends) {
      expect(send.status).toBe("approved");
      expect(send.styleFlags).toBeNull();
    }
    expect(store.sends.find((s) => s.linkedinStage === "message")?.body).toBe("fixed follow");
  });
});
