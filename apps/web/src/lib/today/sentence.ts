import { fmtTime } from "./metrics";
import { downSenders, healthySenders } from "./state";
import type { TodayInputs, TodayState } from "./types";

/**
 * The Z2 status sentence (blueprint §7 Z2) — the five-second answer. One or two
 * sentences, facts only, no adjectives; singular/plural handled; times in the account
 * timezone. Built server-side from the state machine so the client renders a string.
 */

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
/** "Anna K." already ends a sentence — never stack a second period on an abbreviated name. */
const endSentence = (s: string) => (s.endsWith(".") ? s : `${s}.`);
const people = (n: number) => `${n} ${n === 1 ? "person" : "people"}`;

/** "Overnight" when the previous visit is > 10h old (or unknown), else "Since {time}". */
export function sinceFragment(i: TodayInputs): { overnight: boolean; label: string } {
  if (!i.lastVisitAt) return { overnight: true, label: "Overnight" };
  const ageH = (i.now.getTime() - new Date(i.lastVisitAt).getTime()) / 3_600_000;
  if (ageH > 10) return { overnight: true, label: "Overnight" };
  return { overnight: false, label: `Since ${fmtTime(new Date(i.lastVisitAt), i.timeZone)}` };
}

function sendersInsideLimits(i: TodayInputs): string {
  const n = healthySenders(i.senders).length;
  if (n === 1) return "Your sender is inside its limits.";
  if (n === 2) return "Both senders are inside their limits.";
  return `${n} senders are inside their limits.`;
}

export function buildStatusSentence(state: TodayState, i: TodayInputs): string {
  const next = i.engine.nextRunAt ? fmtTime(new Date(i.engine.nextRunAt), i.timeZone) : null;
  const since = sinceFragment(i);

  switch (state) {
    case "steady": {
      if (i.drafts > 0 && i.repliesWaiting > 0) {
        const lead = since.overnight ? "Overnight" : since.label;
        return `${lead} the engine drafted ${plural(i.drafts, "message")} and ${people(i.repliesWaiting)} replied. ${
          since.overnight ? sendersInsideLimits(i) : "Senders are inside their limits."
        }`;
      }
      if (i.drafts > 0) {
        return `${plural(i.drafts, "draft")} ${i.drafts === 1 ? "is" : "are"} ready. No new replies${
          since.overnight ? "" : ` since ${since.label.replace(/^Since /, "")}`
        }.`;
      }
      // replies only
      const interested = i.repliesInterestedWaiting;
      return `${people(i.repliesWaiting)} replied${since.overnight ? "" : ` since ${since.label.replace(/^Since /, "")}`} — ${interested} interested. The queue is clear.`;
    }
    case "caught_up":
      return next
        ? `You're caught up. Next drafts are expected around ${next}; we'll email you when they land.`
        : "You're caught up. We'll email you when the next drafts land.";
    case "working_empty": {
      const eta = next ? Math.max(1, Math.round((new Date(i.engine.nextRunAt!).getTime() - i.now.getTime()) / 60_000)) : null;
      return eta
        ? `The engine is on its first pass. First drafts are expected in about ${eta} minutes — this page fills itself.`
        : "The engine is on its first pass. First drafts are expected shortly — this page fills itself.";
    }
    case "starved":
      return "The engine ran three passes and found nothing above 70. Your profile may be too narrow.";
    case "sender_held": {
      const down = downSenders(i.senders)[0]!;
      const other = healthySenders(i.senders)[0];
      const head = `${down.name} is ${down.status === "restricted" ? "restricted" : "disconnected"}, so ${plural(i.draftsHeld, "draft")} ${i.draftsHeld === 1 ? "is" : "are"} held.`;
      if (!other) return head;
      return `${head} Everything else is running — ${plural(i.drafts - i.draftsHeld, "draft")} ${i.drafts - i.draftsHeld === 1 ? "is" : "are"} ready on ${endSentence(other.name)}`;
    }
    case "stopped_senders":
      return "No sender is connected. The engine is still sourcing and drafting; nothing can send until one is back.";
    case "paused":
      return "The engine is paused. Approvals stay open; nothing is being sourced or sent until you resume it.";
    case "stopped_billing":
      return "Sending is stopped until billing is sorted. Your queue and replies are safe.";
    case "first_session":
      return ""; // never rendered — /today forwards to the queue
  }
}
