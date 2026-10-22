/**
 * ML-7 lookalikes: "does this lead look like the people who already replied, booked, or closed?"
 * The similarity itself (cosine to the account's own positive leads, leave-one-out) is computed
 * in SQL with pgvector; this module builds the text that gets embedded and turns a raw similarity
 * into a learner feature bucket relative to the ACCOUNT's own distribution — so the learner
 * measures the real reply lift of looking like your winners instead of trusting a magic number.
 * Pure.
 */

/** Positives an account needs (with embeddings) before lookalike similarity means anything. */
export const LOOKALIKE_MIN_POSITIVES = 3;
/** Similarities needed to place tertile cutpoints. */
const MIN_SIMS_FOR_CUTPOINTS = 9;

export type ProfileFields = {
  title: string | null;
  companyName: string | null;
  industry: string | null;
  companySize?: string | null;
  location?: string | null;
  prospectOffering?: string | null;
  summary?: string | null;
};

/** The lead's own profile as one line — what gets embedded (null = nothing to embed). */
export function profileText(f: ProfileFields): string | null {
  const parts = [f.title, f.companyName, f.industry, f.companySize, f.location, f.prospectOffering, f.summary]
    .map((p) => (p ?? "").replace(/\s+/g, " ").trim())
    .filter(Boolean);
  return parts.length > 0 ? parts.join(" | ").slice(0, 1000) : null;
}

export type LookalikeCutpoints = { mid: number; high: number };

/** Tertile cutpoints from the account's own similarities (training rows); null when too few. */
export function lookalikeCutpoints(sims: number[]): LookalikeCutpoints | null {
  const xs = sims.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (xs.length < MIN_SIMS_FOR_CUTPOINTS) return null;
  const at = (q: number) => xs[Math.min(xs.length - 1, Math.floor(q * xs.length))]!;
  return { mid: at(1 / 3), high: at(2 / 3) };
}

export function lookalikeBucket(sim: number | null | undefined, cut: LookalikeCutpoints | null): "high" | "mid" | "low" | null {
  if (sim == null || !Number.isFinite(sim) || !cut) return null;
  return sim >= cut.high ? "high" : sim >= cut.mid ? "mid" : "low";
}
