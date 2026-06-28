import { MapPin } from "lucide-react";

/**
 * Full-bleed announcement ribbon under the floating nav — the hero's old
 * "Live · Event in San Francisco" eyebrow, promoted to a banner. Facebook-blue
 * (--fb-strong keeps white text at WCAG AA) with white text + icons, fixed so it
 * rides beneath the nav as the page scrolls. The live pulse honors reduced motion.
 */
export function LiveBanner() {
  return (
    <div className="fixed inset-x-0 top-[72px] z-40 flex h-9 items-center justify-center gap-3 bg-[var(--fb-strong)] px-4 text-white shadow-[0_10px_30px_-16px_rgba(24,119,242,0.85)]">
      <span className="relative flex size-2 items-center justify-center" aria-hidden>
        <span className="absolute inline-flex size-full rounded-full bg-white/70 opacity-75 motion-safe:animate-ping" />
        <span className="relative inline-flex size-1.5 rounded-full bg-white" />
      </span>
      <span className="text-[11px] font-semibold uppercase tracking-[0.16em]">Live</span>
      <span className="h-3 w-px bg-white/35" aria-hidden />
      <MapPin className="size-3.5" strokeWidth={2.2} aria-hidden />
      <span className="text-[13px] font-medium tracking-[-0.005em]">Event in San Francisco</span>
    </div>
  );
}
