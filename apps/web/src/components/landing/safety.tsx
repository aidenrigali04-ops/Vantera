import { Check, Lock } from "lucide-react";
import { CEILING_FACT } from "./claims";
import { ScreenCard, ScreenRow } from "./feature-row";

/**
 * The safety row's screen — "Will this get my account restricted?" Each line is a
 * real mechanism (rules 04/11): the login never stored, the hard weekly ceiling
 * (claims.ts, not configurable above it), randomized human pacing, the warmup ramp,
 * and the auto-pause on a security check. Locks mark the two that can't be changed.
 */

const CHECKS: { label: string; value: string; locked?: boolean }[] = [
  { label: "Login", value: "Never stored", locked: true },
  { label: "Weekly ceiling", value: CEILING_FACT, locked: true },
  { label: "Pacing", value: "Randomized, human" },
  { label: "Warmup", value: "Gradual weekly ramp" },
  { label: "Security check", value: "Auto-pause" },
];

export function SafetyScreen() {
  return (
    <ScreenCard
      title="Account safety"
      meta={
        <span className="inline-flex items-center gap-1 rounded-md border border-[rgba(19,130,74,0.3)] bg-[rgba(19,130,74,0.1)] px-1.5 py-0.5 text-[0.68rem] font-semibold text-[#13824a]">
          <span className="size-1.5 rounded-full bg-[#13824a]" />
          All clear
        </span>
      }
    >
      <div className="space-y-1.5">
        {CHECKS.map((c) => (
          <ScreenRow
            key={c.label}
            label={c.label}
            value={
              <span className="inline-flex items-center gap-1.5">
                {c.locked ? (
                  <Lock className="size-3 text-[var(--ink-3)]" strokeWidth={2.4} />
                ) : (
                  <Check className="size-3 text-[#13824a]" strokeWidth={2.6} />
                )}
                {c.value}
              </span>
            }
          />
        ))}
      </div>
    </ScreenCard>
  );
}
