/**
 * Deterministic AI-slop linter. The copy system prompts carry the style rules;
 * this validator is the enforcement floor — a single bounded regenerate fixes
 * violations, and anything that still fails is flagged for the review queue
 * rather than silently shipped (everything is human-reviewed pre-Phase-5).
 * One LLM pass + code validation beats a second "humanize" LLM pass: half the
 * cost and latency, fully testable, and it can't reintroduce slop.
 */

export interface Violation {
  rule: string;
  detail: string;
}

// phrases that mark machine-written or template outreach; matched case-insensitively
const BANNED_PHRASES = [
  "i hope this finds you well",
  "i hope this email finds you",
  "hope you're doing well",
  "hope you are doing well",
  "i wanted to reach out",
  "i came across your",
  "i stumbled upon",
  "just checking in",
  "touching base",
  "circle back",
  "i know you're busy",
  "i'd love to pick your brain",
  "in today's fast-paced",
  "game-changer",
  "game changer",
  "revolutionize",
  "cutting-edge",
  "seamless",
  "supercharge",
  "unlock the",
  "take it to the next level",
  "big fan of",
  "love what you're doing",
  "as an ai",
];

const HEDGES = ["just", "perhaps", "maybe", "i think", "i believe", "possibly"];

export interface HumanityLimits {
  maxWords?: number;
  maxChars?: number;
}

export function validateHumanity(text: string, limits: HumanityLimits = {}): Violation[] {
  const violations: Violation[] = [];
  const lower = text.toLowerCase();

  for (const phrase of BANNED_PHRASES) {
    if (lower.includes(phrase)) {
      violations.push({ rule: "banned-phrase", detail: `remove "${phrase}"` });
    }
  }

  const emDashes = (text.match(/—/g) ?? []).length;
  if (emDashes > 1) {
    violations.push({ rule: "em-dashes", detail: `${emDashes} em-dashes; use at most 1` });
  }

  const exclamations = (text.match(/!/g) ?? []).length;
  if (exclamations > 1) {
    violations.push({ rule: "exclamations", detail: `${exclamations} exclamation marks; use at most 1` });
  }

  const hedgeHits = HEDGES.flatMap((h) => lower.match(new RegExp(`\\b${h}\\b`, "g")) ?? []);
  if (hedgeHits.length > 2) {
    violations.push({ rule: "hedging", detail: `too much hedging (${hedgeHits.join(", ")})` });
  }

  if (/^as an? /i.test(text.trim())) {
    violations.push({ rule: "opener", detail: `never open with "As a/an …"` });
  }

  if (limits.maxWords) {
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    if (words > limits.maxWords) {
      violations.push({ rule: "length", detail: `${words} words; cap is ${limits.maxWords}` });
    }
  }

  if (limits.maxChars && text.length > limits.maxChars) {
    violations.push({ rule: "length", detail: `${text.length} chars; cap is ${limits.maxChars}` });
  }

  return violations;
}

export function describeViolations(violations: Violation[]): string {
  return violations.map((v) => `${v.rule}: ${v.detail}`).join("; ");
}

// Specific metric claims a draft can fabricate: percentages, currency, multipliers. Bare
// integers (meeting durations, years, list counts) are intentionally NOT checked — low signal,
// high false-positive. A metric the copy states that doesn't appear in the grounding facts is
// the 11x-class hallucination (a confident, verifiable, fabricated number) — flag it for review.
const METRIC_PATTERNS: readonly RegExp[] = [
  /\d+(?:\.\d+)?\s?%/g, // 40%, 40 %
  /\$\s?\d[\d,]*(?:\.\d+)?\s?(?:k|m|b|bn|mm)?\b/gi, // $2M, $1,200, $1.2m
  /\b\d+(?:\.\d+)?x\b/gi, // 3x, 2.5x
];

const normalizeClaim = (s: string): string => s.replace(/\s+/g, "").toLowerCase();

/**
 * Grounding check: flags specific metric claims (%, $, Nx) in `text` that don't appear in
 * `grounding` — the per-lead facts the copy is allowed to assert (the `leadBlock`). Each
 * distinct ungrounded metric is reported once. Matching is case- and spacing-insensitive.
 */
export function findUngroundedClaims(text: string, grounding: string): Violation[] {
  const groundNorm = normalizeClaim(grounding);
  const seen = new Set<string>();
  const violations: Violation[] = [];
  for (const pattern of METRIC_PATTERNS) {
    for (const match of text.match(pattern) ?? []) {
      const token = match.trim();
      const key = normalizeClaim(token);
      if (seen.has(key)) continue;
      seen.add(key);
      if (!groundNorm.includes(key)) {
        violations.push({
          rule: "ungrounded-claim",
          detail: `"${token}" is not supported by the prospect's data`,
        });
      }
    }
  }
  return violations;
}
