"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { trackEvent } from "@/lib/analytics/clarity";

/**
 * Fires funnel events from redirect landing params, so success moments that end
 * in a server-action redirect (which the client never sees resolve) still get
 * tracked: `/agents?deployed=<kind>` → agent_deployed, `?onboarded=1` →
 * onboarding_completed. Mounted once in the (app) layout; renders nothing.
 */
export function RouteEvents() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const fired = useRef<Set<string>>(new Set());

  const deployed = params.get("deployed");
  const onboarded = params.get("onboarded");

  useEffect(() => {
    if (!deployed || fired.current.has(`deployed:${deployed}`)) return;
    fired.current.add(`deployed:${deployed}`);
    trackEvent("agent_deployed", { kind: deployed });
  }, [deployed]);

  useEffect(() => {
    if (!onboarded || fired.current.has("onboarded")) return;
    fired.current.add("onboarded");
    trackEvent("onboarding_completed");
    // Analytics-only param (unlike `deployed`, which drives the success banner) —
    // drop it so a refresh or bookmark can't re-fire the event.
    const rest = new URLSearchParams(params);
    rest.delete("onboarded");
    router.replace(rest.size ? `${pathname}?${rest}` : pathname, { scroll: false });
  }, [onboarded, params, pathname, router]);

  return null;
}
