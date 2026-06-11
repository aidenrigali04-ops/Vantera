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
