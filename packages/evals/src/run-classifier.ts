import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { LanguageModel } from "ai";
import {
  classifyReply,
  classifyIntent,
  rankLeads,
  type ReplyVerdict,
  type IntentObservationInput,
  type IntentContext,
  type RankCandidate,
  type RankContext,
} from "@vantera/agent-brains";
import { getModel } from "@vantera/ai";
import { recall, precision, type FloorReport } from "./graders/classifier";

/**
 * Classifier accuracy floors (Phase 2B, Task 5) for the two brains that gate the funnel before
 * anything reaches a human or costs enrichment spend: `classifyReply` (reply/classify) and
 * `classifyIntent` (intent/classify). Each labeled set is a small, hand-reviewed, CLEAR-CUT
 * fixture (owner reviews once) — this is a floor check, not a statistically representative
 * accuracy benchmark.
 *
 * Rationale for the floors gated here:
 * - `reply.interested_recall` (>= 0.90): a missed `interested` reply is the most expensive
 *   classifier error in the product — a real buyer silently drops out of the funnel with no
 *   human ever seeing it. This is the ONE load-bearing floor for the reply classifier.
 *   `needs_human` precision (the spec's other candidate metric) is a downstream reply-backlog
 *   PIPELINE concern (rule 08's review-queue routing), not a classifier label — noted here, not
 *   gated in this suite.
 * - `intent.recall` (>= 0.85) / `intent.precision` (>= 0.80): these bound the high+medium
 *   in-market gate that runs BEFORE ICP qualification (rule 05/06) — recall protects against
 *   missed in-market buyers, precision protects enrichment spend from being wasted on social
 *   noise that only looks like intent.
 */

