import { describe, expect, it, vi } from "vitest";
import { InMemoryLinkedInInfra } from "@vantera/linkedin-infra";
import type { IntentVerdict, LeadInsights, RankCandidate } from "@vantera/agent-brains";
import { runIntentScan } from "./intent-scan";
import type { IntentObservationRow, IntentScanContext, IntentScanDeps, IntentScanStore } from "./types";

const CREATOR = "https://li/creator";
const GOOD = "https://li/good";
const BLOCKED = "https://li/blocked";

function seededLinkedIn() {
  const li = new InMemoryLinkedInInfra();
  li.posts.push({ postRef: "p1", authorProfileUrl: CREATOR, authorName: "Cara", authorHeadline: "RevOps lead", text: "we keep struggling with onboarding churn", postedAt: null, url: null });
  li.engagersByPost.set("p1", [
    { profileUrl: GOOD, name: "Gwen", headline: "Head of CX", kind: "comment", text: "same — what tool do you use?" },
    { profileUrl: BLOCKED, name: "Bo", headline: "VP Success", kind: "comment", text: "us too" },
  ]);
  li.profiles.set(CREATOR, { profileUrl: CREATOR, firstName: "Cara", lastName: "Lin", headline: "RevOps lead", companyName: "Acme", location: "Austin" });
  li.profiles.set(GOOD, { profileUrl: GOOD, firstName: "Gwen", lastName: "Park", headline: "Head of CX", companyName: "Globex", location: "Remote" });
  // BLOCKED has a profile too — but suppression must stop us before we ever read or enroll it
  li.profiles.set(BLOCKED, { profileUrl: BLOCKED, firstName: "Bo", lastName: "Day", headline: "VP Success", companyName: "Initech", location: "NYC" });
  return li;
}

function makeStore(overrides: Partial<IntentScanStore> = {}) {
  const calls = {
    observations: [] as IntentObservationRow[],
    upserted: [] as string[], // externalRefs that became leads
    scored: [] as { leadId: string; qualified: boolean }[],
    signals: [] as string[],
    chained: null as { leadIds: string[] } | null,
    completed: false,
  };
  const ctx: IntentScanContext = {
    agent: {
      id: "intent-1",
      accountId: "acc-1",
      status: "live",
      config: { watch: { creators: [CREATOR], competitors: [], keywords: [], hashtags: [] }, signals: { engagement: true, content: true }, minScore: 70 },
    },
    connectedAccountId: "conn-1",
    icps: [{ id: "icp-1", name: "RevOps leaders", criteria: { titles: ["revops", "cx", "success"] } }],
    account: { industry: "SaaS", valueProp: "cut onboarding churn", subscriptionStatus: "active" },
  };
  const store: IntentScanStore = {
    getIntentContext: async () => ctx,
    seenObservationKeys: async () => new Set<string>(),
    recordObservations: async (_a, _ag, rows) => void calls.observations.push(...rows),
    upsertIntentLead: async (_a, candidate) => {
      calls.upserted.push(candidate.externalRef);
      return { leadId: `lead_${candidate.externalRef}` };
    },
    markRulesGate: async () => {},
    saveScore: async (leadId, _i, qualified) => void calls.scored.push({ leadId, qualified }),
    saveIntentSignal: async (leadId) => void calls.signals.push(leadId),
    isSuppressed: async (_a, _k, value) => value === BLOCKED,
    getLiveCopyAgent: async () => ({ id: "copy-1" }),
    completeRun: async () => void (calls.completed = true),
    ...overrides,
  };
  return { store, calls, ctx };
}

const verdict = (ref: string): IntentVerdict => ({ ref, reasoning: "asks for a churn tool", is_intent: true, level: "high", why_now: "commented asking for a churn tool" });
const insight = (lead_id: string, score: number): LeadInsights => ({ lead_id, score } as unknown as LeadInsights);

function makeDeps(store: IntentScanStore): IntentScanDeps {
  return {
    store,
    linkedin: seededLinkedIn(),
    classifyFn: async (obs) => obs.map((o) => verdict(o.ref)),
    rankFn: async (cands) => cands.map((c) => insight(c.leadId, 80)),
    triggerCopyDraft: vi.fn(async () => {}),
    now: () => new Date("2026-06-20T00:00:00Z"),
  };
}

