import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { LanguageModel } from "ai";
import {
  classifyReply,
  classifyIntent,
  type ReplyVerdict,
  type IntentObservationInput,
  type IntentContext,
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

export const REPLY_INTERESTED_RECALL_FLOOR = 0.9;
export const INTENT_RECALL_FLOOR = 0.85;
export const INTENT_PRECISION_FLOOR = 0.8;

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
