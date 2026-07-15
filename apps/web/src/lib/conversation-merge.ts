import type { ThreadTurn } from "@/lib/conversations";

/**
 * R1d optimistic echo (pure, client-safe): a just-queued reply appears in the thread
 * immediately, marked pending, and drops out the moment the server-rendered turns
 * include it — so a sent message never looks lost, and never double-renders.
 */
export type PendingSend = { text: string; at: string };

export function mergePendingTurns(turns: ThreadTurn[], pending: PendingSend[]): ThreadTurn[] {
  if (pending.length === 0) return turns;
  const confirmed = new Set(
    turns.filter((t) => t.role === "agent").map((t) => t.text.trim())
  );
  const stillPending = pending
    .filter((p) => p.text.trim().length > 0 && !confirmed.has(p.text.trim()))
    .map(
      (p): ThreadTurn => ({
        role: "agent",
        text: p.text,
        at: p.at,
        playLabel: null,
        classification: null,
        manual: true,
        pending: true,
      })
    );
  return [...turns, ...stillPending];
}
