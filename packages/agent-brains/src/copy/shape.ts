import type { StoredInsights } from "../prospect/schema";
import { SAFE_PROFILE, type AccountConfigProfile } from "./profile";

/**
 * Message-shape selector (spec 2026-07-20). The copy brain already personalizes CONTENT (pain,
 * trigger, insights); this makes the STRUCTURE of a first touch a bounded knob the brain chooses
 * per lead and the bandit learns per segment. Structural variety is the anti-detection mechanism:
 * when no two openers share a shape, there is no silhouette to pattern-match.
 *
 * ANTI-HALLUCINATION IS THE POINT OF THIS FILE. A shape rewrites structure, never facts. The
 * defense is layered and NO single layer is claimed to be complete:
 *   1. selectMessageShape only returns a fact-asserting shape when the grounding signal is really
 *      present (a real trigger for trigger_consequence, a real artifact for gift) — thin signal
 *      falls to the safe observation_question floor, and the bold shapes are never auto-selected.
 *   2. Each fact-asserting SHAPE_DIRECTIVE forbids inventing the premise in words.
 *   3. groundingHasShapeSignal re-checks, deterministically, that the block actually carries the
 *      signal the shape asserts (belt-and-suspenders on selection).
 *   4. The unchanged humanizer (findUngroundedClaims for numbers, findActionClaims) + the
 *      PROSPECT_ACCURACY_RULE stay in force for every shape.
 *   5. The mandatory human review queue is the backstop.
 * Non-numeric factual hallucination (a fabricated funding round, a fake competitor move) is NOT
 * caught by any single lint — it is defended by signal-gated selection + the directive + the
 * accuracy rule + the review queue TOGETHER. Do not read layer 3 as a claim that it catches all
 * hallucination; it catches the specific "shape used without its signal" case only.
 */

export const MESSAGE_SHAPES = [
  "observation_question",
  "trigger_consequence",
  "provocation",
  "gift",
  "own_cold",
  "disqualifier",
  "peer_insider",
] as const;

export type MessageShape = (typeof MESSAGE_SHAPES)[number];

/**
 * The safe subset the deterministic selector and the generator may use for ANY account. These
 * carry low social risk: a plain question, a grounded trigger, a give, a genuine peer note.
 */
export const SAFE_SHAPES: readonly MessageShape[] = [
  "observation_question",
  "trigger_consequence",
  "gift",
  "peer_insider",
];

/**
 * The bold subset: higher social risk (a contrarian claim, a take-away, an openly-cold opener).
 * NEVER deterministically auto-selected. Only PROPOSED by the generator, and only for accounts
 * pinned into `bold_shapes_account_ids` (same admin-pin pattern as `aa_canary_account_id`).
 */
export const BOLD_SHAPES: readonly MessageShape[] = ["provocation", "disqualifier", "own_cold"];

/**
 * Shapes whose framing asserts a SPECIFIC fact about the prospect (a trigger, a giftable artifact,
 * a shared-domain insider signal). These are the ones groundingHasShapeSignal re-verifies.
 * observation_question and the bold shapes assert no specific prospect fact by construction.
 */
export const FACT_ASSERTING_SHAPES: readonly MessageShape[] = [
  "trigger_consequence",
  "gift",
  "peer_insider",
];

/**
 * The prompt directive that REPLACES the default thanks/observation/question structure. Written
 * dash-free on purpose (prompt prose primes output style — the humanizer bans dashes downstream).
 * The fact-asserting shapes carry an explicit no-invention clause: a shape may reframe structure,
 * it may never manufacture the fact its structure leans on. Compliance (de-pitch + humanizer) is
 * enforced AFTER generation regardless of shape, so a directive can never buy past it.
 */
export const SHAPE_DIRECTIVE: Record<MessageShape, string> = {
  // The default structure. Never emitted as an override (it IS the default); present for
  // completeness so the record is total.
  observation_question:
    "A brief thanks, then one sharp observation about their situation, then one genuinely curious question about how they handle it today.",
  trigger_consequence:
    "Open on a real, recent trigger in their world and the specific downstream consequence they have not clocked yet. The trigger is the reason to message now. End by making it easy to opt out. Use ONLY the trigger or fact stated in the block. Never invent a funding event, a hiring event, a competitor move, a tool switch, or any fact not present. If the specific trigger is not in the block, do not use this framing, fall back to a plain observation and question.",
  provocation:
    "Make one specific, slightly contrarian claim about their situation that invites correction. Take a stance, do not ask a curious question. No flattery.",
  gift:
    "Lead with a genuinely useful observation or artifact and NO ask, no call to action, no question. Give and stop. Offer only something real you can point to in the block. Never invent a resource, a number, or a finding that is not there.",
  own_cold:
    "Admit openly this is cold and that you have not followed their work. State the one real, specific reason you are messaging. Refuse the research flattery ritual.",
  disqualifier:
    "Open by naming who this is NOT for, then the one condition under which it is worth their time. Take away framing, confident, brief.",
  peer_insider:
    "Say the one thing only someone who does exactly what they do would notice. Peer to peer, never seller to buyer. This needs a real shared domain signal in the block. Never fake shared experience you cannot ground. If nothing in the block shows you genuinely share their world, do not use this framing.",
};

