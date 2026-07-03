import { MapPin } from "lucide-react";

/**
 * Announcement ribbon pinned to the very top of the landing — sits above the standard
 * nav bar and never scrolls (both are fixed). Facebook-blue (--fb-strong holds white
 * text at WCAG AA). Thin, centered, restrained. The live pulse honors reduced motion.
 */
export function LiveBanner() {
  return (
    <div className="fixed inset-x-0 top-0 z-50 flex h-9 items-center justify-center gap-2.5 bg-[var(--fb-strong)] px-4 text-white">
      <span className="relative flex size-2 items-center justify-center" aria-hidden>
        <span className="absolute inline-flex size-full rounded-full bg-white/70 opacity-75 motion-safe:animate-ping" />
        <span className="relative inline-flex size-1.5 rounded-full bg-white" />
      </span>
      <span className="text-[11px] font-semibold uppercase tracking-[0.16em]">Live</span>
      <span className="h-3 w-px bg-white/35" aria-hidden />
      <MapPin className="size-3.5" strokeWidth={2.2} aria-hidden />
      <span className="text-[12.5px] font-medium tracking-[-0.005em]">Event in San Francisco</span>
    </div>
  );
}
