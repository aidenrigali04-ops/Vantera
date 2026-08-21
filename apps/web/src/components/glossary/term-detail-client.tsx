"use client";

import { useEffect, useState } from "react";
import { motion, useScroll, useSpring } from "framer-motion";
import { Bookmark, Check, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";

const BOOKMARK_KEY = "vantera:glossary:bookmarks";

/** Thin page-top reading-progress bar driven by scroll position. */
export function ReadingProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.3 });
  return (
    <motion.div
      aria-hidden
      className="fixed inset-x-0 top-0 z-[60] h-[2.5px] origin-left bg-gradient-to-r from-[#2a82f7] via-[#1877f2] to-[#166fe5]"
      style={{ scaleX }}
    />
  );
}

/** Sticky table of contents with scroll-spy highlighting. */
export function TermToc({ sections }: { sections: { id: string; label: string }[] }) {
  const [active, setActive] = useState(sections[0]?.id ?? "");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id);
        }
      },
      { rootMargin: "-40% 0px -55% 0px" },
    );
    for (const s of sections) {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [sections]);

  return (
    <nav aria-label="On this page" className="flex flex-col gap-1">
      <span className="mb-2 font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--ink-4)]">On this page</span>
      {sections.map((s) => (
        <a
          key={s.id}
          href={`#${s.id}`}
          className={cn(
            "border-l-2 py-1 pl-3 text-[13px] transition-colors",
            active === s.id
              ? "border-[var(--fb)] font-semibold text-foreground"
              : "border-[var(--hairline)] text-[var(--ink-4)] hover:text-[var(--ink-2)]",
          )}
        >
          {s.label}
        </a>
      ))}
    </nav>
  );
}

/** Copy-link + bookmark actions for a term (localStorage-backed, shared key with the hub). */
export function TermActions({ term }: { term: string }) {
  const [bookmarked, setBookmarked] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      try {
        const raw = localStorage.getItem(BOOKMARK_KEY);
        const slug = window.location.pathname.split("/").pop() ?? "";
        if (raw) setBookmarked((JSON.parse(raw) as string[]).includes(slug));
      } catch {
        /* ignore */
      }
    });
    return () => cancelAnimationFrame(id);
  }, []);

  function toggleBookmark() {
    try {
      const slug = window.location.pathname.split("/").pop() ?? "";
      const raw = localStorage.getItem(BOOKMARK_KEY);
      const list = raw ? (JSON.parse(raw) as string[]) : [];
      const next = list.includes(slug) ? list.filter((s) => s !== slug) : [...list, slug];
      localStorage.setItem(BOOKMARK_KEY, JSON.stringify(next));
      setBookmarked(next.includes(slug));
    } catch {
      /* ignore */
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={copyLink}
        className="inline-flex items-center gap-1.5 rounded-full border border-[var(--hairline)] bg-white px-3.5 py-2 text-[13px] font-medium text-[var(--ink-2)] shadow-[var(--shadow-sm)] transition-colors hover:border-[var(--cyan-line)]"
      >
        {copied ? <Check className="size-3.5 text-[#1a9e4b]" strokeWidth={2.6} /> : <Link2 className="size-3.5" />}
        {copied ? "Copied" : "Copy link"}
      </button>
      <button
        type="button"
        onClick={toggleBookmark}
        aria-pressed={bookmarked}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] font-medium shadow-[var(--shadow-sm)] transition-colors",
          bookmarked
            ? "border-[var(--cyan-line)] bg-[var(--cyan-tint)] text-[var(--cyan-strong)]"
            : "border-[var(--hairline)] bg-white text-[var(--ink-2)] hover:border-[var(--cyan-line)]",
        )}
      >
        <Bookmark className={cn("size-3.5", bookmarked && "fill-current")} />
        {bookmarked ? "Saved" : "Save"}
      </button>
    </div>
  );
}
