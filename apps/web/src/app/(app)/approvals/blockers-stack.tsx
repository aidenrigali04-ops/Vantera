"use client";

import { ActionTile } from "@/components/today";
import type { ActionTileSpec } from "@/lib/today/tiles";

/**
 * What stops the queue from sending (a down sender, billing, a paused engine), stacked
 * above the list. The loader returns only blocking kinds, so nothing is filtered here;
 * nothing renders when the queue is clear to send.
 */
export function BlockersStack({ blockers, onResume }: { blockers: ActionTileSpec[]; onResume?: () => void }) {
  if (blockers.length === 0) return null;
  return (
    <ul className="flex flex-col gap-2" aria-label="Blocking sends">
      {blockers.map((tile) => (
        <li key={`${tile.kind}:${tile.href}`}>
          <ActionTile tile={tile} onResume={onResume} />
        </li>
      ))}
    </ul>
  );
}
