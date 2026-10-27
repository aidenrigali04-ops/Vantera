/**
 * The run-state chip's serializable shape + the one detail-line composition. Client-safe (no
 * `@vantera/jobs` import, unlike `chip.ts`), so the chrome can re-tick the countdown.
 */

export type ChipDot = "running" | "attention" | "stopped" | "paused";

export interface ChipState {
  dot: ChipDot;
  label: string;
  detail: string | null;
  href: string | null;
  /** set only for "Finding prospects": the client re-ticks the countdown from it */
  nextRunAt: string | null;
  /** just the `fmtUntil` part of the countdown ("in ~3h"); null on every other chip */
  untilLabel: string | null;
  /** absolute next run in the account timezone ("Thu 10:30am") for the hover title */
  nextRunTitle: string | null;
}

/** Each popover switch: on, off, or nothing deployed in that group. */
export type GroupState = "live" | "paused" | "none";
export interface EngineGroups {
  /** Prospect + Intent agents */
  sourcing: GroupState;
  /** Outreach agent */
  outreach: GroupState;
}

/**
 * The chip's detail line. With a countdown it is `next run {until}` — composed HERE only, so
 * the prefix appears exactly once whether `until` is the server label or a client re-tick.
 */
export function chipDetail(chip: ChipState, until?: string | null): string | null {
  if (chip.untilLabel === null) return chip.detail;
  return `next run ${until ?? chip.untilLabel}`;
}
