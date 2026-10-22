import { redirect } from "next/navigation";
import { getGateData, toGateContext } from "@/lib/auth/context";
import { resolveGate } from "@/lib/auth/gate";
import { OnboardingSurface } from "./onboarding-shell";

/**
 * Onboarding shell — gate + surface only. The page owns the split layout (the painted
 * panel shows the resolved step, which the page computes); OnboardingSurface carries the
 * tokens and the marketing typeface. The hard gate is unchanged: unauth → /login,
 * already-onboarded → /dashboard.
 */
export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const ctx = toGateContext(await getGateData());
  const dest = resolveGate("onboarding", ctx);
  // Production keeps the strict gate. Local dev only: let an authenticated owner re-open
  // the flow for design review.
  const allowDevReview = process.env.NODE_ENV === "development" && ctx.isAuthenticated;
  if (dest && !allowDevReview) redirect(dest);
  return <OnboardingSurface>{children}</OnboardingSurface>;
}
