import { describe, expect, it } from "vitest";
import { MockLanguageModelV3 } from "ai/test";
import { gradeLinkedinDraft, gradeRespondDraft } from "./deterministic";
import { loadCopyLinkedinCorpus, loadCopyRespondCorpus, type CopyLinkedinCase, type CopyRespondCase } from "../corpus";
import { runDeterministic } from "../run-deterministic";

/**
 * The deterministic quality gate (Phase 2B, Task 4). `gradeLinkedinDraft`/`gradeRespondDraft` are
 * pure — no model, no I/O — so they're unit-tested directly against hand-built clean/dirty drafts
 * below. `runDeterministic` is exercised in both modes: "frozen" (no model — the regression guard
 * over the real, hand-verified corpus) and "live" (mock model — proves a prompt regression that
 * starts producing dirty copy actually fails the gate).
 */

function textResponse(json: unknown) {
  return {
    finishReason: { unified: "stop" as const, raw: "stop" },
    usage: { inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 1, text: 1, reasoning: 0 } },
    content: [{ type: "text" as const, text: JSON.stringify(json) }],
    warnings: [],
  };
}

// An ungrounded metric that appears in NONE of the corpus's `grounding` strings (verified: the
// corpus only ever cites $1.2M, $900k, 35%, 40%), so it's an ungrounded-claim violation against
// every case uniformly.
const UNGROUNDED_METRIC = "77%";
const DIRTY_TEXT = `I hope this finds you well. We grew ${UNGROUNDED_METRIC} last quarter, check http://x.com for more.`;

const linkedinCorpus = loadCopyLinkedinCorpus();
const respondCorpus = loadCopyRespondCorpus();

function pickLinkedinCase(predicate: (c: CopyLinkedinCase) => boolean): CopyLinkedinCase {
  const found = linkedinCorpus.find(predicate);
  if (!found) throw new Error("deterministic.test.ts: no linkedin fixture matched the test's predicate");
  return found;
}

function pickRespondCase(predicate: (c: CopyRespondCase) => boolean): CopyRespondCase {
  const found = respondCorpus.find(predicate);
  if (!found) throw new Error("deterministic.test.ts: no respond fixture matched the test's predicate");
  return found;
}

describe("gradeLinkedinDraft", () => {
  it("passes a known-clean frozen draft with zero violations", () => {
    const c = pickLinkedinCase((c) => !!c.frozenDraft && !c.notes?.startsWith("positive-grounding"));
    const result = gradeLinkedinDraft(c.frozenDraft!, c, c.input.context.accountName);
    expect(result).toEqual({ caseId: c.id, brain: "linkedin", violations: [], pass: true });
  });

  it("fails a hand-built dirty draft — banned phrase, ungrounded metric, and a bare link, all flagged", () => {
    // Any case whose grounding doesn't already mention the ungrounded metric (only one fixture,
    // li-logistics-ops-director-dispatch, cites 40% — everything else is metric-free for "77%").
    const c = pickLinkedinCase((c) => !c.grounding.includes(UNGROUNDED_METRIC));
    const dirty = { connectionNote: "Fine note, nothing wrong here.", followupMessage: DIRTY_TEXT, violations: [] };

    const result = gradeLinkedinDraft(dirty, c, c.input.context.accountName);

    expect(result.pass).toBe(false);
    const rules = result.violations.map((v) => v.rule);
    expect(rules).toContain("banned-phrase");
    expect(rules).toContain("ungrounded-claim");
    // the bare link trips BOTH the blanket no-links rule (first-touch copy carries no links at
    // all) and the explicit unapproved-link check this grader composes on top.
    expect(rules).toContain("no-links");
    expect(rules).toContain("unapproved-link");
  });
});

describe("gradeRespondDraft", () => {
  it("passes a known-clean frozen draft with zero violations", () => {
    const c = pickRespondCase((c) => !!c.frozenDraft && !c.notes?.startsWith("positive-grounding"));
    const result = gradeRespondDraft(c.frozenDraft!, c);
    expect(result).toEqual({ caseId: c.id, brain: "respond", violations: [], pass: true });
  });

  it("fails a hand-built dirty draft — banned phrase, ungrounded metric, and a bare link, all flagged", () => {
    const c = pickRespondCase((c) => !c.grounding.includes(UNGROUNDED_METRIC));
    const dirty = { message: DIRTY_TEXT, violations: [] };

    const result = gradeRespondDraft(dirty, c);

    expect(result.pass).toBe(false);
    const rules = result.violations.map((v) => v.rule);
    expect(rules).toContain("banned-phrase");
    expect(rules).toContain("ungrounded-claim");
    expect(rules).toContain("unapproved-link");
  });
});

describe("positive-grounding (2 corpus cases cite a real grounded metric)", () => {
  it("the linkedin case cites the grounded 40% and is accepted, not flagged", () => {
    const c = pickLinkedinCase((c) => c.notes?.startsWith("positive-grounding") ?? false);
    expect(c.id).toBe("li-logistics-ops-director-dispatch");
    const draft = c.frozenDraft!;
    expect(`${draft.connectionNote} ${draft.followupMessage}`).toContain("40%");

    const result = gradeLinkedinDraft(draft, c, c.input.context.accountName);
    expect(result.pass).toBe(true);
    expect(result.violations).toEqual([]);
  });

  it("the respond case cites the grounded $1.2M and is accepted, not flagged", () => {
    const c = pickRespondCase((c) => c.notes?.startsWith("positive-grounding") ?? false);
    expect(c.id).toBe("re-manufacturing-plant-manager-downtime");
    const draft = c.frozenDraft!;
    expect(draft.message).toContain("$1.2M");

    const result = gradeRespondDraft(draft, c);
    expect(result.pass).toBe(true);
    expect(result.violations).toEqual([]);
  });
});

describe('runDeterministic("frozen")', () => {
  it("lints every corpus fixture's frozenDraft and passes at 100% (every baseline is clean by construction — the regression guard)", async () => {
    const { results, passRate } = await runDeterministic("frozen");

    expect(passRate).toBe(1);
    expect(results.length).toBe(linkedinCorpus.length + respondCorpus.length);
    for (const r of results) {
      expect(r.pass, `${r.brain}/${r.caseId}: ${JSON.stringify(r.violations)}`).toBe(true);
    }
  });
});

describe('runDeterministic("live")', () => {
  it("catches a prompt regression: a mock model that only ever produces dirty copy drops passRate below 1", async () => {
    const model = new MockLanguageModelV3({
      doGenerate: async () =>
        textResponse({
          connection_note: "Fine note, nothing wrong here.",
          followup_message: DIRTY_TEXT,
          message: DIRTY_TEXT,
        }),
    });

    const { results, passRate } = await runDeterministic("live", model);

    expect(passRate).toBeLessThan(1);
    expect(results.length).toBe(linkedinCorpus.length + respondCorpus.length);
    expect(results.every((r) => !r.pass)).toBe(true);
  });
});
