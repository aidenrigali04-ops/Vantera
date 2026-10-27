import { shortName } from "./metrics";
import type { SenderFacts } from "./types";

const DAY = 86_400_000;

export interface SenderRaw {
  id: string;
  display_name: string | null;
  status: SenderFacts["status"];
  connected_at: string | null;
  updated_at: string | null;
}

export interface SendTodayRaw {
  linkedin_account_id: string | null;
  scheduled_sends: { linkedin_stage: string | null } | null;
}

/** `tz` when it is a valid IANA zone, else UTC (Intl formatters throw on a bad zone). */
export function safeZone(tz: string | null | undefined): string {
  if (!tz) return "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return "UTC";
  }
}

/** The account timezone: the Prospect agent's configured zone, else UTC. */
export function accountTimeZone(agents: Array<{ kind: string; timezone: string | null }>): string {
  return safeZone(agents.find((a) => a.kind === "scout")?.timezone ?? agents[0]?.timezone ?? "UTC");
}

/** Per-sender facts (caps, warmup age, status) from the sender rows + today's/this week's sends. */
export function buildSenderFacts(senders: SenderRaw[], todaySends: SendTodayRaw[], weekSends: SendTodayRaw[], now: Date): SenderFacts[] {
  return senders.map((s) => {
    const mine = todaySends.filter((x) => x.linkedin_account_id === s.id);
    return {
      id: s.id,
      name: shortName(s.display_name),
      status: s.status,
      ageDays: s.connected_at ? Math.max(0, (now.getTime() - new Date(s.connected_at).getTime()) / DAY) : 0,
      invitesToday: mine.filter((x) => x.scheduled_sends?.linkedin_stage === "invite").length,
      messagesToday: mine.filter((x) => x.scheduled_sends?.linkedin_stage !== "invite").length,
      invitesThisWeek: weekSends.filter((x) => x.linkedin_account_id === s.id && x.scheduled_sends?.linkedin_stage === "invite").length,
      statusChangedAt: s.status === "disconnected" || s.status === "restricted" ? s.updated_at : null,
    };
  });
}
