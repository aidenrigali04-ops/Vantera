import { LandingNav } from "@/components/landing/nav";
import { LandingFooter } from "@/components/landing/footer";

/**
 * Shared chrome for marketing/content subpages (blog, trust pages). Mirrors the homepage:
 * the `.landing` scope (white + cyan + Poppins light system) with the fixed nav and footer.
 */
export function MarketingShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="landing relative min-h-screen w-full overflow-x-clip">
      <LandingNav />
      <main>{children}</main>
      <LandingFooter />
    </div>
  );
}
