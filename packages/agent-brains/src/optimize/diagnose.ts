import { STRONG_STAGE_SAMPLE, type FunnelStageKey, type OutreachFunnelStage } from "./funnel";

/**
 * Diagnosis layer of the self-optimizing loop
 * (docs/superpowers/specs/2026-06-29-self-optimizing-outreach-design.md).
 *
 * Finds the single biggest, statistically-defensible leak — the binding constraint. This is the
 * anti-overcompensation core in miniature: it names AT MOST ONE stage, only when that stage has
 * enough data AND sits below its typical band, and it stays silent ("insufficient_data") on thin
 * data rather than inventing a problem. Pure/deterministic.
 */

export type DiagnosisStatus = "leak" | "healthy" | "insufficient_data";

export type OutreachDiagnosis = {
  status: DiagnosisStatus;
  /** the leaking stage — present only when status === 'leak' */
  stageKey?: FunnelStageKey;
  headline: string;
  detail: string;
  /** how sure we are, driven by sample size (only meaningful for 'leak'/'healthy') */
  confidence: "early" | "clear";
};

export function diagnoseOutreach(funnel: OutreachFunnelStage[]): OutreachDiagnosis {
  // Only stages with enough completed touches AND a known rate/band are eligible to be judged.
  const gated = funnel.filter((s) => s.enoughData && s.ratePct != null && s.benchmark != null);

  if (gated.length === 0) {
    return {
      status: "insufficient_data",
      headline: "Not enough completed outreach to diagnose yet",
      detail:
        "Keep sending — once enough invites, connections, and replies land, this pinpoints the single biggest place to improve. It won't guess from a handful of touches.",
      confidence: "early",
    };
  }

  // The biggest leak is the below-band stage furthest below its typical low. Ties break toward the
  // earlier funnel stage (fixing an upstream leak compounds through everything downstream).
  const below = gated
    .filter((s) => s.benchmark!.status === "below")
    .map((s) => ({ s, gap: s.benchmark!.low - s.ratePct! }))
    .sort((a, b) => b.gap - a.gap);

  if (below.length === 0) {
    const strong = gated.some((s) => s.denominator >= STRONG_STAGE_SAMPLE);
    return {
      status: "healthy",
      headline: "Your outreach is tracking at or above typical",
      detail:
        "No single stage is dragging the funnel down, so no change is warranted right now — consistency compounds. This will flag the moment a real gap opens up.",
      confidence: strong ? "clear" : "early",
    };
  }

  const { s } = below[0]!;
  return {
    status: "leak",
    stageKey: s.key,
    headline: `${s.label} is your biggest opportunity`,
    detail: `${s.ratePct}% of ${s.from} became ${s.to} — below the typical ${s.benchmark!.low}–${s.benchmark!.high}%. This is where the most is lost, so it's the highest-leverage stage to improve first.`,
    confidence: s.denominator >= STRONG_STAGE_SAMPLE ? "clear" : "early",
  };
}
