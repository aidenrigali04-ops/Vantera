"use client";

/* Laurel geometry — computed, not eyeballed. Leaves ride a semicircular stem in
   PAIRS (one each side, angled ~38° toward the tip, shrinking as they climb): the
   feathered look of a classic award laurel. Pure math, so SSR and client render the
   identical branch. Stem circle: center (19,22), r15; θ=90° is the bottom (base),
   θ=-90° the top (tip). */
const LAUREL_LEAVES = (() => {
  const P = (deg: number) => {
    const t = (deg * Math.PI) / 180;
    return { x: 19 - 15 * Math.cos(t), y: 22 + 15 * Math.sin(t) };
  };
  const leaves: { x: number; y: number; rot: number; s: number }[] = [];
  [75, 50, 25, 0, -25, -50, -75].forEach((deg, i) => {
    const p = P(deg);
    const q = P(deg - 6); // a step toward the tip
    const growth = (Math.atan2(q.y - p.y, q.x - p.x) * 180) / Math.PI;
    const s = 1 - i * 0.045;
    leaves.push({ x: p.x, y: p.y, rot: growth - 38, s });
    leaves.push({ x: p.x, y: p.y, rot: growth + 38, s });
  });
  const tip = P(-88);
  const pre = P(-80);
  leaves.push({
    x: tip.x,
    y: tip.y,
    rot: (Math.atan2(tip.y - pre.y, tip.x - pre.x) * 180) / Math.PI,
    s: 0.7,
  });
  return leaves;
})();

/** One branch (left half of the ring); mirrored with scaleX(-1) for the right. */
export function Laurel({ className, flip = false }: { className?: string; flip?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 44"
      aria-hidden
      className={className}
      style={flip ? { transform: "scaleX(-1)" } : undefined}
    >
      <path
        d="M19 7 A15 15 0 0 0 19 37"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
      <g fill="currentColor">
        {LAUREL_LEAVES.map((l, i) => (
          <path
            key={i}
            d="M0 0Q2.6 -1.5 5.4 0Q2.6 1.5 0 0"
            transform={`translate(${l.x.toFixed(2)} ${l.y.toFixed(2)}) rotate(${l.rot.toFixed(1)}) scale(${l.s.toFixed(2)})`}
          />
        ))}
      </g>
    </svg>
  );
}
