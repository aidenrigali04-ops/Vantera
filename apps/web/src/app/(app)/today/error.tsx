"use client";

import { useEffect } from "react";

/**
 * Today's error boundary (blueprint §8 "Error"): only the two fatal reads (senders, the
 * drafts count) land here. The engine itself is unaffected — say so, offer a retry, nothing
 * else. Everything non-fatal degrades to an empty line inside the page instead.
 */
export default function TodayError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("today: render failed", error);
  }, [error]);

  return (
    <div className="mx-auto w-full max-w-[1200px] px-6 pt-[72px]">
      <h1 className="text-[32px] font-semibold leading-[1.15] tracking-[-0.02em] text-[var(--ink)]">Today couldn&rsquo;t load.</h1>
      <p className="mt-2.5 max-w-[72ch] text-[15px] leading-[1.5] text-[var(--ink-mid)]">Your engine is unaffected.</p>
      <button
        type="button"
        onClick={reset}
        className="mt-7 inline-flex h-10 items-center rounded-[var(--r-btn)] bg-[var(--ink)] px-4 text-[14px] font-medium text-[var(--ink-fg)] transition-colors hover:bg-[#1f1f23] focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
      >
        Retry
      </button>
    </div>
  );
}
