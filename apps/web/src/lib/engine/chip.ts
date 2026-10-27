import { capUsage, fmtDayTime, fmtUntil } from "@/lib/today/metrics";
import { downSenders, healthySenders } from "@/lib/today/state";
import type { EngineState } from "./build";
import type { ChipDot, ChipState, EngineGroups, GroupState } from "./chip-state";

/**
 * The chrome's run-state chip (UX-2 Task 9) — what the engine is doing right now, in one
 * line, by precedence: a repair beats billing beats the user's pause beats the routine
 * states. Pure and server-side (cap math comes from the sending layer via `capUsage`); the
 * client receives only this serializable result.
 */

export type { ChipDot, ChipState, EngineGroups, GroupState } from "./chip-state";
export { chipDetail } from "./chip-state";

const SOURCING = new Set(["scout", "intent"]);

function base(dot: ChipDot, label: string, detail: string | null, href: string | null): ChipState {
  return { dot, label, detail, href, nextRunAt: null, untilLabel: null, nextRunTitle: null };
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
    if (sent === 0) {
      // a messages-only day: never "0 of N invites today"
      const messages = healthy.reduce((n, x) => n + x.messagesToday, 0);
      return base("running", "Sending", `${messages} ${messages === 1 ? "message" : "messages"} today`, null);
    }
    const allowed = healthy.reduce((n, x) => n + capUsage(x).invitesAllowed, 0);
    return base("running", "Sending", `${sent} of ${allowed} invites today`, null);
  }

  const next = s.agents
    .filter((a) => SOURCING.has(a.kind) && a.status === "live")
    .map((a) => a.nextRunAt)
    .sort((a, b) => (a === null ? -1 : b === null ? 1 : new Date(a).getTime() - new Date(b).getTime()));
  if (next.length > 0) {
    const at = next[0] ?? null;
    const until = fmtUntil(at, now);
    return {
      ...base("running", "Finding prospects", `next run ${until}`, null),
      nextRunAt: at,
      untilLabel: until,
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
