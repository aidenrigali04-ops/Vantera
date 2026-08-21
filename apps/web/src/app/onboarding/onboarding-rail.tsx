import Link from "next/link";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { VanteraLogo } from "@/components/landing/vantera-logo";
import { PixelField } from "@/components/landing/section-intro";
import {
  ONBOARDING_SEGMENTS,
  onboardingProgressPercent,
  type OnboardingStep,
} from "@/lib/auth/onboarding-gate";

/** One line under each segment so the rail reads as a map of the whole setup, not just labels. */
const SUBLINES: Record<(typeof ONBOARDING_SEGMENTS)[number], string> = {
  Account: "Created",
  Details: "Name, brand, website",
  LinkedIn: "Connect your account",
  Subscription: "Pick a plan, start your trial",
};

/**
 * The 25% rail — the hero's brand-blue poster carrying a vertical stepper. Endowed
 * progress: "Account" is already ticked when the user arrives, so the counter opens at 25%.
 * Hidden below lg (the page shows the compact horizontal bar there instead).
 */
export function OnboardingRail({ step }: { step: OnboardingStep }) {
  const percent = onboardingProgressPercent(step);
  return (
    <aside className="relative isolate hidden overflow-hidden text-white lg:flex lg:flex-col lg:px-10 lg:py-10 xl:px-12 [background:linear-gradient(180deg,#1877f2_0%,#1877f2_34%,#1468da_74%,#1163d2_100%)]">
      <PixelField />

      <Link href="/" className="relative flex items-center gap-2 text-white">
        <VanteraLogo className="size-6 text-white" />
        <span className="text-[18px] font-semibold tracking-[-0.02em]">Vantera</span>
      </Link>

      <div className="relative mt-16 flex flex-1 flex-col">
        {/* counter + thin bar — the number is the endowed-progress beat */}
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-label={`Setup ${percent}% complete`}
        >
          <div className="flex items-baseline justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/70">Setup</span>
            <span className="text-[13px] font-semibold tabular-nums text-white">{percent}%</span>
          </div>
          <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-white/20">
            <div
              className="h-full rounded-full bg-white transition-[width] duration-500 ease-out"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>

        {/* vertical stepper */}
        <ol className="mt-10 flex flex-col">
          {ONBOARDING_SEGMENTS.map((label, i) => {
            const done = i < step;
            const active = i === step;
            const last = i === ONBOARDING_SEGMENTS.length - 1;
            return (
              <li key={label} className="relative flex gap-4">
                {/* indicator + connector */}
                <div className="flex flex-col items-center">
                  <span
                    className={cn(
                      "grid size-7 shrink-0 place-items-center rounded-full border-2 text-[12px] font-bold transition-colors",
                      done
                        ? "border-white bg-white text-[var(--fb-strong)]"
                        : active
                          ? "border-white bg-transparent text-white"
                          : "border-white/35 bg-transparent text-white/50"
                    )}
                    aria-hidden
                  >
                    {done ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
                  </span>
                  {!last && (
                    <span
                      className={cn("my-1.5 w-px flex-1 min-h-7", done ? "bg-white" : "bg-white/25")}
                      aria-hidden
                    />
                  )}
                </div>
                <div className={cn("pb-7 pt-0.5", last && "pb-0")}>
                  <p
                    className={cn(
                      "text-[14.5px] font-semibold leading-tight",
                      active || done ? "text-white" : "text-white/55"
                    )}
                    aria-current={active ? "step" : undefined}
                  >
                    {label}
                  </p>
                  <p className={cn("mt-1 text-[12.5px] leading-snug", active ? "text-white/80" : "text-white/50")}>
                    {done && i === 0 ? "Created" : SUBLINES[label]}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      <p className="relative mt-10 text-[12px] leading-relaxed text-white/65">
        Nothing sends without your approval.
      </p>
    </aside>
  );
}
