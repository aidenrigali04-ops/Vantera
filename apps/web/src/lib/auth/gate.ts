import { safeNext } from "./safe-next";

export type GateArea = "auth" | "onboarding" | "app";

export type GateContext = {
  isAuthenticated: boolean;
  hasAccount: boolean;
  onboardingComplete: boolean;
};

/** Single source of truth for the signup → onboarding → dashboard chain (spec: hard gate). */
export function resolveGate(area: GateArea, ctx: GateContext): string | null {
  switch (area) {
    case "auth":
      return ctx.isAuthenticated ? "/dashboard" : null;
    case "onboarding":
      if (!ctx.isAuthenticated) return "/login";
      return ctx.onboardingComplete ? "/dashboard" : null;
    case "app":
      if (!ctx.isAuthenticated) return "/login";
      if (!ctx.hasAccount || !ctx.onboardingComplete) return "/onboarding";
      return null;
  }
}

/**
 * Deep-link preservation. When the gate sends a logged-out visitor to /login, carry the
 * path they were trying to reach as ?next= so the login action forwards them back there
 * (safeNext blocks open-redirects). Without this, every logged-out deep link into a
 * protected route — every pull-back / lifecycle email CTA (/approvals, /prospects,
 * /settings/billing, …) — dead-ends on /dashboard after sign-in instead of the surface the
 * email promised. Any non-/login destination (e.g. /onboarding) passes through unchanged.
 */
export function loginRedirect(dest: string, currentPath: string | null): string {
  if (dest !== "/login") return dest;
  const next = safeNext(currentPath);
  return next ? `/login?next=${encodeURIComponent(next)}` : "/login";
}
