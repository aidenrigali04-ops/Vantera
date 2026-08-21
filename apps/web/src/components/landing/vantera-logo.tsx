"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * Vantera brand mark — a rounded diamond (squircle rotated 45°) with a sharp diamond
 * cut out of the center. Recreated as a transparent-cutout SVG so it scales cleanly and
 * sits on any background; `currentColor` drives the fill (white on the dark landing).
 *
 * The mask id MUST be unique per instance (useId): with a shared id, a logo whose
 * sibling instance sits inside a display:none container (the desktop rail below lg)
 * resolves the mask to a hidden element and paints a solid box — the 2026-07-15
 * mobile black-box bug.
 */
export function VanteraLogo({ className }: { className?: string }) {
  const maskId = useId();
  return (
    <svg
      viewBox="0 0 100 100"
      className={cn("size-7", className)}
      role="img"
      aria-label="Vantera"
      fill="none"
    >
      <mask id={maskId}>
        <rect width="100" height="100" fill="black" />
        {/* show the outer body… */}
        <rect x="18" y="18" width="64" height="64" rx="18" transform="rotate(45 50 50)" fill="white" />
        {/* …minus the sharp inner diamond (the cutout) */}
        <rect x="37" y="37" width="26" height="26" transform="rotate(45 50 50)" fill="black" />
      </mask>
      <rect width="100" height="100" fill="currentColor" mask={`url(#${maskId})`} />
    </svg>
  );
}
