import { describe, expect, it } from "vitest";
import {
  loadCopyLinkedinCorpus,
  loadCopyRespondCorpus,
  type CopyLinkedinCase,
  type CopyRespondCase,
} from "./corpus";

/**
 * Fixture-integrity guardrail for the golden-set corpora (Phase 2B, Task 3). This is NOT the
 * frozen-lint gate (that's Task 4, run against the real humanizer/grounding graders) — this test
 * only proves the JSON fixtures are well-formed, unique, and safe to ship: every case parses into
 * a valid brain input, every URL is an obviously-fake domain, and no real vendor name leaked into
 * an anonymized case (white-label rule, .claude/rules/03-05).
 */

// Every fixture URL must be a reserved-for-documentation ".example" domain (RFC 2606), or an
// explicitly whitelisted fake booking domain — never a real, resolvable host.
const ALLOWED_URL = /\.example\b|\b(?:book|meet|schedule)\.(?:test|invalid)\b/i;

// Reuse the white-label deny-list convention from packages/help-content/src/articles.test.ts,
// extended with the vendors this brief calls out by name (Clay, HubSpot, LinkedIn-as-a-company).
const VENDOR_DENYLIST =
  /\b(unipile|explorium|agentsource|smartlead|smartsenders|clay|hubspot|linkedin|anthropic|claude|trigger\.dev|supabase|higgsfield)\b/i;

const isNonEmptyString = (v: unknown): v is string => typeof v === "string" && v.length > 0;
const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string");
const isNullableString = (v: unknown): v is string | null | undefined =>
  v === undefined || v === null || typeof v === "string";

function assertValidCopyLead(lead: unknown, ctx: string): void {
  expect(lead, ctx).toBeTypeOf("object");
  const l = lead as Record<string, unknown>;
  for (const field of ["firstName", "lastName", "title", "companyName", "industry"]) {
    expect(isNullableString(l[field]), `${ctx}.${field} should be string|null|undefined`).toBe(true);
  }
}

function assertValidStoredInsights(insights: unknown, ctx: string): void {
  expect(insights, ctx).toBeTypeOf("object");
  const i = insights as Record<string, unknown>;
  expect(isStringArray(i.pain_points), `${ctx}.pain_points`).toBe(true);
  expect(isStringArray(i.triggers), `${ctx}.triggers`).toBe(true);
  expect(isStringArray(i.motivations), `${ctx}.motivations`).toBe(true);
  expect(isNonEmptyString(i.value_angle), `${ctx}.value_angle`).toBe(true);
  expect(isNonEmptyString(i.aha_moment), `${ctx}.aha_moment`).toBe(true);
  expect(isNonEmptyString(i.summary), `${ctx}.summary`).toBe(true);
  if (i.prospect_offering !== undefined) {
    expect(isNonEmptyString(i.prospect_offering), `${ctx}.prospect_offering`).toBe(true);
  }
}

function assertValidCopyContext(context: unknown, ctx: string): void {
  expect(context, ctx).toBeTypeOf("object");
  const c = context as Record<string, unknown>;
  expect(isNonEmptyString(c.cta), `${ctx}.cta`).toBe(true);
  for (const field of ["bookingUrl", "websiteUrl", "accountName", "accountIndustry", "valueProp", "brandVoice", "guardrails"]) {
    expect(isNullableString(c[field]), `${ctx}.${field}`).toBe(true);
  }
  if (c.contentLinks !== undefined) expect(isStringArray(c.contentLinks), `${ctx}.contentLinks`).toBe(true);
  if (c.avoidPhrases !== undefined) expect(isStringArray(c.avoidPhrases), `${ctx}.avoidPhrases`).toBe(true);
  if (c.winningExemplars !== undefined) expect(isStringArray(c.winningExemplars), `${ctx}.winningExemplars`).toBe(true);
  if (c.proofPoints !== undefined) {
    expect(Array.isArray(c.proofPoints), `${ctx}.proofPoints`).toBe(true);
    for (const p of c.proofPoints as unknown[]) {
      const point = p as Record<string, unknown>;
      expect(["metric", "outcome", "pricing", "faq"], `${ctx}.proofPoints[].kind`).toContain(point.kind);
      expect(isNonEmptyString(point.text), `${ctx}.proofPoints[].text`).toBe(true);
    }
  }
  if (c.strategy !== undefined) expect(c.strategy, `${ctx}.strategy`).toBeTypeOf("object");
}

