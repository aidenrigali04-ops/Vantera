"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { trackEvent } from "@/lib/analytics/clarity";

/**
 * Fires funnel events from redirect landing params, so success moments that end
 * in a server-action redirect (which the client never sees resolve) still get
 * tracked: `/agents?deployed=<kind>` → agent_deployed, `?onboarded=1` →
 * onboarding_completed, `/settings/billing?checkout=success&plan=…` →
 * subscription_started (Meta Subscribe with the plan's real value — Stripe's
 * return redirect is the only client-side moment checkout success is knowable).
 * Mounted once in the (app) layout; renders nothing.
 */
export function RouteEvents() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const fired = useRef<Set<string>>(new Set());

  const deployed = params.get("deployed");
  const onboarded = params.get("onboarded");
  const checkout = params.get("checkout");
  const plan = params.get("plan");
  const interval = params.get("interval");
  const value = params.get("value");

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

  useEffect(() => {
    if (checkout !== "success" || fired.current.has("checkout")) return;
    fired.current.add("checkout");
    trackEvent("subscription_started", {
      ...(plan ? { plan } : {}),
      ...(interval ? { interval } : {}),
      ...(value ? { value, currency: "USD" } : {}),
    });
    // Analytics-only params — drop them so a refresh or bookmark can't re-fire
    // the paid-conversion event (the fired guard only lives until remount).
    const rest = new URLSearchParams(params);
    for (const key of ["checkout", "plan", "interval", "value"]) rest.delete(key);
    router.replace(rest.size ? `${pathname}?${rest}` : pathname, { scroll: false });
  }, [checkout, plan, interval, value, params, pathname, router]);

  return null;
}
