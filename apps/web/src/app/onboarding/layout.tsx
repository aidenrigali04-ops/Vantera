import { redirect } from "next/navigation";
import Link from "next/link";
import { getGateData, toGateContext } from "@/lib/auth/context";
import { resolveGate } from "@/lib/auth/gate";
import { VanteraLogo } from "@/components/landing/vantera-logo";

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const ctx = toGateContext(await getGateData());
  const dest = resolveGate("onboarding", ctx);
  // Production keeps the strict gate (unauth → /login, already-onboarded → /dashboard).
  // Local dev only: let an authenticated owner re-open the wizard for design review.
  const allowDevReview = process.env.NODE_ENV === "development" && ctx.isAuthenticated;
  if (dest && !allowDevReview) redirect(dest);
  return (
    // 2026 premium light system via `.auth-surface` (matches landing + auth), with a
    // single soft cyan wash up top. Replaces the old dark particle/glass UI.
    <main className="auth-surface relative flex min-h-screen flex-col items-center justify-center bg-[var(--tint)] px-6 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{ background: "radial-gradient(44% 34% at 50% 0%, rgba(11, 87, 171,0.12), transparent 62%)" }}
      />
      <Link href="/" className="mb-8 flex items-center gap-2 text-foreground">
        <VanteraLogo className="size-6 text-foreground" />
        <span className="text-[19px] font-semibold tracking-[-0.02em]">Vantera</span>
      </Link>
      <div className="w-full max-w-lg">{children}</div>
    </main>
  );
}
