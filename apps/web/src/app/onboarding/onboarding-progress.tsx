import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ONBOARDING_SEGMENTS,
  onboardingProgressPercent,
  type OnboardingStep,
} from "@/lib/auth/onboarding-gate";

/**
 * Endowed progress: the first segment ("Account") is already complete when the user
 * arrives, so the bar opens at 25% — never at zero. `step` = 1 Details · 2 LinkedIn ·
 * 3 Subscription. The percentage is announced for assistive tech via the progressbar role.
 */
export function OnboardingProgress({ step }: { step: OnboardingStep }) {
  const percent = onboardingProgressPercent(step);
  return (
    <div
      className="mb-10"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-label={`Setup ${percent}% complete`}
    >
      <div className="flex items-center gap-2">
        {ONBOARDING_SEGMENTS.map((label, i) => {
          const done = i < step; // the endowed segment (i=0) + everything before the current step
          const active = i === step;
          return (
            <div key={label} className="flex flex-1 flex-col gap-2">
              <div
                className={cn(
                  "h-1 rounded-full transition-colors",
                  // only COMPLETED segments fill solid, so the bar reads exactly 25/50/75%;
                  // the current step gets a soft tint that marks "you are here"
                  done ? "bg-[var(--fb)]" : active ? "bg-[rgba(24,119,242,0.28)]" : "bg-[rgba(12,16,26,0.10)]"
                )}
              />
              <span
                className={cn(
                  "flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-[0.1em]",
                  active ? "text-[var(--fb-strong)]" : done ? "text-[var(--ink-3)]" : "text-[var(--ink-4)]"
                )}
              >
                {done && <Check className="size-3" strokeWidth={3} />}
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
