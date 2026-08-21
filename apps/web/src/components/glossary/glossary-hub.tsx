"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { GlossaryTerm } from "@/lib/glossary";
import { BookmarksProvider } from "./glossary-ui";
import { GlossaryHero } from "./glossary-hero";
import { GlossaryDirectory } from "./glossary-directory";
import { CommandPalette } from "./command-palette";

/**
 * Client orchestrator for the glossary hub — owns the ⌘K palette state and the shared
 * bookmarks context, and wires the hero, directory, and command palette together. Data
 * arrives as plain props from the server page (SSR-friendly, fully static).
 */
export function GlossaryHub({
  terms,
  trending,
  recent,
  popular,
  stats,
}: {
  terms: GlossaryTerm[];
  trending: GlossaryTerm[];
  recent: GlossaryTerm[];
  popular: string[];
  stats: { terms: number; categories: number };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [prefill, setPrefill] = useState("");

  const openSearch = useCallback((query = "") => {
    setPrefill(query);
    setOpen(true);
  }, []);

  // Global ⌘K / Ctrl-K to open search.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPrefill("");
        setOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <BookmarksProvider>
      <GlossaryHero onOpenSearch={openSearch} stats={stats} popular={popular} trending={trending} />
      <GlossaryDirectory terms={terms} trending={trending} recent={recent} onOpenSearch={openSearch} />
      <CommandPalette
        open={open}
        initialQuery={prefill}
        terms={terms}
        onClose={() => setOpen(false)}
        onNavigate={(slug) => {
          setOpen(false);
          router.push(`/glossary/${slug}`);
        }}
      />
    </BookmarksProvider>
  );
}
