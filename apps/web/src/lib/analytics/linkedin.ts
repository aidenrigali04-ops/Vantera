// Client-side wrapper over the LinkedIn Insight Tag (lintrk) loaded in app/layout.tsx.
// Every call is SSR-safe (no-op without window) and race-safe: if the tag hasn't
// executed yet, we create the same queue stub the official snippet uses, so calls made
// before insight.min.js loads are replayed once it does. Without a
// NEXT_PUBLIC_LINKEDIN_PARTNER_ID every call is a no-op — dev and unset environments
// never queue or send anything.

type LintrkFn = ((action: string, data?: Record<string, unknown>) => void) & {
  q?: unknown[][];
};

declare global {
  interface Window {
    lintrk?: LintrkFn;
    _linkedin_data_partner_ids?: string[];
  }
}

function partnerId(): string {
  return process.env.NEXT_PUBLIC_LINKEDIN_PARTNER_ID ?? "";
}

function lintrk(action: string, data?: Record<string, unknown>): void {
  if (typeof window === "undefined" || !partnerId()) return;
  if (!window.lintrk) {
    // Mirror the official snippet's stub exactly — insight.min.js detects `.q` and
    // replays queued [action, data] pairs on load.
    const stub = function (this: unknown, a: string, b?: Record<string, unknown>) {
      (stub.q = stub.q ?? []).push([a, b]);
    } as LintrkFn;
    stub.q = [];
    window.lintrk = stub;
  }
  window.lintrk(action, data);
}

// Funnel-name → LinkedIn conversion id (numeric, created in Campaign Manager and pasted
// into the env). Mirrors the Meta standard-event bridge: one trackEvent() call fans out
// to Clarity + GA4 + Meta + here. Ids are read at call time (each NEXT_PUBLIC_* is inlined
// at build) so unset ids simply no-op — only the conversions you've defined fire.
// onboarding_completed is the signup conversion to optimize LinkedIn campaigns toward.
function conversionIdFor(name: string): string | undefined {
  switch (name) {
    case "onboarding_started":
      return process.env.NEXT_PUBLIC_LI_CONV_LEAD;
    case "onboarding_completed":
      return process.env.NEXT_PUBLIC_LI_CONV_SIGNUP;
    case "checkout_started":
      return process.env.NEXT_PUBLIC_LI_CONV_CHECKOUT;
    case "subscription_started":
      return process.env.NEXT_PUBLIC_LI_CONV_SUBSCRIBE;
    default:
      return undefined;
  }
}

/** Forward a funnel event to LinkedIn as a conversion, when a conversion id is mapped. */
export function linkedinFunnelEvent(name: string): void {
  const mapped = conversionIdFor(name);
  if (!mapped) return;
  const conversionId = Number(mapped);
  if (!Number.isFinite(conversionId)) return;
  lintrk("track", { conversion_id: conversionId });
}
