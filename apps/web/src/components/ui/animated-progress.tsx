import { cn } from "@/lib/utils";

/**
 * Minimal determinate progress bar: a very thin track with a clean white-glow
 * fill — no brand color or shimmer, just a soft white bloom. The width eases to
 * its value for a sleek, understated look. (Step dots/steppers are styled separately.)
 */
export function AnimatedProgress({
  value,
  className,
  label,
}: {
  /** 0–100 */
  value: number;
  className?: string;
  label?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));

  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cn("relative h-0.5 w-full rounded-full bg-muted", className)}
    >
      <div
        className="absolute inset-y-0 left-0 rounded-full bg-[var(--cyan)] transition-[width] duration-500 ease-out"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