/**
 * Per-shape length budget for the first follow-up. The question shape stays at today's tuned
 * 180/28 (byte-identical default); other shapes get the room the spec verified they need to land
 * a consequence or a give (the seven industry drafts run 200 to 250 chars). Launch values, tunable.
 * The connection-note cap is governed elsewhere (shapes only touch the first message).
 */
export const SHAPE_BUDGET: Record<MessageShape, { maxChars: number; maxWords: number }> = {
  observation_question: { maxChars: 180, maxWords: 28 },
  provocation: { maxChars: 170, maxWords: 27 },
  peer_insider: { maxChars: 210, maxWords: 34 },
  disqualifier: { maxChars: 215, maxWords: 34 },
  trigger_consequence: { maxChars: 245, maxWords: 40 },
  gift: { maxChars: 245, maxWords: 40 },
  own_cold: { maxChars: 245, maxWords: 40 },
};

/** The budget for a shape (defaults to the observation_question budget when the shape is unset). */
export function shapeBudget(shape?: MessageShape | null): { maxChars: number; maxWords: number } {
  return SHAPE_BUDGET[shape ?? "observation_question"];
}

export function isMessageShape(x: unknown): x is MessageShape {
  return typeof x === "string" && (MESSAGE_SHAPES as readonly string[]).includes(x);
}

/**
 * A ranker "no signal" placeholder, not a real trigger (spec 2026-07-20, review I3). The AI rank
 * can emit a filler token when it finds nothing ("none", "n/a", "unknown", "No specific hiring or
 * funding trigger found", "No recent trigger"). Treating those as a real trigger would license the
 * fact-asserting trigger_consequence shape on a lead with NO trigger — the exact false premise this
 * feature must never assert. Case-insensitive on the trimmed value.
 *
 * Two shapes of placeholder are caught, and ONLY these — a genuine trigger that happens to start
 * with "no" ("no longer using Salesforce", "now hiring") must NEVER be dropped, so the negation
 * branch is scoped to sentences that explicitly say there is no trigger/signal:
 *   1. bare null tokens: none / nothing / n/a / na / unknown / tbd / not sure|applicable|available|found|known
 *   2. an explicit negation that names a trigger/signal: "no ... trigger/signal ..."
 */
export function isNoSignalToken(value: string): boolean {
  const v = value.trim().toLowerCase();
  if (v.length === 0) return true;
  if (/^(none|nothing|n\/?a|na|unknown|tbd)\b/.test(v)) return true;
  if (/^not (sure|applicable|available|found|known)\b/.test(v)) return true;
  // "no"/"not" as a standalone word (the \b guards "now"/"none"/"notable") followed later by the
  // word trigger(s)/signal(s) — e.g. "No specific hiring or funding trigger found", "No recent trigger".
  if (/^no(t)?\b.*\b(triggers?|signals?)\b/.test(v)) return true;
  return false;
}

/** A real trigger signal is present when the insights carry at least one trigger that is not a
 *  ranker "no signal" placeholder (empty, "none", "n/a", "No specific trigger found", …). */
function hasTriggerSignal(insights: StoredInsights): boolean {
  return insights.triggers.some((t) => !isNoSignalToken(t));
}

