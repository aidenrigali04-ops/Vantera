"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { clarityEvent, clarityIdentify, claritySet, clarityUpgrade } from "@/lib/analytics/clarity";

/**
 * Ties the Clarity session to the signed-in user and stamps filterable tags.
 * Rendered from server layouts (dashboard, onboarding) with session-derived
 * props — identity always comes from the validated session, never the client.
 * Renders nothing.
 */
export function ClarityIdentity({
  userId,
  friendlyName,
  tags,
  upgradeReason,
  mountEvent,
}: {
  userId: string;
  friendlyName?: string;
  /** Filterable session tags (plan, surface, accountId…). Empty values are skipped. */
  tags?: Record<string, string>;
  /** Prioritize recording this session (low-volume, high-value flows). */
  upgradeReason?: string;
  /** Funnel event fired once when the surface mounts. */
  mountEvent?: string;
}) {
  const pathname = usePathname();

  // Clarity recommends identify on every page view — SPA navigations included.
  useEffect(() => {
    clarityIdentify(userId, friendlyName);
  }, [pathname, userId, friendlyName]);

  // Serialized so a fresh object literal from a server re-render doesn't re-tag.
  const tagsJson = JSON.stringify(tags ?? {});
  useEffect(() => {
    for (const [key, value] of Object.entries(JSON.parse(tagsJson) as Record<string, string>)) {
      if (value) claritySet(key, value);
    }
  }, [tagsJson]);

  const firedMount = useRef(false);
  useEffect(() => {
    if (firedMount.current) return;
    firedMount.current = true;
    if (upgradeReason) clarityUpgrade(upgradeReason);
    if (mountEvent) clarityEvent(mountEvent);
  }, [upgradeReason, mountEvent]);

  return null;
}
