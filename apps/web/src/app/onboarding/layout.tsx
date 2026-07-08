import { redirect } from "next/navigation";
import { getGateData, toGateContext } from "@/lib/auth/context";
import { resolveGate } from "@/lib/auth/gate";
import { ClarityIdentity } from "@/components/analytics/clarity-identity";

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const data = await getGateData();
  const ctx = toGateContext(data);
  const dest = resolveGate("onboarding", ctx);
  // Production keeps the strict gate (unauth → /login, already-onboarded → /dashboard).
  // Local dev only: let an authenticated owner re-open the wizard for design review.
  const allowDevReview = process.env.NODE_ENV === "development" && ctx.isAuthenticated;
  if (dest && !allowDevReview) redirect(dest);
  // Full-bleed: the wizard owns the whole viewport (dark pipeline rail + light input
  // panel), so the layout is just the gate + the premium-light `.auth-surface` scope.
  return (
    <main className="auth-surface min-h-svh bg-white">
      {/* Onboarding sessions are low-volume and decisive — identify them and ask
          Clarity to prioritize their recordings (upgrade). */}
      {data.user && (
        <ClarityIdentity
          userId={data.user.id}
          friendlyName={data.user.email ?? undefined}
          tags={{ surface: "onboarding", accountId: data.account?.id ?? "" }}
          upgradeReason="onboarding"
          mountEvent="onboarding_started"
        />
      )}
      {children}
    </main>
  );
}
