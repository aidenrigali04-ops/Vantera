import { LandingNav } from "@/components/landing/nav";
import { LandingFooter } from "@/components/landing/footer";
import { landingFont } from "@/components/landing/font";

/**
 * Shared chrome for marketing/content subpages (blog, trust pages). Mirrors the homepage:
 * the `.landing` scope (white + blue light system, set in the marketing typeface from
 * font.ts) with the nav and footer.
 *
 * `framed` draws the page in the homepage's frame (components/landing/frame.tsx): the
 * nav sits in the flow with hairline rails that run down through the page's bands, and
 * the footer closes the frame. Without it, the nav floats over the page as before, so
 * every page that hasn't moved to the frame is unchanged.
 */
export function MarketingShell({
  children,
  framed = false,
}: {
  children: React.ReactNode;
  framed?: boolean;
}) {
  return (
    <div className={`landing ${landingFont.variable} relative min-h-screen w-full overflow-x-clip`}>
      <LandingNav framed={framed} />
      <main>{children}</main>
      <LandingFooter framed={framed} />
    </div>
  );
}