function assertValidLinkedinCase(c: CopyLinkedinCase): void {
  expect(isNonEmptyString(c.id), "id").toBe(true);
  expect(/^[a-z0-9]+(-[a-z0-9]+)*$/.test(c.id), `id "${c.id}" should be kebab-case`).toBe(true);
  assertValidCopyLead(c.input.lead, `${c.id}.input.lead`);
  assertValidStoredInsights(c.input.insights, `${c.id}.input.insights`);
  assertValidCopyContext(c.input.context, `${c.id}.input.context`);
  expect(isNonEmptyString(c.grounding), `${c.id}.grounding`).toBe(true);
  if (c.frozenDraft) {
    expect(isNonEmptyString(c.frozenDraft.connectionNote), `${c.id}.frozenDraft.connectionNote`).toBe(true);
    expect(isNonEmptyString(c.frozenDraft.followupMessage), `${c.id}.frozenDraft.followupMessage`).toBe(true);
    expect(Array.isArray(c.frozenDraft.violations), `${c.id}.frozenDraft.violations`).toBe(true);
  }
}

function assertValidRespondCase(c: CopyRespondCase): void {
  expect(isNonEmptyString(c.id), "id").toBe(true);
  expect(/^[a-z0-9]+(-[a-z0-9]+)*$/.test(c.id), `id "${c.id}" should be kebab-case`).toBe(true);
  assertValidCopyLead(c.input.lead, `${c.id}.input.lead`);
  assertValidStoredInsights(c.input.insights, `${c.id}.input.insights`);
  assertValidCopyContext(c.input.context, `${c.id}.input.context`);
  expect(Array.isArray(c.input.thread), `${c.id}.input.thread`).toBe(true);
  for (const turn of c.input.thread) {
    expect(["agent", "lead"], `${c.id}.input.thread[].role`).toContain(turn.role);
    expect(isNonEmptyString(turn.text), `${c.id}.input.thread[].text`).toBe(true);
  }
  if (c.input.incoming !== undefined) {
    expect(isNonEmptyString(c.input.incoming), `${c.id}.input.incoming`).toBe(true);
  }
  if (c.input.classification !== undefined) {
    expect(
      ["interested", "not_interested", "neutral", "out_of_office", "unsubscribe", "other"],
      `${c.id}.input.classification`
    ).toContain(c.input.classification);
  }
  expect(isNonEmptyString(c.grounding), `${c.id}.grounding`).toBe(true);
  if (c.frozenDraft) {
    expect(isNonEmptyString(c.frozenDraft.message), `${c.id}.frozenDraft.message`).toBe(true);
    expect(Array.isArray(c.frozenDraft.violations), `${c.id}.frozenDraft.violations`).toBe(true);
  }
}

/** Every http(s) URL appearing anywhere in a case's serialized JSON. */
function extractUrls(caseObj: unknown): string[] {
  const json = JSON.stringify(caseObj);
  return json.match(/https?:\/\/[^\s"\\]+/g) ?? [];
}

describe("loadCopyLinkedinCorpus", () => {
  const cases = loadCopyLinkedinCorpus();

  it("loads a non-trivial corpus", () => {
    expect(cases.length).toBeGreaterThanOrEqual(15);
  });

  it("every id is unique", () => {
    const ids = cases.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every case is shape-valid", () => {
    for (const c of cases) assertValidLinkedinCase(c);
  });

  it("every URL is an obviously-fake domain", () => {
    for (const c of cases) {
      for (const url of extractUrls(c)) {
        expect(ALLOWED_URL.test(url), `${c.id}: "${url}" is not an allowed fake domain`).toBe(true);
      }
    }
  });

  it("never leaks a real vendor name (white-label rule)", () => {
    for (const c of cases) {
      expect(JSON.stringify(c), c.id).not.toMatch(VENDOR_DENYLIST);
    }
  });
});

describe("loadCopyRespondCorpus", () => {
  const cases = loadCopyRespondCorpus();

  it("loads a non-trivial corpus", () => {
    expect(cases.length).toBeGreaterThanOrEqual(15);
  });

  it("every id is unique", () => {
    const ids = cases.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every case is shape-valid", () => {
    for (const c of cases) assertValidRespondCase(c);
  });

  it("spans interested / not_interested / neutral classifications", () => {
    const seen = new Set(cases.map((c) => c.input.classification).filter(Boolean));
    expect(seen.has("interested")).toBe(true);
    expect(seen.has("not_interested")).toBe(true);
    expect(seen.has("neutral")).toBe(true);
  });

  it("every URL is an obviously-fake domain", () => {
    for (const c of cases) {
      for (const url of extractUrls(c)) {
        expect(ALLOWED_URL.test(url), `${c.id}: "${url}" is not an allowed fake domain`).toBe(true);
      }
    }
  });

  it("never leaks a real vendor name (white-label rule)", () => {
    for (const c of cases) {
      expect(JSON.stringify(c), c.id).not.toMatch(VENDOR_DENYLIST);
    }
  });
});

describe("cross-corpus id uniqueness", () => {
  it("no id collides between the two corpora", () => {
    const all = [...loadCopyLinkedinCorpus().map((c) => c.id), ...loadCopyRespondCorpus().map((c) => c.id)];
    expect(new Set(all).size).toBe(all.length);
  });
});
