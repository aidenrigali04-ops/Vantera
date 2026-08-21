import { describe, expect, it } from "vitest";
import { loadReplyLabels, loadIntentLabels, type ReplyLabel } from "./run-classifier";

/**
 * Fixture-integrity guardrail for the classifier floor labeled sets (Phase 2B, Task 5) — mirrors
 * `corpus.test.ts`'s contract for the copy golden sets (Task 3): proves the JSON labels are
 * well-formed, unique, unambiguous-by-enum, and safe to ship. This is NOT the floor gate itself
 * (that's `graders/classifier.test.ts` exercising `runReplyFloors`/`runIntentFloors` against a
 * mock model) — only shape + hygiene here.
 */

const REPLY_CLASSES: ReplyLabel["expected"][] = [
  "interested",
  "not_interested",
  "neutral",
  "out_of_office",
  "unsubscribe",
  "other",
];

// Same white-label deny-list convention as packages/evals/src/corpus.test.ts, extended with the
// two competitor names this brief calls out by name (rule 01 — Vantera "replaces Waalaxy and
// Goji Berry"). "linkedin" is deliberately NOT denied here: LinkedIn is the disclosed channel
// itself (rule 04), not a white-labeled vendor like Unipile/Explorium.
const VENDOR_DENYLIST =
  /\b(unipile|explorium|agentsource|smartlead|smartsenders|clay|hubspot|waalaxy|goji ?berry|anthropic|claude|trigger\.dev|supabase|higgsfield)\b/i;

describe("loadReplyLabels", () => {
  const labels = loadReplyLabels();

  it("loads a non-trivial, clear-cut labeled set", () => {
    expect(labels.length).toBeGreaterThanOrEqual(24);
  });

  it("every id is unique", () => {
    const ids = labels.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every body is a non-empty string", () => {
    for (const l of labels) expect(l.body.length, l.id).toBeGreaterThan(0);
  });

  it("every expected label is a valid ReplyVerdict classification", () => {
    for (const l of labels) {
      expect(REPLY_CLASSES, l.id).toContain(l.expected);
    }
  });

  it("spans every classification at least once (unambiguous coverage, not just interested/not)", () => {
    const seen = new Set(labels.map((l) => l.expected));
    for (const cls of REPLY_CLASSES) expect(seen.has(cls), cls).toBe(true);
  });

  it("has enough interested cases to make a 0.90 recall floor meaningful", () => {
    expect(labels.filter((l) => l.expected === "interested").length).toBeGreaterThanOrEqual(5);
  });

  it("never leaks a real vendor name (white-label rule)", () => {
    for (const l of labels) expect(JSON.stringify(l), l.id).not.toMatch(VENDOR_DENYLIST);
  });
});

describe("loadIntentLabels", () => {
  const labels = loadIntentLabels();

  it("loads a non-trivial, clear-cut labeled set", () => {
    expect(labels.length).toBeGreaterThanOrEqual(20);
  });

  it("every id is unique", () => {
    const ids = labels.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every observation ref is unique (classifyIntent maps verdicts back onto ref)", () => {
    const refs = labels.map((l) => l.obs.ref);
    expect(new Set(refs).size).toBe(refs.length);
  });

  it("every observation has non-empty text and a valid signalKind", () => {
    for (const l of labels) {
      expect(l.obs.text.trim().length, l.id).toBeGreaterThan(0);
      expect(["engagement", "content"], l.id).toContain(l.obs.signalKind);
    }
  });

  it("spans both true and false expectedIsIntent cases", () => {
    const seen = new Set(labels.map((l) => l.expectedIsIntent));
    expect(seen.has(true)).toBe(true);
    expect(seen.has(false)).toBe(true);
  });

  it("spans more than one seller context (exercises the ctx-batching grouping)", () => {
    const distinctCtx = new Set(labels.map((l) => JSON.stringify(l.ctx)));
    expect(distinctCtx.size).toBeGreaterThan(1);
  });

  it("never leaks a real vendor name (white-label rule)", () => {
    for (const l of labels) expect(JSON.stringify(l), l.id).not.toMatch(VENDOR_DENYLIST);
  });
});
