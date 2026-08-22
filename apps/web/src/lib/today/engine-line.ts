import { capUsage, fmtTime, sendWindowLabel, sendWindowOpensLabel, weeklyCeilingReached } from "./metrics";
import { downSenders, healthySenders } from "./state";
import type { TodayInputs, TodayState } from "./types";

/**
 * The Engine line (blueprint §6.7 / §7 Z5 footer) — one mono-inflected sentence: a dot,
 * a status word, ` · ` separators, facts. The dot pulses only in Running; in any
 * non-Running state the last segment is a repair/resume link.
 */

export type EngineDot = "running" | "attention" | "stopped" | "paused";

export interface EngineLine {
  dot: EngineDot;
  /** the bold status word */
  status: string;
  /** plain fact fragments, joined with ` · ` by the component; `‹…›` = mono */
  facts: string[];
  /** trailing link, when the state needs a repair/resume */
  link: { label: string; href: string; inline?: "resume" } | null;
}

export interface EngineLineFacts {
  /** the next planned send, when the scheduler has one */
  nextSendAt: string | null;
  /** today's sends vs today's total allowance across healthy senders */
  sentToday: number;
  allowedToday: number;
}

export function engineLineFor(state: TodayState, i: TodayInputs, f: EngineLineFacts): EngineLine {
  const tz = i.timeZone;
  const healthy = healthySenders(i.senders);
  const nextSend = f.nextSendAt ? fmtTime(new Date(f.nextSendAt), tz) : null;
  const sender = healthy[0];

  switch (state) {
    case "stopped_senders":
      return { dot: "stopped", status: "Stopped", facts: ["no sender connected", "drafting continues"], link: { label: "Reconnect", href: "/settings/senders" } };
    case "sender_held": {
      const down = downSenders(i.senders)[0]!;
      const facts = [`‹${i.draftsHeld}› drafts held`];
      if (sender) facts.push(`${sender.name} sending normally`);
      return {
        dot: "attention",
        status: `${down.name} ${down.status === "restricted" ? "restricted" : "disconnected"}`,
        facts,
        link: { label: down.status === "restricted" ? "Open sender" : "Reconnect", href: `/settings/senders#${down.id}` },
      };
    }
    case "paused":
      return {
        dot: "paused",
        status: `Paused by you ‹${i.pausedAt ? fmtTime(new Date(i.pausedAt), tz) : ""}›`.replace(" ‹›", ""),
        facts: ["approvals open"],
        link: { label: "Resume", href: "#resume", inline: "resume" },
      };
    case "stopped_billing":
      return { dot: "stopped", status: "Stopped", facts: ["billing", "queue and replies kept"], link: { label: "Update payment", href: "/settings/billing" } };
    case "first_session":
      return { dot: "running", status: "Running", facts: [], link: null };
    default: {
      // Running — steady / caught up / working-empty / starved
      if (sender && weeklyCeilingReached(sender)) {
        return {
          dot: "running",
          status: "Running",
          facts: [`weekly invite ceiling reached (‹${capUsage(sender).weeklyCeiling}›)`, "messages continue", "invites resume ‹Mon›"],
          link: null,
        };
      }
      if (healthy.length === 1 && capUsage(healthy[0]!).warmup) {
        const c = capUsage(healthy[0]!);
        const facts = [`Warmup day ‹${c.warmupDay}› of ‹28›`, `up to ‹${c.invitesAllowed}› invites/day`];
        if (nextSend) facts.push(`next send ‹${nextSend}›`);
        return { dot: "running", status: "Running", facts, link: null };
      }
      const inWindow = f.nextSendAt !== null;
      if (!inWindow) {
        return {
          dot: "running",
          status: "Running",
          facts: [`window closed until ‹${sendWindowOpensLabel()}› prospect time`, `‹${f.sentToday}› of ‹${f.allowedToday}› sent today`],
          link: null,
        };
      }
      const facts: string[] = [];
      facts.push(`next send ‹${nextSend}›${sender ? ` via ${sender.name}` : ""}`);
      facts.push(`today ‹${f.sentToday}› of ‹${f.allowedToday}›`);
      facts.push(`window ${sendWindowLabel()} prospect time`);
      return { dot: "running", status: "Running", facts, link: null };
    }
  }
}
