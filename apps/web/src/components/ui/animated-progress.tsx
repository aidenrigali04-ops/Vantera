"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

// Vantera particle palette (yellow → orange → red) — the same stops the
// onboarding dotted-surface particles and the auth beam use. Looped back to
// the first stop so the flowing background tiles seamlessly.
const FLOW =
  "linear-gradient(90deg, #FFCC1A 0%, #FF730D 35%, #EB291C 60%, #FF730D 85%, #FFCC1A 100%)";

/**
 * Determinate progress bar with the Claude-chat "working" treatment, in Vantera
 * brand colors: the filled portion is a continuously flowing brand gradient with
 * a sheen that sweeps across it. Falls back to a static brand fill when the user
 * prefers reduced motion.
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
  const reduce = useReducedMotion();
  const pct = Math.max(0, Math.min(100, value));

  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cn("relative h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}
    >
      <motion.div
        className="absolute inset-y-0 left-0 overflow-hidden rounded-full"
        initial={false}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        {/* flowing brand gradient */}
        <motion.div
          className="absolute inset-0"
          style={{ backgroundImage: FLOW, backgroundSize: "200% 100%" }}
          animate={reduce ? undefined : { backgroundPosition: ["0% 0%", "-200% 0%"] }}
          transition={{ duration: 3, ease: "linear", repeat: Infinity }}
        />
        {/* traveling sheen — the shimmer sweep */}
        {!reduce && (
          <motion.div
            className="absolute inset-y-0 left-0 w-1/3"
            style={{
              backgroundImage:
                "linear-gradient(90deg, transparent, rgba(255,255,255,0.65), transparent)",
            }}
            animate={{ x: ["-120%", "360%"] }}
            transition={{ duration: 1.8, ease: "easeInOut", repeat: Infinity, repeatDelay: 0.6 }}
          />
        )}
      </motion.div>
    </div>
  );
}
