/**
 * The auth hero — a self-contained cinematic "Intent → Close" product animation
 * (Vantera's value loop on premium glass UI cards), served as a static, fully
 * isolated document at `/auth-panel.html` and embedded via an iframe. The panel
 * self-centers on its own dark studio stage at `min(94vh, 860px)`, so the column
 * is full-bleed dark with the glowing panel centered — no extra framing needed.
 */
export function PipelineShowcase() {
  return (
    <iframe
      src="/auth-panel.html"
      title="Vantera — from intent to closed-won"
      aria-label="Animated demo of the Vantera pipeline: tracking LinkedIn intent, qualifying, personalizing outreach, and closing."
      scrolling="no"
      tabIndex={-1}
      className="block h-full w-full border-0"
      style={{ colorScheme: "normal" }}
    />
  );
}