/**
 * Deterministic champion default — trigger-aware AND config-aware (spec 2026-07-21), SAFE subset
 * only. The lead's real signal still gates facts; within that, the account's derived PROFILE sets
 * the approach prior. The policy, in order:
 *   1. a real, non-placeholder trigger in the insights → trigger_consequence, REGARDLESS of profile
 *      (a genuine why-now is the strongest opener and it is fully grounded, so config never overrides
 *      it — and isNoSignalToken keeps a ranker placeholder from ever licensing it);
 *   2. trust: high (regulated/high-trust seller) → observation_question (conservative, never a gimmick);
 *   3. self_serve + hasArtifact → gift (show value, drive to try — but only with a real artifact);
 *   4. traffic → gift when an artifact exists, else observation_question (traffic-first sellers
 *      convert on seeing, not talking);
 *   5. everything else (booking/standard/no-trigger, and the safe floor) → observation_question.
 *
 * NEVER returns a bold shape (those are exploration-only). NEVER returns peer_insider: a genuine
 * shared-domain "I do exactly what you do" signal is not reliably derivable from StoredInsights, and
 * faking peer intimacy is precisely the hallucination this feature must not commit — so peer_insider
 * stays exploration-only (proposed by the bandit, which learns from real outcomes) rather than
 * asserted by the default.
 *
 * PURITY / ANTI-HALLUCINATION: `profile` is a bounded approach prior derived from CONFIG only
 * (never message text — see deriveAccountProfile). The config biases APPROACH, never facts. Absent
 * profile → SAFE_PROFILE, which reproduces the pre-config selector (trigger-or-floor) exactly.
 */
export function selectMessageShape(
  insights: StoredInsights,
  profile: AccountConfigProfile = SAFE_PROFILE
): MessageShape {
  if (hasTriggerSignal(insights)) return "trigger_consequence";
  if (profile.trust === "high") return "observation_question";
  if (profile.conversionStyle === "self_serve" && profile.hasArtifact) return "gift";
  if (profile.conversionStyle === "traffic") {
    return profile.hasArtifact ? "gift" : "observation_question";
  }
  return "observation_question";
}

/**
 * Deterministic grounding guard (belt-and-suspenders on selection). Given the rendered leadBlock
 * and the shape that was used, returns whether the block actually carries the signal the shape
 * asserts. A false result means a fact-asserting shape was applied without its premise in the
 * grounding — the draft is routed to review rather than trusted. observation_question and the bold
 * shapes assert no specific prospect fact, so they always pass this guard (their compliance is the
 * humanizer's job, not this guard's).
 *
 * This is NOT a general hallucination lint. It catches exactly one failure mode: "fact-asserting
 * shape used, its signal missing from the block." Fabricating a fact that IS shaped like the
 * signal (an invented trigger) is defended upstream by selection + directive + accuracy rule, and
 * ultimately by the human review queue.
 */
export function groundingHasShapeSignal(block: string, shape: MessageShape): boolean {
  switch (shape) {
    case "trigger_consequence": {
      // Pull the rendered "Triggers: …" line and require at least one REAL token in it — aligned
      // with the selector's hasTriggerSignal (review I3). This rejects the empty render ("none
      // observed"), ranker placeholders ("none" / "n/a" / "No specific trigger found"), AND the
      // stray-"; " punctuation an empty array entry renders (triggers ["", "x"] → "Triggers: ; x"):
      // the guard keys on real content, never on a semicolon. No line ⇒ no signal.
      const line = /(?:^|\n)Triggers: (.*)$/m.exec(block);
      if (!line) return false;
      return line[1]!.split(";").some((t) => !isNoSignalToken(t));
    }
    case "gift":
      // a giftable artifact = the account's supporting content, or a citable proof fact.
      return /(^|\n)Supporting content:/.test(block) || /Proof you may cite/.test(block);
    case "peer_insider":
      // the minimum shared-domain grounding: the prospect's own "What they do" line is present.
      return /(^|\n)What they do/.test(block);
    default:
      return true;
  }
}

/**
 * Closed-set gate for a generator-proposed shape (spec §6). Sits beside validateRecipeAngle: the
 * angle is free text (length/claim gated), a shape is an enum (membership gated).
 *   - an unknown value is dropped (returns null),
 *   - observation_question is dropped (proposing the default is a no-op challenger),
 *   - a bold shape is dropped unless the account is pinned (allowBold),
 *   - provocation/disqualifier are dropped for a high-trust (regulated) account even when pinned,
 *   - a safe non-default shape passes through.
 */
export function validateProposedShape(
  raw: unknown,
  opts: { allowBold: boolean; highTrust?: boolean }
): MessageShape | null {
  if (!isMessageShape(raw)) return null;
  if (raw === "observation_question") return null;
  if (BOLD_SHAPES.includes(raw) && !opts.allowBold) return null;
  // Config-aware eligibility (spec 2026-07-21): a regulated/high-trust seller never explores the
  // aggressive shapes (a contrarian provocation, a take-away disqualifier), even when the account is
  // bold-pinned — calmer shapes only for that brand. own_cold (an honest cold-open) is not excluded.
  if (opts.highTrust && (raw === "provocation" || raw === "disqualifier")) return null;
  return raw;
}
