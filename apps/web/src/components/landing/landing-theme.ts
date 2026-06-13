/**
 * Landing accent constants.
 *
 * TEMPORARILY NEUTRALIZED (2026-06-13): the warm brand sweep is parked — the
 * landing page is strict monochrome (white-on-near-black) for now. These names
 * are kept so consumers compile unchanged; every value resolves to white/grey,
 * so dots, glows, bars, and gradient-text read as tasteful monochrome. Restore
 * the warm palette here (#FFCC1A → #FF730D → #EB291C) to bring branding back.
 */
export const WARM = {
  c1: "#ffffff",
  c2: "#ffffff",
  c3: "#ffffff",
} as const;

/** Subtle monochrome sweep for decorative fills/clipped-text (buttons use solid tokens). */
export const WARM_GRADIENT = "linear-gradient(135deg, #ffffff, #d4d4d4)";

/** Retained for API compatibility; the traveling gradient border is no longer used. */
export const WARM_BEAM = "linear-gradient(90deg,transparent,#ffffff,#d4d4d4)";
