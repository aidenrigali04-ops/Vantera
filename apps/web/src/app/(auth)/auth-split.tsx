import Link from "next/link";
import { VanteraLogo } from "@/components/landing/vantera-logo";
import { LaurelBadges } from "@/components/landing/laurel-badges";
import { PixelField } from "@/components/landing/section-intro";
import { AuthTestimonials } from "./auth-testimonials";

/**
 * Split auth layout — "Poster & Product", mirrored (the chosen direction). LEFT: a
 * white form column, card-less, the form where forms conventionally live. RIGHT: the
 * hero's brand-blue poster — a rotating customer testimonial over the drifting
 * pixels. The laurel badges sit above the form, where the credential is read as the
 * user commits.
 *
 * `landing` joins `auth-surface` on the root so the shared --cyan* tokens resolve to
 * brand blue here and the hero-pixel keyframes apply; both scopes define the same base
 * palette, so nothing else shifts. The poster hides below lg; the form goes full-width.
 */
export function AuthSplit({ children }: { children: React.ReactNode }) {
  return (
    <main className="auth-surface landing relative min-h-screen w-full bg-white lg:grid lg:grid-cols-[1fr_1fr]">
      {/* LEFT — the form column */}
      <div className="relative flex min-h-screen flex-col px-6 py-8 sm:px-12 lg:px-16">
        <Link href="/" className="flex items-center gap-2 text-foreground">
          <VanteraLogo className="size-6 text-foreground" />
          <span className="text-[18px] font-semibold tracking-[-0.02em]">Vantera</span>
        </Link>

        <div className="flex flex-1 items-center py-10">
          <div className="mx-auto w-full max-w-[440px] lg:mx-0 lg:ml-auto lg:mr-14">
            <LaurelBadges tone="dark" className="mb-8" />
            {children}
          </div>
        </div>
      </div>

      {/* RIGHT — the blue poster */}
      <div className="relative isolate hidden overflow-hidden text-white lg:flex lg:flex-col lg:px-16 lg:py-10 [background:linear-gradient(180deg,#1877f2_0%,#1877f2_34%,#1468da_74%,#1163d2_100%)]">
        <PixelField />

        <div className="relative flex flex-1 flex-col justify-center">
          <AuthTestimonials />
        </div>

        <p className="relative text-[12.5px] text-white/70">
          Free 7-day trial · Cancel anytime · You approve every send
        </p>
      </div>
    </main>
  );
}
