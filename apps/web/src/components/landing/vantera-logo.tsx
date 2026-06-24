import { cn } from "@/lib/utils";

/**
 * Vantera brand mark — a rounded diamond (squircle rotated 45°) with a sharp diamond
 * cut out of the center. Recreated as a transparent-cutout SVG so it scales cleanly and
 * sits on any background; `currentColor` drives the fill (white on the dark landing).
 * Swap for an exact asset by dropping a file in /public and pointing an <Image> at it.
 */
export function VanteraLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={cn("size-7", className)}
      role="img"
      aria-label="Vantera"
      fill="none"
    >
      <mask id="vantera-cut">
        <rect width="100" height="100" fill="black" />
        {/* show the outer body… */}
        <rect x="18" y="18" width="64" height="64" rx="18" transform="rotate(45 50 50)" fill="white" />
        {/* …minus the sharp inner diamond (the cutout) */}
        <rect x="37" y="37" width="26" height="26" transform="rotate(45 50 50)" fill="black" />
      </mask>
      <rect width="100" height="100" fill="currentColor" mask="url(#vantera-cut)" />
    </svg>
  );
}
