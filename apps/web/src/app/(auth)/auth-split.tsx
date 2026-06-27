import Link from "next/link";
import { VanteraLogo } from "@/components/landing/vantera-logo";
import { PipelineShowcase } from "./pipeline-showcase";

/**
 * Split auth layout — a clean, card-less form column on the left (logo, big headline,
 * the form) and a full-bleed dark studio stage on the right that runs the cinematic
 * "Intent → Close" animation panel. Light-left / dark-right split; the right column is
 * hidden on small screens so the form goes full-width. Premium light system via
 * `.auth-surface`.
 */
export function AuthSplit({ children }: { children: React.ReactNode }) {
  return (
    <main className="auth-surface relative min-h-screen w-full bg-white lg:grid lg:grid-cols-[1fr_1.06fr]">
      {/* LEFT — form column */}
      <div className="relative flex min-h-screen flex-col px-6 py-9 sm:px-12 lg:px-16">
        <Link href="/" className="flex items-center gap-2 text-foreground">
          <VanteraLogo className="size-6 text-foreground" />
          <span className="text-[18px] font-semibold tracking-[-0.02em]">Vantera</span>
        </Link>

        <div className="flex flex-1 items-center py-10">
          <div className="mx-auto w-full max-w-[440px] lg:mx-0">{children}</div>
        </div>
      </div>

      {/* RIGHT — light studio stage with the animation panel (a hair deeper than the
          white left column, with a hairline seam, so the split reads cleanly) */}
      <div className="relative hidden border-l border-[var(--hairline)] bg-[var(--tint)] lg:block">
        <div className="sticky top-0 h-screen">
          <PipelineShowcase />
        </div>
      </div>
    </main>
  );
}
