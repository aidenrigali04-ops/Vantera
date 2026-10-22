import type { DispatchSender } from "./types";

/** One LinkedIn send attributed to a sender: delivered (`at` = sent time) or handed out
 *  (`at` = scheduled time). */
export interface SenderSendRow {
  liId: string | null;
  stage: string | null;
  at: Date;
}

/**
 * Per-sender safety state for the dispatcher (rule 04). Budgets count BOTH delivered sends and
 * sends already handed out (scheduled/sending): a tick schedules rows up to hours ahead, so
 * counting only deliveries let every 5-minute tick hand out the full daily/weekly budget again.
 * Handed-out rows count toward "today" — the dispatcher schedules within the current day. Pure.
 */
export function aggregateSenderLoad(
  accts: { id: string; connectedAt: Date | null }[],
  delivered: SenderSendRow[],
  handedOut: SenderSendRow[],
  now: Date
): DispatchSender[] {
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return accts.map((a) => {
    const sent = delivered.filter((s) => s.liId === a.id);
    const out = handedOut.filter((s) => s.liId === a.id);
    const invitesOut = out.filter((s) => s.stage === "invite").length;
    const sentToday = sent.filter((s) => s.stage === "invite" && s.at >= dayStart).length + invitesOut;
    const last7d = sent.filter((s) => s.stage === "invite").length + invitesOut;
    const sentTodayMessages =
      sent.filter((s) => s.stage === "message" && s.at >= dayStart).length +
      out.filter((s) => s.stage === "message").length;
    const lastAssignedAt = [...sent, ...out].reduce((m, s) => Math.max(m, s.at.getTime()), 0);
    const scheduledUntil = out.reduce((m, s) => Math.max(m, s.at.getTime()), 0);
    const ageDays = a.connectedAt ? Math.floor((now.getTime() - a.connectedAt.getTime()) / 86_400_000) : 0;
    return {
      linkedinAccountId: a.id,
      ageDays,
      sentToday,
      last7d,
      sentTodayMessages,
      lastAssignedAt,
      scheduledUntil,
      healthy: true, // only active accounts are passed in
    };
  });
}
