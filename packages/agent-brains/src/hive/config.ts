/**
 * Hive tuning knobs + their hard safety envelope. Every value is clamped in code on every read
 * (same self-clamping pattern as clampDecideV2Options): a bad stored value or an over-eager
 * tuning run can never produce a reckless tournament. The statistical floor (e-process gate,
 * do-no-harm breaker, alpha-investing) is NOT configurable here.
 */
export type HiveConfig = {
  /** challengers raced against the champion inside one container */
  challengersPerContainer: number;
  /** total share of a container's units routed to challengers (split evenly among live ones) */
  challengerShare: number;
  /** practical-win floor in percentage points (decideExperimentV2 minEffectPp) */
  minEffectPp: number;
  /** expected-loss ceiling for promotion in pp (decideExperimentV2 maxAdoptionLossPp) */
  maxAdoptionLossPp: number;
  /** Thompson prior shrinkage toward the arena's pooled rate (pseudo-observations) */
  shrinkM: number;
  /** consecutive generations without a promotion before an arena converges for an account */
  maxPlateau: number;
  /** share of candidate slots filled by crossover from other accounts' winners (the hive) */
  crossoverShare: number;
  /** a container that hasn't decided by this age concludes as timed out */
  maxContainerDays: number;
  /** a converged or goal-met arena re-opens after this many days (drift check) */
  cooldownDays: number;
};

export const HIVE_DEFAULTS: HiveConfig = {
  challengersPerContainer: 2,
  challengerShare: 0.5,
  minEffectPp: 2,
  maxAdoptionLossPp: 0.5,
  shrinkM: 25,
  maxPlateau: 4,
  crossoverShare: 0.3,
  maxContainerDays: 60,
  cooldownDays: 45,
};

const clamp = (v: number | undefined, fallback: number, lo: number, hi: number) => {
  const x = v ?? fallback;
  if (!Number.isFinite(x)) return fallback;
  return Math.min(hi, Math.max(lo, x));
};

export function clampHiveConfig(raw: Partial<HiveConfig> = {}): HiveConfig {
  const d = HIVE_DEFAULTS;
  return {
    challengersPerContainer: Math.round(clamp(raw.challengersPerContainer, d.challengersPerContainer, 1, 3)),
    challengerShare: clamp(raw.challengerShare, d.challengerShare, 0.1, 0.6),
    minEffectPp: clamp(raw.minEffectPp, d.minEffectPp, 1, 10),
    maxAdoptionLossPp: clamp(raw.maxAdoptionLossPp, d.maxAdoptionLossPp, 0.1, 2),
    shrinkM: clamp(raw.shrinkM, d.shrinkM, 0, 200),
    maxPlateau: Math.round(clamp(raw.maxPlateau, d.maxPlateau, 1, 12)),
    crossoverShare: clamp(raw.crossoverShare, d.crossoverShare, 0, 1),
    maxContainerDays: Math.round(clamp(raw.maxContainerDays, d.maxContainerDays, 14, 180)),
    cooldownDays: Math.round(clamp(raw.cooldownDays, d.cooldownDays, 7, 365)),
  };
}
