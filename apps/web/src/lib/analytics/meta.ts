// Client-side wrapper over the Meta Pixel (fbq) loaded in app/layout.tsx.
// Every call is SSR-safe (no-op without window) and race-safe: if the tag hasn't
// executed yet, we create the same queue stub the official bootstrap uses, so
// calls made before fbevents.js loads are replayed once it does. Without a
// NEXT_PUBLIC_META_PIXEL_ID every call is a no-op — dev and unset environments
// never queue or send anything.

type FbqFn = ((...args: unknown[]) => void) & {
  queue?: unknown[];
  callMethod?: (...args: unknown[]) => void;
  push?: FbqFn;
  loaded?: boolean;
  version?: string;
};

declare global {
  interface Window {
    fbq?: FbqFn;
    _fbq?: FbqFn;
  }
}

function pixelId(): string {
  return process.env.NEXT_PUBLIC_META_PIXEL_ID ?? "";
}

function fbq(...args: unknown[]): void {
  if (typeof window === "undefined" || !pixelId()) return;
  if (!window.fbq) {
    // Mirror the official bootstrap's stub exactly — fbevents.js detects this
    // shape (queue/push/loaded/version) and replays queued calls on load.
    const stub: FbqFn = function (this: unknown) {
      if (stub.callMethod) {
        // eslint-disable-next-line prefer-rest-params, prefer-spread
        stub.callMethod.apply(stub, Array.prototype.slice.call(arguments));
      } else {
        // eslint-disable-next-line prefer-rest-params
        (stub.queue = stub.queue ?? []).push(arguments);
      }
    };
    stub.push = stub;
    stub.loaded = true;
    stub.version = "2.0";
    stub.queue = [];
    window.fbq = stub;
    window._fbq = stub;
  }
  window.fbq(...args);
}

/** Meta standard event (optimizable as an ad-campaign conversion goal). */
export function metaTrack(event: string, params?: Record<string, unknown>): void {
  fbq("track", event, params ?? {});
}

/** Non-standard event — usable for custom conversions and audiences. */
export function metaTrackCustom(name: string, params?: Record<string, unknown>): void {
  fbq("trackCustom", name, params ?? {});
}

/** Advanced matching: attach the signed-in email so Meta can match conversions
 *  back to ad clicks. The pixel SHA-256 hashes the value before any network send. */
export function metaIdentify(email: string): void {
  fbq("init", pixelId(), { em: email.trim().toLowerCase() });
}

// The funnel-name → Meta standard-event bridge. trackEvent() (lib/analytics/clarity)
// fires every funnel event to Clarity + GA4 + here, so one call site per moment keeps
// all three destinations in sync. Names not in this map become custom events.
const FUNNEL_TO_STANDARD: Record<string, string> = {
  onboarding_started: "Lead", // signup is confirmation-free — onboarding mount = account created
  onboarding_completed: "CompleteRegistration",
  checkout_started: "InitiateCheckout",
  subscription_started: "Subscribe",
};

/** Once-per-browser guard so a mid-wizard refresh can't inflate Lead counts. */
const LEAD_FIRED_KEY = "vantera_meta_lead";

/**
 * Forward a funnel event to Meta: mapped names fire as standard events (with
 * `value` coerced to a number and a USD currency default so purchase-style events
 * carry real conversion value), everything else as a custom event.
 */
export function metaFunnelEvent(name: string, params?: Record<string, string>): void {
  const standard = FUNNEL_TO_STANDARD[name];
  if (!standard) {
    metaTrackCustom(name, params);
    return;
  }
  if (standard === "Lead" && typeof window !== "undefined") {
    try {
      if (window.localStorage.getItem(LEAD_FIRED_KEY)) return;
      window.localStorage.setItem(LEAD_FIRED_KEY, "1");
    } catch {
      // storage unavailable (private mode) — fire without the guard
    }
  }
  const out: Record<string, unknown> = { ...(params ?? {}) };
  if (typeof out.value === "string") {
    const value = Number(out.value);
    if (Number.isFinite(value)) {
      out.value = value;
      out.currency = out.currency ?? "USD";
    } else {
      delete out.value;
    }
  }
  metaTrack(standard, out);
}
