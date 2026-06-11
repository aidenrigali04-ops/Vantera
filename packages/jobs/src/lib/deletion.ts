export const GRACE_DAYS = 7;

/** Spec: deletion requests are processed only after the 7-day grace window (owner-confirmed). */
export function isEligibleForDeletion(requestedAt: Date, now: Date): boolean {
  const graceMs = GRACE_DAYS * 24 * 60 * 60 * 1000;
  return now.getTime() - requestedAt.getTime() >= graceMs;
}
