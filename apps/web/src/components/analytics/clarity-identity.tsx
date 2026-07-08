"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { clarityIdentify, claritySet, clarityUpgrade, trackEvent } from "@/lib/analytics/clarity";
import { metaIdentify } from "@/lib/analytics/meta";

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
  // Meta advanced matching rides the same seam: the signed-in email (the friendly
  // name everywhere this component is rendered) lets Meta match Lead/Subscribe
  // conversions back to the ad click that produced them. fbq dedupes re-inits.
  useEffect(() => {
    clarityIdentify(userId, friendlyName);
    if (friendlyName?.includes("@")) metaIdentify(friendlyName);
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
    // trackEvent (not clarityEvent): the mount moment reaches GA4 + Meta too —
    // onboarding_started is the signup conversion (maps to Meta's Lead event).
    if (mountEvent) trackEvent(mountEvent);
  }, [upgradeReason, mountEvent]);

  return null;
}
