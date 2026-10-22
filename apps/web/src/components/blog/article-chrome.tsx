"use client";

import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { Check, ChevronDown, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TocEntry } from "./outline";

/**
 * The interactive parts around an article's text, after rankbox.xyz's: the reading
 * progress line under the nav, the table of contents (a sticky rail on desktop, a
 * collapsible list above the article on mobile), and the share buttons.
 */

/* Clearance for the sticky nav (h-16) plus breathing room, used both for scroll-spy and
   for jumping to a heading. Matches scroll-mt-28 on the headings. */
const HEADING_OFFSET = 112;

/* ---------- reading progress ---------- */

/** A thin blue line under the nav that fills as the article body is read. */
export function ReadingProgress({ targetId }: { targetId: string }) {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const el = document.getElementById(targetId);
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const total = rect.height - window.innerHeight + HEADING_OFFSET;
      const read = HEADING_OFFSET - rect.top;
      setProgress(total > 0 ? Math.min(1, Math.max(0, read / total)) : 0);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [targetId]);
  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-16 z-40 h-[3px]">
      <div
        className="h-full origin-left bg-[var(--fb)] transition-transform duration-150 ease-out motion-reduce:transition-none"
        style={{ transform: `scaleX(${progress})` }}
      />
    </div>
  );
}

/* ---------- table of contents ---------- */

/** The last heading whose top has passed under the nav. */
function useActiveHeading(ids: string[]): string | null {
  const [active, setActive] = useState<string | null>(ids[0] ?? null);
  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      let current = ids[0] ?? null;
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= HEADING_OFFSET + 8) current = id;
      }
      setActive(current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
    };
  }, [ids]);
  return active;
}

function jumpTo(e: MouseEvent<HTMLAnchorElement>, id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  e.preventDefault();
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({
    top: el.getBoundingClientRect().top + window.scrollY - HEADING_OFFSET + 4,
    behavior: reduce ? "auto" : "smooth",
  });
  history.replaceState(null, "", `#${id}`);
}

export function TableOfContents({
  entries,
  variant,
  className,
}: {
  entries: TocEntry[];
  variant: "rail" | "inline";
  className?: string;
}) {
  const key = entries.map((e) => e.id).join("|");
  const ids = useMemo(() => (key ? key.split("|") : []), [key]);
  const active = useActiveHeading(ids);
  if (entries.length < 2) return null;

  const list = (
    <ol className="border-l border-[rgba(12,16,26,0.08)]">
      {entries.map((entry) => {
        const on = variant === "rail" && active === entry.id;
        return (
          <li key={entry.id}>
            <a
              href={`#${entry.id}`}
              onClick={(e) => jumpTo(e, entry.id)}
              aria-current={on ? "location" : undefined}
              className={cn(
                "-ml-px block border-l-2 py-[0.3rem] pl-4 text-[0.82rem] leading-snug transition-colors",
                on
                  ? "border-[var(--fb-strong)] font-medium text-[var(--fb-strong)]"
                  : "border-transparent text-[var(--ink-3)] hover:border-[rgba(12,16,26,0.2)] hover:text-foreground",
              )}
            >
              {entry.text}
            </a>
          </li>
        );
      })}
    </ol>
  );

  if (variant === "inline") {
    return (
      <details
        className={cn("group rounded-xl border border-[rgba(12,16,26,0.08)] bg-white", className)}
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-sm font-semibold text-foreground [&::-webkit-details-marker]:hidden">
          <span>
            On this page
            <span className="ml-2 font-medium text-[var(--ink-3)]">{entries.length} sections</span>
          </span>
          <ChevronDown className="size-4 text-[var(--ink-3)] transition-transform group-open:rotate-180" />
        </summary>
        <div className="px-5 pb-5">{list}</div>
      </details>
    );
  }

  return (
    <nav aria-label="On this page" className={className}>
      <p className="mb-3 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[var(--ink-3)]">
        On this page
      </p>
      {list}
    </nav>
  );
}

/* ---------- sharing ---------- */

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 1 1 0-4.125 2.062 2.062 0 0 1 0 4.125zM7.119 20.452H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

const SHARE_BUTTON =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-full border border-[rgba(12,16,26,0.1)] bg-white px-3 text-xs font-semibold text-foreground shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-all hover:-translate-y-0.5 hover:border-[rgba(12,16,26,0.2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(24,119,242,0.4)] motion-reduce:transition-none motion-reduce:hover:translate-y-0";

export function ShareButtons({
  url,
  title,
  className,
}: {
  url: string;
  title: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable: the button simply doesn't confirm */
    }
  };
  const enc = encodeURIComponent;
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <a
        href={`https://twitter.com/intent/tweet?text=${enc(title)}&url=${enc(url)}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Share on X"
        className={cn(SHARE_BUTTON, "w-9 px-0")}
      >
        <XIcon className="size-3.5" />
      </a>
      <a
        href={`https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Share on LinkedIn"
        className={cn(SHARE_BUTTON, "w-9 px-0")}
      >
        <LinkedInIcon className="size-3.5" />
      </a>
      <button type="button" onClick={copy} className={SHARE_BUTTON}>
        {copied ? (
          <Check className="size-3.5 text-[#13824a]" />
        ) : (
          <Link2 className="size-3.5" />
        )}
        <span aria-live="polite">{copied ? "Copied" : "Copy link"}</span>
      </button>
    </div>
  );
}