export type ReplyLabel = { id: string; body: string; expected: ReplyVerdict["classification"] };
export type IntentLabel = {
  id: string;
  obs: IntentObservationInput;
  ctx: IntentContext;
  expectedIsIntent: boolean;
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_ROOT = join(__dirname, "..", "fixtures");

/**
 * Reads every `*.json` file in `fixtures/<subdir>` and concatenates their arrays (mirrors
 * `corpus.ts`'s directory-read convention from Task 3 — a fixture subdir is never a static
 * `import`, since this runs under vitest's node environment). Floor fixtures currently ship as
 * one flat `labeled.json` array per subdir rather than one-file-per-case, but the loader still
 * reads the directory so a future split into multiple labeled files is a one-file-add, not a
 * loader change.
 */
function readLabeledArray<T>(subdir: string): T[] {
  const dir = join(FIXTURES_ROOT, subdir);
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort();
  return files.flatMap((f) => JSON.parse(readFileSync(join(dir, f), "utf8")) as T[]);
}

export function loadReplyLabels(): ReplyLabel[] {
  return readLabeledArray<ReplyLabel>("classify-reply");
}

export function loadIntentLabels(): IntentLabel[] {
  return readLabeledArray<IntentLabel>("classify-intent");
}

export function loadIntentHardLabels(): IntentLabel[] {
  return readLabeledArray<IntentLabel>("classify-intent-hard");
}

/**
 * One labeled rank case. `expectOfferingDirection` is optional — when set, `prospect_offering`
 * must not flip buyer vs seller (see `offeringDirectionMatches`). Matcher lives next to this
 * type rather than in the JSON so the fixture stays data-only.
 */
export type RankLabel = {
  id: string;
  candidate: RankCandidate;
  ctx: RankContext;
  expectQualified: boolean;
  expectOfferingDirection?: "buyer" | "seller";
};

export function loadRankLabels(): RankLabel[] {
  return readLabeledArray<RankLabel>("rank-leads");
}

export const REPLY_INTERESTED_RECALL_FLOOR = 0.9;
export const INTENT_RECALL_FLOOR = 0.85;
export const INTENT_PRECISION_FLOOR = 0.8;
export const INTENT_HARD_PRECISION_FLOOR = 0.85;
export const INTENT_HARD_RECALL_FLOOR = 0.8;
export const RANK_QUALIFY_PRECISION_FLOOR = 0.8;
export const RANK_QUALIFY_RECALL_FLOOR = 0.85;
export const RANK_OFFERING_DIRECTION_FLOOR = 0.9;
/** Same bar as Scout `min_score` (rule 06) — evals must not import `@vantera/jobs`. */
export const RANK_QUALIFY_MIN = 70;

/**
 * High-precision check that `prospect_offering` did not recast a seller as a buyer (or vice versa).
 *
 * - `seller`: their title *provides* a service (e.g. "I help founders get 10-20 inbound leads").
 *   Fail if offering recasts them as looking for / needing inbound, or as "running lead gen for N founders"
 *   (the classic number-attachment flip).
 * - `buyer`: they *have* the problem (VP CS, Head of Talent). Fail if offering recasts them as a
 *   provider of inbound / lead-gen for founders.
 */
export function offeringDirectionMatches(offering: string, expected: "buyer" | "seller"): boolean {
  const t = offering.toLowerCase();
  if (!t.trim()) return false;
  if (expected === "seller") {
    return !/\b(looking for|need(?:s|ing)?|evaluating|want(?:s|ing)? more|buy(?:ing)?)\b.{0,60}\b(inbound|leads)\b/.test(t)
      && !/\brun[s]?\s+lead[\s-]?gen(?:eration)?\s+for\b/.test(t);
  }
  return !/\bhelp(?:s|ing)?\s+founders\s+get\b/.test(t)
    && !/\binbound[\s-]?leads?\b.{0,40}\b(agency|service|for (?:clients|founders))\b/.test(t);
}

/**
 * Maps every labeled reply body through `classifyReply(body, model)` and computes
 * interested-recall against the `expected` labels. Note: `classifyReply` short-circuits
 * unsubscribe/out-of-office bodies via the deterministic `preClassify` pre-pass BEFORE ever
 * calling the model — that path still produces a real classification for this function's
 * purposes (it's counted exactly like a model-derived one), since a labeled unsubscribe/OOO case
 * is still a fixture entry the classifier as a whole must get right.
 */
export async function runReplyFloors(model: LanguageModel = getModel()): Promise<FloorReport[]> {
  const labels = loadReplyLabels();
  const preds: string[] = [];
  for (const label of labels) {
    const verdict = await classifyReply(label.body, model);
    preds.push(verdict.classification);
  }
  const expected = labels.map((l) => l.expected);
  const value = recall(preds, expected, "interested");
  return [
    {
      metric: "reply.interested_recall",
      value,
      floor: REPLY_INTERESTED_RECALL_FLOOR,
      pass: value >= REPLY_INTERESTED_RECALL_FLOOR,
      n: labels.length,
    },
  ];
}

/**
 * Batches every labeled intent observation through `classifyIntent`, grouping labels by an
 * identical `IntentContext` first so each `classifyIntent` call gets every observation that
 * shares a seller context (its own internal `INTENT_BATCH_SIZE` chunking still applies) — this is
 * the "batching" the design calls for, not one `classifyIntent` call per label. Computes
 * intent-recall and intent-precision of the normalized `is_intent` boolean (already coupled to
 * `level ∈ {high, medium}` by `normalizeVerdict`) against `expectedIsIntent`.
 */
export async function runIntentFloors(model: LanguageModel = getModel()): Promise<FloorReport[]> {
  const labels = loadIntentLabels();

  const groups = new Map<string, { ctx: IntentContext; labels: IntentLabel[] }>();
  for (const label of labels) {
    const key = JSON.stringify(label.ctx);
    const existing = groups.get(key);
    if (existing) existing.labels.push(label);
    else groups.set(key, { ctx: label.ctx, labels: [label] });
  }

  const isIntentByRef = new Map<string, boolean>();
  for (const group of groups.values()) {
    const verdicts = await classifyIntent(
      group.labels.map((l) => l.obs),
      group.ctx,
      model
    );
    for (const v of verdicts) isIntentByRef.set(v.ref, v.is_intent);
  }

  const preds = labels.map((l) => isIntentByRef.get(l.obs.ref) ?? false);
  const expected = labels.map((l) => l.expectedIsIntent);

  // recall is the generic string-class metric; here the "class" is the boolean is-intent domain,
  // so we stringify each boolean and treat "true" as the positive class — deliberate reuse of the
  // one recall implementation rather than a second boolean-only variant. precision already takes
  // booleans directly, so no coercion there.
  const recallValue = recall(
    preds.map((p) => String(p)),
    expected.map((e) => String(e)),
    "true"
  );
  const precisionValue = precision(preds, expected);

  return [
    {
      metric: "intent.recall",
      value: recallValue,
      floor: INTENT_RECALL_FLOOR,
      pass: recallValue >= INTENT_RECALL_FLOOR,
      n: labels.length,
    },
    {
      metric: "intent.precision",
      value: precisionValue,
      floor: INTENT_PRECISION_FLOOR,
      pass: precisionValue >= INTENT_PRECISION_FLOOR,
      n: labels.length,
    },
  ];
}

async function classifyLabeledIntent(
  labels: IntentLabel[],
  model: LanguageModel
): Promise<{ preds: boolean[]; expected: boolean[] }> {
  const groups = new Map<string, { ctx: IntentContext; labels: IntentLabel[] }>();
  for (const label of labels) {
    const key = JSON.stringify(label.ctx);
    const existing = groups.get(key);
    if (existing) existing.labels.push(label);
    else groups.set(key, { ctx: label.ctx, labels: [label] });
  }

  const isIntentByRef = new Map<string, boolean>();
  for (const group of groups.values()) {
    const verdicts = await classifyIntent(
      group.labels.map((l) => l.obs),
      group.ctx,
      model
    );
    for (const v of verdicts) isIntentByRef.set(v.ref, v.is_intent);
  }

  return {
    preds: labels.map((l) => isIntentByRef.get(l.obs.ref) ?? false),
    expected: labels.map((l) => l.expectedIsIntent),
  };
}

/**
 * Hard-intent floor: likes with empty evidence, congratulations, "anyone recommend X", and
 * on-topic posts with no buying language. Do not mix into the 24 clear-cut `classify-intent` rows.
 * Empty-text reactions take the deterministic `none` path (no model call).
 */
export async function runIntentHardFloors(model: LanguageModel = getModel()): Promise<FloorReport[]> {
  const labels = loadIntentHardLabels();
  const { preds, expected } = await classifyLabeledIntent(labels, model);
  const positiveCount = expected.filter(Boolean).length;

  const recallValue = recall(
    preds.map((p) => String(p)),
    expected.map((e) => String(e)),
    "true"
  );
  const precisionValue = precision(preds, expected);

  const reports: FloorReport[] = [
    {
      metric: "intent.hard_precision",
      value: precisionValue,
      floor: INTENT_HARD_PRECISION_FLOOR,
      pass: precisionValue >= INTENT_HARD_PRECISION_FLOOR,
      n: labels.length,
    },
  ];
  if (positiveCount >= 5) {
    reports.push({
      metric: "intent.hard_recall",
      value: recallValue,
      floor: INTENT_HARD_RECALL_FLOOR,
      pass: recallValue >= INTENT_HARD_RECALL_FLOOR,
      n: labels.length,
    });
  }
  return reports;
}

/**
 * Rank floors over the labeled `rank-leads` set. Calls production `rankLeads` grouped by seller
 * context. Qualify uses score >= RANK_QUALIFY_MIN (70). Direction uses `offeringDirectionMatches`.
 */
export async function runRankFloors(model: LanguageModel = getModel()): Promise<FloorReport[]> {
  const labels = loadRankLabels();

  const groups = new Map<string, { ctx: RankContext; labels: RankLabel[] }>();
  for (const label of labels) {
    const key = JSON.stringify(label.ctx);
    const existing = groups.get(key);
    if (existing) existing.labels.push(label);
    else groups.set(key, { ctx: label.ctx, labels: [label] });
  }

  const byId = new Map<string, { score: number; prospect_offering: string }>();
  for (const group of groups.values()) {
    const insights = await rankLeads(
      group.labels.map((l) => l.candidate),
      group.ctx,
      model
    );
    for (const i of insights) {
      byId.set(i.lead_id, { score: i.score, prospect_offering: i.prospect_offering });
    }
  }

  const predsQualified = labels.map((l) => (byId.get(l.candidate.leadId)?.score ?? 0) >= RANK_QUALIFY_MIN);
  const expectedQualified = labels.map((l) => l.expectQualified);
  const qualifyPrecision = precision(predsQualified, expectedQualified);
  const qualifyRecall = recall(
    predsQualified.map((p) => String(p)),
    expectedQualified.map((e) => String(e)),
    "true"
  );

  const directional = labels.filter((l) => l.expectOfferingDirection);
  const directionHits = directional.map((l) =>
    offeringDirectionMatches(
      byId.get(l.candidate.leadId)?.prospect_offering ?? "",
      l.expectOfferingDirection!
    )
  );
  const directionValue =
    directionHits.length === 0 ? 1 : directionHits.filter(Boolean).length / directionHits.length;

  return [
    {
      metric: "rank.qualify_precision",
      value: qualifyPrecision,
      floor: RANK_QUALIFY_PRECISION_FLOOR,
      pass: qualifyPrecision >= RANK_QUALIFY_PRECISION_FLOOR,
      n: labels.length,
    },
    {
      metric: "rank.qualify_recall",
      value: qualifyRecall,
      floor: RANK_QUALIFY_RECALL_FLOOR,
      pass: qualifyRecall >= RANK_QUALIFY_RECALL_FLOOR,
      n: labels.length,
    },
    {
      metric: "rank.offering_direction",
      value: directionValue,
      floor: RANK_OFFERING_DIRECTION_FLOOR,
      pass: directionValue >= RANK_OFFERING_DIRECTION_FLOOR,
      n: directional.length,
    },
  ];
}
