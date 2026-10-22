import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ONBOARDING_SEGMENTS,
  onboardingProgressPercent,
  type OnboardingStep,
} from "@/lib/auth/onboarding-gate";

/**
 * The setup bar, after rankbox's onboarding header: thin segments with their names under
 * them. Endowed progress: the first segment ("Account") is already complete when the user
 * arrives, so the bar opens at 25% — never at zero. Only finished segments fill solid, so
 * it reads exactly 25 / 50 / 75%; the current one carries a soft tint that marks "you are
 * here". `step` = 1 Details · 2 LinkedIn · 3 Subscription. The percentage is announced for
 * assistive tech through the progressbar role.
 */
export function OnboardingProgress({ step }: { step: OnboardingStep }) {
  const percent = onboardingProgressPercent(step);
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-label={`Setup ${percent}% complete`}
    >
      <ol className="flex items-center gap-2">
        {ONBOARDING_SEGMENTS.map((label, i) => {
          const done = i < step; // the endowed segment (i=0) + everything before the current step
          const active = i === step;
          return (
            <li key={label} className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span
                aria-hidden
                className={cn(
                  "h-1 w-full rounded-full transition-colors duration-300",
                  done
                    ? "bg-[var(--fb)]"
                    : active
                      ? "bg-[rgba(24,119,242,0.28)]"
                      : "bg-[rgba(12,16,26,0.08)]",
                )}
              />
              {/* Names from sm up, as on rankbox; on a phone the "Step N of 3" label
                  under the bar says where you are. */}
              <span
                aria-current={active ? "step" : undefined}
                className={cn(
                  "hidden items-center gap-1 truncate text-xs transition-colors sm:flex",
                  active
                    ? "font-semibold text-foreground"
                    : done
                      ? "font-medium text-foreground"
                      : "text-[var(--ink-3)]",
                )}
              >
                {done && <Check className="size-3 text-[var(--fb)]" strokeWidth={3} aria-hidden />}
                {label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
