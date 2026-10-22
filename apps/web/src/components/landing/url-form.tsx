"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Globe } from "lucide-react";

/**
 * The website field and the solid "Get Started Free" button, side by side (stacked on
 * phones), after rankbox.xyz's split UrlForm. Submitting carries the site into signup
 * (`/signup?site=`) so onboarding can read it. Shared by the homepage hero and every
 * feature page's hero.
 */
export function UrlForm({ label = "Get Started Free" }: { label?: string }) {
  const router = useRouter();
  const [url, setUrl] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const site = url.trim();
        router.push(site ? `/signup?site=${encodeURIComponent(site)}` : "/signup");
      }}
      className="group flex w-full flex-col gap-2.5 sm:flex-row"
    >
      {/* The .landing autofill override paints inputs white, so the field stays
          opaque white to match. */}
      <label className="flex h-12 min-w-0 cursor-text items-center gap-2.5 rounded-lg border border-[rgba(12,16,26,0.1)] bg-white px-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-[border-color,box-shadow] duration-200 hover:border-[rgba(12,16,26,0.16)] focus-within:border-[var(--cyan-line)] focus-within:shadow-[0_0_0_4px_var(--fb-tint)] sm:flex-1">
        <Globe className="size-4 shrink-0 text-[var(--ink-4)]" strokeWidth={2} />
        <input
          type="text"
          inputMode="url"
          autoComplete="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Your website URL"
          aria-label="Your website URL"
          className="w-full min-w-0 text-ellipsis bg-transparent text-[0.95rem] text-foreground outline-none placeholder:text-[var(--ink-4)]"
        />
      </label>
      <button
        type="submit"
        className="inline-flex h-12 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-[var(--fb-strong)] px-6 text-[0.95rem] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_1px_2px_rgba(16,24,40,0.14)] transition-[background-color,transform] duration-150 hover:bg-[#1161cc] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--fb-tint)] active:scale-[0.985] sm:w-[13.5rem]"
      >
        {label}
        <ArrowRight className="size-4 transition-transform duration-200 group-focus-within:translate-x-0.5 group-hover:translate-x-0.5" />
      </button>
    </form>
  );
}
