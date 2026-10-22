"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { trackEvent } from "@/lib/analytics/clarity";
import { eventsForRouteParams } from "./route-event-map";

/**
 * Fires funnel events from redirect landing params, so success moments that end
 * in a server-action redirect (which the client never sees resolve) still get
 * tracked: `/playbook?deployed=<kind>` → agent_deployed, `?onboarded=1` →
 * onboarding_completed, `/settings/billing?checkout=success&plan=…` →
 * subscription_started (Meta Subscribe with the plan's real value — Stripe's
 * return redirect is the only client-side moment checkout success is knowable).
 * `?connected=1` (senders) → linkedin_connected, left in the URL because the senders
 * banner reads it. All rules live in `eventsForRouteParams`. Mounted once in the (app) layout; renders nothing.
 */
export function RouteEvents() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const fired = useRef<Set<string>>(new Set());

  useEffect(() => {
    const strip = new Set<string>();
    for (const ev of eventsForRouteParams(params, pathname)) {
      const key = `${ev.name}:${ev.params?.kind ?? ""}`;
      if (fired.current.has(key)) continue;
      fired.current.add(key);
      trackEvent(ev.name, ev.params);
      ev.strip.forEach((k) => strip.add(k));
    }
    if (strip.size === 0) return;
    // Analytics-only params — drop them so a refresh or bookmark can't re-fire.
    const rest = new URLSearchParams(params);
    strip.forEach((k) => rest.delete(k));
    router.replace(rest.size ? `${pathname}?${rest}` : pathname, { scroll: false });
  }, [params, pathname, router]);

  return null;
}
