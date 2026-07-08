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
  "pick your brain",
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
  // additional high-signal slop / spam markers (unambiguous — won't appear in genuine copy)
  "quick question",
  "hope you don't mind",
  "i'll keep this brief",
  "i'll keep this short",
  "worth a chat",
  "worth a quick chat",
  "worth a quick call",
  "at your convenience",
  "move the needle",
  "low-hanging fruit",
  "loop back",
  "touch base",
  "best-in-class",
  "best in class",
  "world-class",
  "thought leader",
  "needless to say",
  "hit the ground running",
  "synergy",
  "as promised",
  "per my last",
  "does this resonate",
  // conversational-voice pass (2026-07-08, owner directive): the newer AI-tell vocabulary —
  // business-speak verbs and template warmth that read machine-written in a DM. Substring
  // matched, so verb forms are covered too (leveraging, delved, utilized…).
  "i'm reaching out",
  "im reaching out",
  "reaching out to",
  "caught my eye",
  "caught my attention",
  "your journey",
  "truly impressive",
  "thrilled",
  "kudos",
  "delve",
  "utilize",
  "leverage",
  "streamline",
  "elevate",
  "empower",
  "state of the art",
  "state-of-the-art",
  "excited to connect",
  "eager to connect",
  "looking forward to hearing",
  "don't hesitate",
  "feel free to",
];

// Phrases that re-introduce or cold-open — always wrong MID-CONVERSATION: a reply or scripted
// follow-up must build on the thread, never restart. Enforced for the conversation responder only,
// not the first-touch copy (where introducing yourself is the whole point).
const RESTART_PHRASES = [
  "wanted to connect",
  "saw you reacted",
  "reaching out because",
  "let me introduce",
  "thought i'd reach out",
  // NB: "quick intro" is deliberately NOT here — it's a legitimate soft CTA ("open to a quick
  // intro?"), so flagging it would fight the ask. Only unambiguous cold-opens belong in this list.
];

const HEDGES = ["just", "perhaps", "maybe", "i think", "i believe", "possibly"];

export interface HumanityLimits {
  maxWords?: number;
  maxChars?: number;
}

export function validateHumanity(text: string, limits: HumanityLimits = {}): Violation[] {
  const violations: Violation[] = [];
  // Curly apostrophes normalize to straight so "don't hesitate" can't dodge the phrase list.
  const lower = text.toLowerCase().replace(/[‘’]/g, "'");
  // URLs are exempt from punctuation lints (a whitelisted booking slug may contain "--").
  const noUrls = text.replace(/https?:\/\/[^\s]+/gi, " ");

  for (const phrase of BANNED_PHRASES) {
    if (lower.includes(phrase)) {
      violations.push({ rule: "banned-phrase", detail: `remove "${phrase}"` });
    }
  }

  // ANY dash used as punctuation is machine voice (zero tolerance since 2026-07-08, owner
  // directive; was "at most one"): em/en dashes anywhere, doubled or spaced hyphens between
  // words. Hyphenated words ("co-founder", "15-min") stay legal.
  const dashes = (noUrls.match(/[—–]|--|\s-\s/g) ?? []).length;
  if (dashes > 0) {
    violations.push({
      rule: "dashes",
      detail: `${dashes} dash(es) used as punctuation; use a comma or start a new sentence`,
    });
  }

  // Nobody semicolons a DM. Two sentences read human; a semicolon reads generated.
  if (noUrls.includes(";")) {
    violations.push({ rule: "semicolon", detail: "no semicolons in a chat message, split it into two sentences" });
  }

  // Bullet/numbered lines are generated formatting, never chat.
  if (/^\s*(?:[-•*]|\d+[.)])\s+/m.test(noUrls)) {
    violations.push({ rule: "list-format", detail: "no bullet or numbered lists, write flowing sentences" });
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

/**
 * Mid-conversation guard: flags re-introduction / cold-open phrases in a reply or scripted follow-up.
 * The responder is told never to restart the thread; this is the enforcement floor for that rule, so
 * a model slip ("Wanted to connect…") is caught and regenerated/reviewed rather than sent as if it
 * were a first message. Use only for the conversation responder, never for first-touch outreach.
 */
export function findRestartPhrases(text: string): Violation[] {
  const lower = text.toLowerCase();
  const violations: Violation[] = [];
  for (const phrase of RESTART_PHRASES) {
    if (lower.includes(phrase)) {
      violations.push({
        rule: "restart",
        detail: `mid-conversation message must not re-introduce or cold-open ("${phrase}")`,
      });
    }
  }
  return violations;
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

// Completed platform actions the agent physically cannot perform — sending messages is its
// only capability. "Just joined your group" shipped to a real prospect on 2026-07-08; a
// fabricated action is the same trust-killer as a fabricated metric (report pain point #6).
// Observation verbs (read/saw/noticed) are NOT flagged: the agent genuinely observes posts
// and activity through its grounding data.
const ACTION_CLAIM_PATTERN =
  /\b(?:just\s+|i(?:'ve|\s+have)\s+(?:just\s+)?|i\s+(?:just\s+)?)(joined|signed\s+up|subscribed|registered|downloaded|installed|booked|enrolled)\b/i;

/**
 * Flags claims of completed actions the agent cannot have performed (joining groups,
 * signing up, downloading…). Conversation-responder only — the enforcement floor for
 * "you can only send messages".
 */
export function findActionClaims(text: string): Violation[] {
  const match = text.match(ACTION_CLAIM_PATTERN);
  if (!match) return [];
  return [
    {
      rule: "action-claim",
      detail: `claims to have "${match[1]}" — the agent can only send messages, never claim other actions`,
    },
  ];
}

/**
 * Link whitelist for mid-conversation messages: the only URLs allowed are the seller's
 * booking link and their Add-Content links (from the facts block). Anything else — invented
 * domains, pasted articles — is flagged. First-touch copy stays fully link-free (see
 * validateLinkedInDraft); this is the conversation-stage counterpart.
 */
export function findUnapprovedLinks(text: string, allowed: string[]): Violation[] {
  const urls = text.match(/https?:\/\/[^\s)>"']+/gi) ?? [];
  const violations: Violation[] = [];
  const allowedNorm = allowed.filter(Boolean).map((a) => a.toLowerCase().replace(/\/+$/, ""));
  for (const url of urls) {
    const norm = url.toLowerCase().replace(/[.,;!?]+$/, "").replace(/\/+$/, "");
    if (!allowedNorm.some((a) => norm === a || norm.startsWith(a))) {
      violations.push({ rule: "unapproved-link", detail: `"${url}" is not an approved link` });
    }
  }
  return violations;
}
