import { checkHoldout, fitRanges, type FunnelCohort, type HoldoutStatus } from "@vantera/agent-brains";
import type { CohortWindow } from "./types";

/** Latest 30 days are the holdout. Everything sourced before that is the training window. */
export const HOLDOUT_MS = 30 * 24 * 60 * 60 * 1000;
/** The 15-minute scheduler tick fires this task. A subject is fit at most once a day. */
export const CALIBRATION_INTERVAL_MS = 24 * 60 * 60 * 1000;

export type CalibrationSubject = {
  accountId: string;
  agentId: string;
  checkedAt: string | null;
};

/** `ranges` is null when the training window is below the sample gate. The assumed prior stands. */
export type StoredCalibration = {
  fitted: boolean;
  holdout: HoldoutStatus;
  reason: string;
  ranges: ReturnType<typeof fitRanges>["ranges"] | null;
  checkedAt: string;
};

export interface CalibrationStore {
  /** Live optimizer subjects only. Accounts without one are absent, so learning stays off. */
  listCalibrationSubjects(): Promise<CalibrationSubject[]>;
  saveCalibration(agentId: string, accountId: string, calibration: StoredCalibration): Promise<void>;
}

export type CalibrationDeps = {
  listSubjects(): Promise<CalibrationSubject[]>;
  getCohort(accountId: string, window?: CohortWindow): Promise<FunnelCohort>;
  saveCalibration(agentId: string, accountId: string, calibration: StoredCalibration): Promise<void>;
  releaseWorldCache(): void;
};

export function calibrationCheckedAt(config: unknown): string | null {
  if (!config || typeof config !== "object" || Array.isArray(config)) return null;
  const calibration = (config as { calibration?: unknown }).calibration;
  if (!calibration || typeof calibration !== "object" || Array.isArray(calibration)) return null;
  const checkedAt = (calibration as { checkedAt?: unknown }).checkedAt;
  return typeof checkedAt === "string" ? checkedAt : null;
}

/** Record a calibration without dropping the subject's name, guardrails, or other config. */
export function withCalibration(current: unknown, calibration: StoredCalibration): Record<string, unknown> {
  const base =
    current && typeof current === "object" && !Array.isArray(current)
      ? { ...(current as Record<string, unknown>) }
      : {};
  return { ...base, calibration };
}

function isFresh(checkedAt: string | null, now: Date): boolean {
  if (!checkedAt) return false;
  const then = Date.parse(checkedAt);
  if (Number.isNaN(then)) return false;
  return now.getTime() - then < CALIBRATION_INTERVAL_MS;
}

/**
 * Fit base rates for each live subject and check them on a later window.
 * An account that has no subject is not in the list, so it is not calibrated.
 * This does not draft, schedule, or send.
 */
export async function runAccountCalibration(
  deps: CalibrationDeps,
  now: Date
): Promise<{ calibrated: number; skipped: number }> {
  const subjects = await deps.listSubjects();
  let calibrated = 0;
  let skipped = 0;
  const holdoutStart = new Date(now.getTime() - HOLDOUT_MS);
  for (const subject of subjects) {
    if (isFresh(subject.checkedAt, now)) {
      skipped += 1;
      continue;
    }
    const train = await deps.getCohort(subject.accountId, { until: holdoutStart });
    const holdout = await deps.getCohort(subject.accountId, { since: holdoutStart, until: now });
    const report = checkHoldout(train, holdout);
    const fit = fitRanges(train);
    await deps.saveCalibration(subject.agentId, subject.accountId, {
      fitted: fit.fitted,
      holdout: report.status,
      reason: report.reason,
      ranges: fit.fitted ? fit.ranges : null,
      checkedAt: now.toISOString(),
    });
    deps.releaseWorldCache();
    calibrated += 1;
  }
  return { calibrated, skipped };
}
