import Link from "next/link";
import { ArrowRight } from "lucide-react";

/**
 * Announcement ribbon pinned to the very top of the landing — sits above the standard
 * nav bar and never scrolls (both are fixed). Facebook-blue (--fb-strong holds white
 * text at WCAG AA). Thin, centered, restrained.
 *
 * The top strip is the most-seen row on the page, so it carries an actionable value line
 * (and the whole ribbon is a link into signup) rather than a static event notice a cold
 * visitor can't act on. Every claim is literally true of the product. The pulse honors
 * reduced motion.
 */
export function LiveBanner() {
  return (
    <Link
      href="/signup"
      className="group fixed inset-x-0 top-0 z-50 flex h-9 items-center justify-center gap-2.5 bg-[var(--fb-strong)] px-4 text-white transition-colors hover:bg-[#1461d1]"
    >
      <span className="relative flex size-2 items-center justify-center" aria-hidden>
        <span className="absolute inline-flex size-full rounded-full bg-white/70 opacity-75 motion-safe:animate-ping" />
        <span className="relative inline-flex size-1.5 rounded-full bg-white" />
      </span>
      <span className="text-[12.5px] font-medium tracking-[-0.005em]">
        Your LinkedIn, run hands-off — you approve every message.
      </span>
      <span className="hidden items-center gap-1 text-[12.5px] font-semibold sm:inline-flex">
        Start free
        <ArrowRight
          className="size-3.5 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
          strokeWidth={2.2}
          aria-hidden
        />
      </span>
    </Link>
  );
}
