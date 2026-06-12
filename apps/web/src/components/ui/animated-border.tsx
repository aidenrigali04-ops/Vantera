"use client";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

/**
 * Traveling border beam, overlaid on a rounded container
 * (parent must be `relative` with the same border radius).
 * Gradient runs the landing-page particle palette.
 */
export function AnimatedPanelBorder({ radius = 24 }: { radius?: number }) {
  return (
    <div
      className={cn(
        "-inset-px pointer-events-none absolute rounded-[inherit] border-2 border-transparent border-inset [mask-clip:padding-box,border-box]",
        "[mask-composite:intersect] [mask-image:linear-gradient(transparent,transparent),linear-gradient(#000,#000)]"
      )}
    >
      <motion.div
        className={cn(
          "absolute aspect-square bg-[linear-gradient(90deg,transparent,#ff731f,#ff339e,#7361ff)]"
        )}
        animate={{
          offsetDistance: ["0%", "100%"],
        }}
        style={{
          width: 80,
          offsetPath: `rect(0 auto auto 0 round ${radius}px)`,
        }}
        transition={{
          repeat: Number.POSITIVE_INFINITY,
          duration: 5,
          ease: "linear",
        }}
      />
    </div>
  );
}
