// Client-side wrapper over the Microsoft Clarity tag loaded in app/layout.tsx.
// Every call is SSR-safe (no-op without window) and race-safe: if the tag hasn't
// executed yet, we create the same queue stub the official bootstrap uses, so
// calls made before the script loads are replayed once it does. In dev the tag
// never loads (production-only), so calls queue harmlessly and send nothing.

import { metaFunnelEvent } from "./meta";

type ClarityFn = ((...args: unknown[]) => void) & { q?: unknown[] };

declare global {
  interface Window {
    clarity?: ClarityFn;
    dataLayer?: unknown[];
  }
}

function clarity(...args: unknown[]): void {
  if (typeof window === "undefined") return;
  if (!window.clarity) {
    const stub: ClarityFn = function (this: unknown) {
      // eslint-disable-next-line prefer-rest-params
      (stub.q = stub.q ?? []).push(arguments);
    };
    window.clarity = stub;
  }
  window.clarity(...args);
}

/** Tie the Clarity session to a user. The id is hashed by Clarity before upload;
 *  the friendly name (we pass the email) is what shows in the recordings list. */
export function clarityIdentify(userId: string, friendlyName?: string): void {
  clarity("identify", userId, undefined, undefined, friendlyName);
}

/** Custom tag — filterable in the Clarity dashboard (plan, surface, accountId…). */
export function claritySet(key: string, value: string): void {
  clarity("set", key, value);
}

/** Custom event — becomes a Clarity smart event for funnel/session filtering. */
export function clarityEvent(name: string): void {
  clarity("event", name);
}

/** Prioritize this session's recording (low-volume, high-value flows like onboarding). */
export function clarityUpgrade(reason: string): void {
  clarity("upgrade", reason);
}

/** Funnel event, fired to all three destinations: Clarity smart event + GA4 event
 *  through the gtag dataLayer + Meta Pixel (standard event when the name maps to
 *  one — see lib/analytics/meta). All tags load in app/layout.tsx; same
 *  queue-before-load semantics everywhere. */
export function trackEvent(name: string, params?: Record<string, string>): void {
  clarityEvent(name);
  metaFunnelEvent(name, params);
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer ?? [];
  // gtag.js only processes `arguments` objects pushed to the dataLayer — not arrays.
  const gtag = function (this: unknown) {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  } as (command: string, eventName: string, params?: Record<string, string>) => void;
  gtag("event", name, params ?? {});
}