describe("runIntentScan", () => {
  it("reads → classifies → qualifies → enrolls intent leads and chains the Copy agent", async () => {
    const { store, calls } = makeStore();
    const deps = makeDeps(store);
    const summary = await runIntentScan("intent-1", deps);

    expect(summary.status).toBe("completed");
    expect(summary.intent).toBe(3); // creator (content) + good + blocked (engagement)
    expect(summary.qualified).toBe(2); // blocked is suppressed → only creator + good enroll
    expect(summary.chained).toBe(true);

    // qualified intent leads were handed to the live Copy agent
    expect(deps.triggerCopyDraft).toHaveBeenCalledWith({ copyAgentId: "copy-1", accountId: "acc-1", leadIds: [`lead_${CREATOR}`, `lead_${GOOD}`] });
    expect(calls.completed).toBe(true);
    // each qualified lead captured its "why now" intent signal
    expect(calls.signals).toEqual([`lead_${CREATOR}`, `lead_${GOOD}`]);
  });

  it("feeds the buying-intent verdict into the rank as an explicit, recent intent signal", async () => {
    const { store } = makeStore();
    const deps = makeDeps(store);
    const ranked: RankCandidate[] = [];
    deps.rankFn = async (cands) => {
      ranked.push(...cands);
      return cands.map((c) => insight(c.leadId, 80));
    };
    await runIntentScan("intent-1", deps);

    // the verdict the strict classifier produced is handed to the scorer as a first-class
    // `intent` signal — so the rank reflects "they're asking for this" instead of judging a
    // bare LinkedIn headline. high verdict → in_depth strength, stamped at run time.
    const good = ranked.find((c) => c.leadId === `lead_${GOOD}`);
    expect(good?.signals?.[0]).toMatchObject({
      kind: "intent",
      detail: "commented asking for a churn tool",
      level: "in_depth",
      observedAt: "2026-06-20T00:00:00.000Z",
    });
  });

  it("watches a competitor NAME as a search query (no URL needed) — auto-derived watchlists just work", async () => {
    const { store, calls } = makeStore({
      getIntentContext: async () => ({
        agent: {
          id: "intent-1",
          accountId: "acc-1",
          status: "live",
          config: { watch: { creators: [], competitors: ["churn"], keywords: [], hashtags: [] }, signals: { engagement: true, content: true }, minScore: 70 },
        },
        connectedAccountId: "conn-1",
        icps: [{ id: "icp-1", name: "RevOps leaders", criteria: { titles: ["revops", "cx", "success"] } }],
        account: { industry: "SaaS", valueProp: "cut onboarding churn", subscriptionStatus: "active" },
      }),
    });
    const summary = await runIntentScan("intent-1", makeDeps(store));

    // "churn" is a NAME, not a URL → searchPosts (finds the seeded post). If it were mis-routed as a
    // profile, listProfilePosts("churn") returns nothing and we'd observe 0.
    expect(summary.observed).toBeGreaterThan(0);
    expect(summary.qualified).toBe(2);
    expect(calls.observations.some((r) => r.watchTarget === "churn")).toBe(true);
  });

  it("never enrolls a suppressed profile (rule 11 — the master gate)", async () => {
    const { store, calls } = makeStore();
    await runIntentScan("intent-1", makeDeps(store));

    // the suppressed person never became a lead and never got scored
    expect(calls.upserted).not.toContain(BLOCKED);
    expect(calls.scored.map((s) => s.leadId)).not.toContain(`lead_${BLOCKED}`);
    // and it is audited as suppressed in the observation ledger
    const blockedRow = calls.observations.find((r) => r.profileUrl === BLOCKED);
    expect(blockedRow?.outcome).toBe("suppressed");
    expect(blockedRow?.leadId).toBeNull();
  });

  it("skips when no LinkedIn account is connected", async () => {
    const { store } = makeStore({ getIntentContext: async () => ({
      agent: { id: "intent-1", accountId: "acc-1", status: "live", config: {} },
      connectedAccountId: null,
      icps: [],
      account: { industry: null, valueProp: null, subscriptionStatus: "active" },
    }) });
    const summary = await runIntentScan("intent-1", makeDeps(store));
    expect(summary).toMatchObject({ status: "skipped", reason: "no_connection" });
  });

  it("skips a fresh-less run cleanly when every observation was already seen", async () => {
    const { store, calls } = makeStore({
      seenObservationKeys: async (_a, refs) => new Set(refs.map((r) => `${r.profileUrl}|${r.postRef}`)),
    });
    const summary = await runIntentScan("intent-1", makeDeps(store));
    expect(summary).toMatchObject({ status: "completed", observed: 0, qualified: 0, chained: false });
    expect(calls.completed).toBe(true);
  });
});
