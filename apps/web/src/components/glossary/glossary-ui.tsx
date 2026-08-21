"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { LineChart, Search, Send, Sparkles, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CategoryKey, Difficulty } from "@/lib/glossary";

/** LinkedIn brand glyph — lucide dropped brand icons, so we inline it (repo convention). */
export function LinkedinGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.34V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0z" />
    </svg>
  );
}

/** Per-category glyph — icon-only differentiation keeps the palette to the one blue accent. */
export function CategoryIcon({ category, className }: { category: CategoryKey; className?: string }) {
  switch (category) {
    case "linkedin":
      return <LinkedinGlyph className={className} />;
    case "sales":
      return <Target className={className} />;
    case "cold-outreach":
      return <Send className={className} />;
    case "seo":
      return <Search className={className} />;
    case "ai-search":
      return <Sparkles className={className} />;
    case "digital-marketing":
      return <LineChart className={className} />;
  }
}

/** Small category chip in the reserved blue system. */
export function CategoryBadge({ label, className }: { label: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-[var(--cyan-tint)] px-2.5 py-1 text-[11px] font-semibold text-[var(--cyan-strong)] ring-1 ring-inset ring-[var(--cyan-line)]",
        className,
      )}
    >
      {label}
    </span>
  );
}

/** Difficulty as a calm easy→advanced ramp: green → blue → slate (never a rainbow). */
const DIFFICULTY_STYLE: Record<Difficulty, string> = {
  Beginner: "bg-[#eafaf0] text-[#1a9e4b] ring-[rgba(26,158,75,0.16)]",
  Intermediate: "bg-[var(--fb-tint)] text-[var(--cyan-strong)] ring-[var(--cyan-line)]",
  Advanced: "bg-[rgba(12,16,26,0.05)] text-[var(--ink-2)] ring-[var(--hairline)]",
};

export function DifficultyBadge({ difficulty, className }: { difficulty: Difficulty; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ring-1 ring-inset",
        DIFFICULTY_STYLE[difficulty],
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current opacity-70" />
      {difficulty}
    </span>
  );
}

/** Highlights the matched query substring in a label (case-insensitive, first match). */
export function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q) return <>{text}</>;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded-[3px] bg-[var(--fb-tint)] px-0.5 text-[var(--cyan-strong)]">
        {text.slice(i, i + q.length)}
      </mark>
      {text.slice(i + q.length)}
    </>
  );
}

/** "Jun 2026"-style compact date for cards. */
export function formatUpdated(iso: string): string {
  const [y, m] = iso.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[Number(m) - 1] ?? ""} ${y}`;
}

/* ── Bookmarks (localStorage-backed, shared across cards + sidebar) ──────────── */
const STORAGE_KEY = "vantera:glossary:bookmarks";

type BookmarksCtx = {
  bookmarks: string[];
  isBookmarked: (slug: string) => boolean;
  toggle: (slug: string) => void;
  ready: boolean;
};

const Ctx = createContext<BookmarksCtx | null>(null);

export function BookmarksProvider({ children }: { children: React.ReactNode }) {
  const [bookmarks, setBookmarks] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Defer the external-store read so we never setState synchronously in the effect body.
    const id = requestAnimationFrame(() => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) setBookmarks(JSON.parse(raw) as string[]);
      } catch {
        /* ignore malformed storage */
      }
      setReady(true);
    });
    return () => cancelAnimationFrame(id);
  }, []);

  const toggle = useCallback((slug: string) => {
    setBookmarks((prev) => {
      const next = prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug];
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore quota errors */
      }
      return next;
    });
  }, []);

  const value = useMemo<BookmarksCtx>(
    () => ({ bookmarks, isBookmarked: (s) => bookmarks.includes(s), toggle, ready }),
    [bookmarks, toggle, ready],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useBookmarks(): BookmarksCtx {
  return (
    useContext(Ctx) ?? {
      bookmarks: [],
      isBookmarked: () => false,
      toggle: () => {},
      ready: false,
    }
  );
}
