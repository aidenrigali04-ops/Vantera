/**
 * Config-aware approach selection (spec 2026-07-21). The brain should read each user's configured
 * platform and take the best course of action FOR THAT CONFIG, not apply one default and learn from
 * zero. This module derives a small, deterministic, explainable PROFILE from the seller's real
 * configuration (their CTA, whether they book calls or drive traffic, their vertical, whether they
 * have an artifact to give, how much proof they carry). The profile is a smart PRIOR + an
 * eligibility filter for message shape; the per-account bandit still refines it from real outcomes.
 *
 * ANTI-HALLUCINATION INVARIANT (unchanged, load-bearing): the profile chooses APPROACH knobs ONLY,
 * never facts. `deriveAccountProfile` never sees or touches message text — it takes a plain config
 * object (booleans + short config strings), never grounding, never a draft. Facts still come from
 * the grounding block; every existing anti-hallucination layer (selectMessageShape's signal gating,
 * findUngroundedClaims, findActionClaims, PROSPECT_ACCURACY_RULE, the shape-signal grounding guard,
 * the humanizer, the review queue) stays in full force on every shape the profile biases toward.
 */

/** The seller's conversion arc — how a reply is meant to convert (drives the approach prior). */
export type ConversionStyle = "booking" | "self_serve" | "traffic" | "reply";

/** How conservative the seller's brand must be — regulated/high-trust verticals get calm shapes only. */
export type Trust = "high" | "standard";

/** How much citable proof the account carries (informational; approach prior, never a fact source). */
export type ProofDepth = "rich" | "some" | "none";

/**
 * The derived account profile — a bounded, deterministic approach prior. Every field steers HOW the
 * brain opens (structure/approach), never WHAT it claims. Consumed by `selectMessageShape` (the
 * champion default) and the generator's shape eligibility.
 */
export interface AccountConfigProfile {
  conversionStyle: ConversionStyle;
  trust: Trust;
  hasArtifact: boolean;
  proofDepth: ProofDepth;
}

/**
 * The plain config subset `deriveAccountProfile` reads — assembled in the JOBS layer from the FULL
 * account context (`getCopyContext`), NOT DB types and NOT message text. Every field is optional so
 * an absent/empty config degrades to the safe profile (identical to pre-feature behavior). Booleans
 * carry only the PRESENCE of a booking/website url and an artifact, never their content.
 */
export interface AccountProfileConfig {
  /** the user's configured CTA goal (e.g. "book a 15-min intro", "start a free trial") */
  cta?: string | null;
  /** whether the account configured a meeting-booking url (presence only) */
  hasBookingUrl?: boolean;
  /** whether the account configured a destination/website url (presence only) */
  hasWebsiteUrl?: boolean;
  /** the seller's vertical (onboarding industry) */
  industry?: string | null;
  /** what the seller offers (website-scan summary) — scanned only for a regulated-vertical signal */
  valueProp?: string | null;
  /** whether a real artifact/content link exists to give (derived from the account's assets) */
  hasArtifact?: boolean;
  /** how many citable proof points the account has configured */
  proofCount?: number;
}

/**
 * The safe degrade target: an absent/empty config resolves here, which reproduces today's behavior
 * exactly (reply-style, standard trust, nothing to give, no proof). Exported so the selector and
 * tests share one canonical safe profile.
 */
export const SAFE_PROFILE: AccountConfigProfile = {
  conversionStyle: "reply",
  trust: "standard",
  hasArtifact: false,
  proofDepth: "none",
};

// Word-boundary keyword scanners. Boundaries stop keyword bleed ("call" must not fire on "callous",
// "site" must not fire on "sitemap", "law" must not fire on "flaw"/"lawn").
const BOOKING_CTA = /\b(book|call|demo|meeting)\b/;
const SELF_SERVE_CTA = /\b(try|trial|free|start(ed|ing)?|sign\s?up)\b/;
const TRAFFIC_CTA = /\b(see|look|portfolio|site)\b/;
// Regulated / high-trust verticals (spec 2026-07-21): a match in industry OR valueProp → high trust.
// Common inflections/plurals are matched (banks, laws, pharmaceuticals) so a real vertical signal
// isn't missed on a word-boundary technicality.
const REGULATED =
  /\b(finance|financial|banking|banks?|wealth|insurance|insurer|legal|laws?|lawyer|health|healthcare|medical|medicine|pharma|pharmaceuticals?|government|governmental)\b/;

/**
 * Derive the conversion style from the CTA keywords first, then reinforce from url presence:
 *   - a booking keyword (book/call/demo/meeting) → booking (scanned first, so it outranks a
 *     self_serve keyword in the same cta, e.g. "start a call" → booking);
 *   - a self_serve keyword (try/trial/free/start/sign up) → self_serve;
 *   - a traffic keyword (see/look/portfolio/site) → traffic, but ONLY with a website url and NO
 *     booking url (a booking link means they still want the call);
 *   - otherwise reinforce from urls: a booking url → booking, else a website url → traffic;
 *   - otherwise reply (the safe default).
 */
function deriveConversionStyle(config: AccountProfileConfig): ConversionStyle {
  const cta = (config.cta ?? "").toLowerCase();
  const hasBookingUrl = Boolean(config.hasBookingUrl);
  const hasWebsiteUrl = Boolean(config.hasWebsiteUrl);

  if (BOOKING_CTA.test(cta)) return "booking";
  if (SELF_SERVE_CTA.test(cta)) return "self_serve";
  if (TRAFFIC_CTA.test(cta) && hasWebsiteUrl && !hasBookingUrl) return "traffic";

  // cta ambiguous — reinforce from configured urls.
  if (hasBookingUrl) return "booking";
  if (hasWebsiteUrl) return "traffic";
  return "reply";
}

function deriveTrust(config: AccountProfileConfig): Trust {
  const haystack = `${config.industry ?? ""} ${config.valueProp ?? ""}`.toLowerCase();
  return REGULATED.test(haystack) ? "high" : "standard";
}

function deriveProofDepth(proofCount: number | undefined): ProofDepth {
  const n = proofCount ?? 0;
  if (n >= 2) return "rich";
  if (n === 1) return "some";
  return "none";
}

/**
 * Pure, deterministic derivation of the account profile from the seller's real config. No DB, no
 * AI-SDK, no message text — plain config in, bounded profile out. Absent/empty config → SAFE_PROFILE.
 */
export function deriveAccountProfile(config: AccountProfileConfig): AccountConfigProfile {
  return {
    conversionStyle: deriveConversionStyle(config),
    trust: deriveTrust(config),
    hasArtifact: Boolean(config.hasArtifact),
    proofDepth: deriveProofDepth(config.proofCount),
  };
}
