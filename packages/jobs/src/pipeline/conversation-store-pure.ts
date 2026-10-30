import type { PriorTable, StoredTurn } from "@vantera/agent-brains";

type SentRow = { id: string; body: string | null; stage: "invite" | "message" | null; at: Date };
type NativeRow = { id: string; body: string | null; at: Date };
type ReplyRow = { id: string; body: string | null; at: Date };

/** Merge delivered agent touches, native (human) messages and lead replies, oldest first. */
export function turnsFromRows(sent: SentRow[], native: NativeRow[], got: ReplyRow[]): StoredTurn[] {
  const all: { at: Date; turn: StoredTurn }[] = [
    ...sent.map((r) => ({
      at: r.at,
      turn: {
        ref: r.id,
        role: "agent" as const,
        text: r.body ?? "",
        at: r.at.toISOString(),
        ...(r.stage ? { stage: r.stage } : {}),
      },
    })),
    ...native.map((r) => ({
      at: r.at,
      turn: { ref: r.id, role: "human" as const, text: r.body ?? "", at: r.at.toISOString() },
    })),
    ...got.map((r) => ({
      at: r.at,
      turn: { ref: r.id, role: "lead" as const, text: r.body ?? "", at: r.at.toISOString() },
    })),
  ];
  // Array.prototype.sort is stable, so ties keep source order (agent, human, lead).
  return all.sort((a, b) => a.at.getTime() - b.at.getTime()).map((x) => x.turn);
}

/** Account-learned rows first, then global rows (the policy's posterior prefers earlier cells). */
export function mergePriorTables(account: PriorTable, global: PriorTable): PriorTable {
  return [...account, ...global];
}
