export interface RouteEvent {
  name: string;
  params?: Record<string, string>;
  /** Query params to drop after firing (analytics-only). `connected` is never stripped: the senders banner reads it. */
  strip: string[];
}

/** Pure param→events mapper behind `RouteEvents` (so the funnel mapping is unit-pinned). */
export function eventsForRouteParams(params: URLSearchParams, pathname: string): RouteEvent[] {
  const events: RouteEvent[] = [];
  const deployed = params.get("deployed");
  if (deployed) events.push({ name: "agent_deployed", params: { kind: deployed }, strip: [] });
  if (params.get("onboarded")) events.push({ name: "onboarding_completed", strip: ["onboarded"] });
  if (params.get("checkout") === "success") {
    const plan = params.get("plan");
    const interval = params.get("interval");
    const value = params.get("value");
    events.push({
      name: "subscription_started",
      params: {
        ...(plan ? { plan } : {}),
        ...(interval ? { interval } : {}),
        ...(value ? { value, currency: "USD" } : {}),
      },
      strip: ["checkout", "plan", "interval", "value"],
    });
  }
  if (params.get("connected") === "1" && pathname === "/settings/senders") {
    events.push({ name: "linkedin_connected", strip: [] });
  }
  return events;
}
