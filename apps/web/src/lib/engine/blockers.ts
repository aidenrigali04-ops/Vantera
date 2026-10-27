import {
  enginePausedTile,
  paymentFailedTile,
  senderMissingTile,
  senderRepairTiles,
  type ActionTileSpec,
} from "@/lib/today/tiles";
import type { EngineState } from "./build";

/**
 * The engine blockers (the Approvals blockers stack) — the `tilesFor` subset that stops or
 * holds sending, built by the same tile builders so Today and Approvals never disagree:
 * sender repairs and a failed payment (P0), no sender yet (P1), the user's own pause (P2).
 */
export function blockersFor(s: EngineState, now: Date = new Date()): ActionTileSpec[] {
  const tz = s.timeZone;
  const tiles: ActionTileSpec[] = [...senderRepairTiles(s.senders, s.draftsHeld, tz)];
  const payment = paymentFailedTile(s.billing, now, tz);
  if (payment) tiles.push(payment);
  if (s.senders.length === 0) tiles.push(senderMissingTile());
  if (s.pausedAt) tiles.push(enginePausedTile(s.pausedAt, tz));
  return tiles;
}
