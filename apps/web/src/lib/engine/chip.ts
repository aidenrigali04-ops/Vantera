import { capUsage, fmtDayTime, fmtUntil } from "@/lib/today/metrics";
import { downSenders, healthySenders } from "@/lib/today/state";
import type { EngineState } from "./build";

/**
 * The chrome's run-state chip (UX-2 Task 9) — what the engine is doing right now, in one
 * line, by precedence: a repair beats billing beats the user's pause beats the routine
 * states. Pure and server-side (cap math comes from the sending layer via `capUsage`); the
 * client receives only this serializable result.
 */

export type ChipDot = "running" | "attention" | "stopped" | "paused";

export interface ChipState {
  dot: ChipDot;
  label: string;
  detail: string | null;
  href: string | null;
  /** set only for "Finding prospects": the client re-ticks `next run {fmtUntil}` from it */
  nextRunAt: string | null;
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

const SOURCING = new Set(["scout", "intent"]);

function base(dot: ChipDot, label: string, detail: string | null, href: string | null): ChipState {
  return { dot, label, detail, href, nextRunAt: null, nextRunTitle: null };
}

export function chipFor(s: EngineState, now: Date): ChipState {
  const down = downSenders(s.senders)[0];
  if (down) {
    return down.status === "disconnected"
      ? base("attention", `${down.name} disconnected`, "Reconnect", "/settings/senders")
      : base("attention", `${down.name} restricted`, "Review", "/settings/senders");
  }
  if (s.senders.length === 0) return base("attention", "LinkedIn not connected", "Connect", "/settings/senders");
  if (s.billing.status === "past_due") return base("attention", "Payment failed", "Fix", "/settings/billing");
  if (s.billing.status === "canceled") return base("stopped", "Subscription ended", "Restart", "/settings/billing");
  if (s.pausedAt) return base("paused", "Paused by you", "Resume", null);

  const healthy = healthySenders(s.senders);
  if (healthy.some((x) => x.invitesToday + x.messagesToday > 0)) {
    const sent = healthy.reduce((n, x) => n + x.invitesToday, 0);
    const allowed = healthy.reduce((n, x) => n + capUsage(x).invitesAllowed, 0);
    return base("running", "Sending", `${sent} of ${allowed} invites today`, null);
  }

  const next = s.agents
    .filter((a) => SOURCING.has(a.kind) && a.status === "live")
    .map((a) => a.nextRunAt)
    .sort((a, b) => (a === null ? -1 : b === null ? 1 : new Date(a).getTime() - new Date(b).getTime()));
  if (next.length > 0) {
    const at = next[0] ?? null;
    return {
      ...base("running", "Finding prospects", `next run ${fmtUntil(at, now)}`, null),
      nextRunAt: at,
      nextRunTitle: at ? `Next run ${fmtDayTime(new Date(at), s.timeZone)}` : null,
    };
  }
  return base("running", "Ready", null, null);
}

function groupState(s: EngineState, kinds: (k: string) => boolean): GroupState {
  const deployed = s.agents.filter((a) => kinds(a.kind) && a.status !== "draft");
  if (deployed.length === 0) return "none";
  return deployed.some((a) => a.status === "live") ? "live" : "paused";
}

export function groupsFor(s: EngineState): EngineGroups {
  return {
    sourcing: groupState(s, (k) => SOURCING.has(k)),
    outreach: groupState(s, (k) => k === "copy"),
  };
}
