import Link from "next/link";
import { CloudCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { landingFont } from "@/components/landing/font";
import { VanteraLogo } from "@/components/landing/vantera-logo";
import { ONBOARDING_SEGMENTS, type OnboardingStep } from "@/lib/auth/onboarding-gate";
import { OnboardingProgress } from "./onboarding-progress";
import { OnboardingScene } from "./onboarding-scene";

/** The steps a visitor works through ("Account" is already done when they arrive). */
const STEPS = ONBOARDING_SEGMENTS.length - 1;

/**
 * The onboarding's root surface. `.landing` joins `.auth-surface` so the shared --cyan*
 * tokens resolve to brand blue, as on /signup; `marketing-type` + the font variable set it
 * in the marketing typeface (components/landing/font.ts), like the landing it follows on
 * from. Shared by the gated layout and the dev-only /onboarding-preview.
 */
export function OnboardingSurface({ children }: { children: React.ReactNode }) {
  return (
    <main
      className={cn(
        "auth-surface landing marketing-type relative min-h-screen bg-white",
        landingFont.variable,
      )}
    >
      {children}
    </main>
  );
}

/**
 * The onboarding layout, after rankbox.xyz's auth split and onboarding steps: a white form
 * column on the left — the mark, the setup bar, a "Step N of 3" label, a big heading whose
 * closing phrase is set in bold blue, a muted line, then the step itself — and on the right
 * the painted sky, inset and rounded, pinned to one screen while the form scrolls, with a
 * product card showing what the step sets in motion (onboarding-scene.tsx). Below lg the
 * panel goes and the form takes the width.
 */
export function OnboardingShell({
  step,
  title,
  sub,
  trialDays,
  children,
}: {
  step: OnboardingStep;
  title: React.ReactNode;
  sub: React.ReactNode;
  trialDays: number;
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <section className="flex min-w-0 flex-col px-5 py-6 sm:px-10 lg:px-14">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="flex w-fit shrink-0 items-center gap-2.5">
            <VanteraLogo className="size-6 text-[var(--fb)]" />
            <span className="text-[1.2rem] font-semibold tracking-tight text-foreground">Vantera</span>
          </Link>
          <p className="hidden items-center gap-1.5 text-xs text-[var(--ink-3)] sm:flex">
            <CloudCheck className="size-3.5" aria-hidden />
            Progress saved
          </p>
        </div>

        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-[30rem]">
            <OnboardingProgress step={step} />

            <header className="mt-10">
              <p className="inline-flex items-center gap-2 rounded-lg border border-[rgba(12,16,26,0.08)] bg-white px-2.5 py-1 text-[0.78rem] font-medium text-foreground shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
                <span aria-hidden className="size-1.5 rounded-full bg-[var(--fb)]" />
                Step {step} of {STEPS}
              </p>
              <h1 className="mt-4 text-balance text-[1.85rem] font-medium leading-[1.12] tracking-[-0.03em] text-foreground sm:text-[2.35rem]">
                {title}
              </h1>
              <p className="mt-2.5 text-pretty text-[0.95rem] leading-relaxed text-[var(--ink-3)]">
                {sub}
              </p>
            </header>

            <div className="mt-8">{children}</div>
          </div>
        </div>
      </section>

      {/* Inset from the window edge and rounded, like a framed picture; pinned so the
          whole scene stays in view however long the step runs. */}
      <div className="relative hidden lg:sticky lg:top-0 lg:block lg:h-screen lg:self-start lg:p-3">
        <OnboardingScene
          step={step}
          trialDays={trialDays}
          className="h-full w-full rounded-3xl ring-1 ring-black/5"
        />
      </div>
    </div>
  );
}
