/**
 * `PixelField` — a sparse field of white "data pixels" fading in and out, for the
 * blue bands only (the auth and onboarding rails). The squares blink on the shared
 * `.landing .hero-pixel` keyframes in globals.css.
 *
 * (This file once held the old landing's section devices — numbered intros, the blue
 * highlight box, the glow pool. The rankbox-layout restyle replaced them with
 * frame.tsx, so only PixelField remains.)
 */

/* Sparse deterministic pixel set for blue bands (reuses the hero-pixel keyframes). */
const PIXELS: { x: number; y: number; s: number; dur: number; delay: number; max: number }[] = [
  { x: 5, y: 18, s: 12, dur: 4.6, delay: 0.4, max: 0.14 },
  { x: 13, y: 72, s: 15, dur: 5.4, delay: 1.8, max: 0.12 },
  { x: 30, y: 30, s: 11, dur: 3.8, delay: 2.6, max: 0.1 },
  { x: 55, y: 82, s: 13, dur: 4.2, delay: 0.9, max: 0.12 },
  { x: 71, y: 14, s: 12, dur: 5.0, delay: 2.1, max: 0.14 },
  { x: 87, y: 58, s: 16, dur: 4.4, delay: 1.2, max: 0.12 },
  { x: 95, y: 24, s: 11, dur: 3.6, delay: 3.0, max: 0.1 },
  { x: 44, y: 10, s: 13, dur: 5.8, delay: 0.2, max: 0.1 },
];

export function PixelField() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
      {PIXELS.map((p, i) => (
        <span
          key={i}
          className="hero-pixel absolute rounded-[3px] bg-white"
          style={
            {
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: p.s,
              height: p.s,
              "--pixel-max": p.max,
              "--pixel-dur": `${p.dur}s`,
              "--pixel-delay": `${p.delay}s`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
