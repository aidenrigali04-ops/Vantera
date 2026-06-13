"use client";

import { motion, useReducedMotion } from "framer-motion";
import { WARM } from "./landing-theme";

/**
 * Atmospheric backdrop for the dark landing page: a faint grid, a top vignette,
 * and two slowly drifting warm glow orbs (the brand sweep) for weightless depth.
 * Purely decorative; drift is disabled under reduced-motion.
 */
export function GlowBackdrop() {
  const reduce = useReducedMotion();

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      {/* Hairline grid */}
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.6) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage: "radial-gradient(ellipse 80% 60% at 50% 0%, #000 30%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse 80% 60% at 50% 0%, #000 30%, transparent 75%)",
        }}
      />

      {/* Warm glow orbs */}
      <motion.div
        className="absolute -top-40 left-1/2 size-[42rem] -translate-x-1/2 rounded-full blur-[120px]"
        style={{ background: `radial-gradient(circle, ${WARM.c2}22, transparent 65%)` }}
        animate={reduce ? undefined : { x: [-40, 40, -40], opacity: [0.7, 1, 0.7] }}
        transition={{ repeat: Infinity, duration: 18, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute top-[28rem] -left-32 size-[30rem] rounded-full blur-[120px]"
        style={{ background: `radial-gradient(circle, ${WARM.c1}18, transparent 65%)` }}
        animate={reduce ? undefined : { y: [0, 60, 0], opacity: [0.5, 0.85, 0.5] }}
        transition={{ repeat: Infinity, duration: 22, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute top-[20rem] -right-32 size-[26rem] rounded-full blur-[120px]"
        style={{ background: `radial-gradient(circle, ${WARM.c3}14, transparent 65%)` }}
        animate={reduce ? undefined : { y: [0, -50, 0], opacity: [0.4, 0.7, 0.4] }}
        transition={{ repeat: Infinity, duration: 20, ease: "easeInOut" }}
      />
    </div>
  );
}
