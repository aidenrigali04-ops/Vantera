import type { SenderFacts, TodayInputs, TodayState } from "./types";

/** Senders that can send right now. */
export function healthySenders(senders: SenderFacts[]): SenderFacts[] {
  return senders.filter((s) => s.status === "active");
}

/** Senders that need a repair (a dropped or restricted connection). */
export function downSenders(senders: SenderFacts[]): SenderFacts[] {
  return senders.filter((s) => s.status === "disconnected" || s.status === "restricted");
}

const WORKING_EMPTY_WINDOW_MIN = 60;

/**
 * The Today state machine (blueprint §8) — a pure function of the page's reads. Order is
 * the precedence of what the user must know first: a stopped engine beats everything; a
 * held sender beats billing (the cheaper repair goes first); the user's own pause beats
 * the routine states; and the routine states resolve on what's waiting.
 */
export function resolveTodayState(i: TodayInputs): TodayState {
  if (!i.firstSessionDone) return "first_session";

  const down = downSenders(i.senders);
  const healthy = healthySenders(i.senders);
  if (i.senders.length > 0 && healthy.length === 0 && down.length > 0) return "stopped_senders";
  if (down.length > 0) return "sender_held";

  if (i.billing.status === "past_due" || i.billing.status === "canceled") return "stopped_billing";
  if (i.pausedAt) return "paused";

  if (i.drafts > 0 || i.repliesWaiting > 0) return "steady";

  // Nothing waiting. Decide between "caught up", "still warming up", and "starved".
  if (i.engine.scoutLive && !i.engine.everDrafted) {
    const firstRunAgeMin = i.engine.firstRunAt
      ? (i.now.getTime() - new Date(i.engine.firstRunAt).getTime()) / 60_000
      : null;
    if (firstRunAgeMin !== null && firstRunAgeMin < WORKING_EMPTY_WINDOW_MIN) return "working_empty";
    if (i.engine.lastThreeRunsEmpty) return "starved";
    if (firstRunAgeMin === null) return "working_empty"; // scheduled but not run yet
  }
  if (i.engine.scoutLive && i.engine.lastThreeRunsEmpty) return "starved";
  return "caught_up";
}

/** The time-of-day greeting word, from the local hour (account timezone). */
export function greetingWord(hour: number): "Morning" | "Afternoon" | "Evening" {
  if (hour >= 5 && hour < 12) return "Morning";
  if (hour >= 12 && hour < 17) return "Afternoon";
  return "Evening";
}
