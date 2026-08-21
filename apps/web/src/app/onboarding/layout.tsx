import { redirect } from "next/navigation";
import { getGateData, toGateContext } from "@/lib/auth/context";
import { resolveGate } from "@/lib/auth/gate";

/**
 * Onboarding shell — gate + surface tokens only. The page owns the 25 / 75 split (the blue
 * progress rail needs the resolved step, which the page computes). `.landing` joins
 * `.auth-surface` so the shared --cyan* tokens resolve to brand blue, as on /signup.
 * The hard gate is unchanged: unauth → /login, already-onboarded → /dashboard.
 */
export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const ctx = toGateContext(await getGateData());
  const dest = resolveGate("onboarding", ctx);
  // Production keeps the strict gate. Local dev only: let an authenticated owner re-open
  // the flow for design review.
  const allowDevReview = process.env.NODE_ENV === "development" && ctx.isAuthenticated;
  if (dest && !allowDevReview) redirect(dest);
  return <main className="auth-surface landing relative min-h-screen bg-white">{children}</main>;
}
