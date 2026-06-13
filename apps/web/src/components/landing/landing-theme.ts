/**
 * Marketing-page accent constants. The landing page keeps the locked monochrome
 * base from `globals.css` and layers the brand's warm "particle" sweep
 * (yellow → orange → red) as the single sharp accent — same palette the
 * `DottedSurface` and `AnimatedPanelBorder` use, so the page reads as one system.
 */
export const WARM = {
  c1: "#FFCC1A",
  c2: "#FF730D",
  c3: "#EB291C",
} as const;

/** Solid left-to-right sweep for fills, text clips, and small accents. */
export const WARM_GRADIENT = `linear-gradient(90deg, ${WARM.c1}, ${WARM.c2}, ${WARM.c3})`;

/** Traveling-beam gradient for `AnimatedPanelBorder` (leads with a transparent head). */
export const WARM_BEAM = `linear-gradient(90deg,transparent,${WARM.c1},${WARM.c2},${WARM.c3})`;
