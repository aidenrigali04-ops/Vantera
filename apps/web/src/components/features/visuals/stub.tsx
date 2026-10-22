import { CircleDashed } from "lucide-react";
import { ScreenCard, ScreenRow } from "@/components/landing/feature-row";
import type { FeatureVisuals } from "../types";

/**
 * Placeholder pictures for a feature whose own visuals module hasn't been built yet,
 * so its page still renders end to end. Every feature replaces these with its own.
 */
export function stubVisuals(name: string): FeatureVisuals {
  function Window() {
    return (
      <div className="rounded-[14px] border border-white/70 bg-white p-6 shadow-[0_2px_6px_rgba(3,22,58,0.16),0_40px_80px_-32px_rgba(3,22,58,0.55)]">
        <p className="text-[18px] font-semibold tracking-[-0.02em] text-foreground">{name}</p>
        <div className="mt-4 h-48 rounded-xl border border-[var(--hairline)] bg-[var(--tint)]" />
      </div>
    );
  }
  function Benefit() {
    return (
      <ScreenCard title={name}>
        <div className="flex flex-col gap-2">
          <ScreenRow label="Sample" value="—" />
          <ScreenRow label="Sample" value="—" />
        </div>
      </ScreenCard>
    );
  }
  function Step() {
    return <div className="h-20 rounded-lg border border-[var(--hairline)] bg-white" />;
  }
  return {
    Window,
    Peek: Window,
    benefits: [Benefit, Benefit, Benefit],
    benefitIcons: [CircleDashed, CircleDashed, CircleDashed],
    steps: [Step, Step, Step],
  };
}
