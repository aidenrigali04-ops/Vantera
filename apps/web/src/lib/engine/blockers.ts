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
 * sender repairs, a failed payment and an ended subscription (P0), no sender yet (P1), the
 * user's own pause (P2). (A weekly-ceiling tile is deferred.)
 */
export function blockersFor(s: EngineState, now: Date = new Date()): ActionTileSpec[] {
  const tz = s.timeZone;
  const tiles: ActionTileSpec[] = [...senderRepairTiles(s.senders, s.draftsHeld, tz)];
  const payment = paymentFailedTile(s.billing, now, tz);
  if (payment) tiles.push(payment);
  const ended = subscriptionEndedTile(s.billing);
  if (ended) tiles.push(ended);
  if (s.senders.length === 0) tiles.push(senderMissingTile());
  if (s.pausedAt) tiles.push(enginePausedTile(s.pausedAt, tz));
  return tiles;
}

/**
 * P0: the subscription is canceled or the trial ran out (`none`) — sending is off until the
 * plan restarts, even though the queue still looks live. Founder-exempt workspaces read as
 * `active` (billingFacts), so they never see it.
 */
export function subscriptionEndedTile(billing: EngineState["billing"]): ActionTileSpec | null {
  if (billing.status !== "canceled" && billing.status !== "none") return null;
  return {
    kind: "subscription_ended",
    priority: 0,
    tone: "billing",
    glyph: "credit-card",
    title: "Subscription ended",
    meta: "Restart your plan to resume sending · approvals still open",
    href: "/settings/billing",
    dismissible: false,
  };
}
