"use client";

import Link from "next/link";

/**
 * Hero CTAs. "Simulate agents" does NOT run anything — it smooth-scrolls down to
 * the simulation section, where the visitor types a target audience to activate
 * the run themselves.
 */
export function HeroCtas() {
  const scrollToSimulate = () => {
    document.getElementById("simulate")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <Link
        href="/signup"
        className="rounded-[18px] bg-foreground px-6 py-2.5 text-[17.5px] font-medium text-background transition-opacity hover:opacity-90"
      >
        Get started
      </Link>
      <button
        type="button"
        onClick={scrollToSimulate}
        className="rounded-[18px] border border-white/15 bg-white/5 px-6 py-2.5 text-[17.5px] font-medium text-foreground transition-colors hover:bg-white/10"
      >
        Simulate agents
      </button>
    </div>
  );
}
