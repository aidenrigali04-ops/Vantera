"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** The collapsible peek `Section` and its persisted open/closed store. */

// ── Persisted open/closed state ──────────────────────────────────────────────
// Same pattern as the Prospects density toggle: localStorage read through useSyncExternalStore.
// The snapshot is the raw string (stable by value), parsed in render; the server snapshot is ""
// so SSR/hydration always render the defaults. When storage is unavailable (private mode, blocked
// site data) the toggles live in `memorySections` for the session so sections still open/close.
const SECTIONS_KEY = "vantera:peek:sections";
let memorySections: string | null = null;
let sectionListeners: Array<() => void> = [];
function subscribeSections(cb: () => void): () => void {
  sectionListeners.push(cb);
  window.addEventListener("storage", cb);
  return () => {
    sectionListeners = sectionListeners.filter((l) => l !== cb);
    window.removeEventListener("storage", cb);
  };
}
function readSectionsRaw(): string {
  if (memorySections !== null) return memorySections;
  try {
    return window.localStorage.getItem(SECTIONS_KEY) ?? "";
  } catch {
    return "";
  }
}
function parseSections(raw: string): Record<string, boolean> {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw) as unknown;
    return v && typeof v === "object" ? (v as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}
export function writeSection(id: string, open: boolean) {
  const next = JSON.stringify({ ...parseSections(readSectionsRaw()), [id]: open });
  try {
    window.localStorage.setItem(SECTIONS_KEY, next);
  } catch {
    memorySections = next; // storage blocked — keep toggling in memory
  }
  for (const l of sectionListeners) l();
}
/** Test seam: the current persisted map (storage, or the in-memory fallback). */
export function readSections(): Record<string, boolean> {
  return parseSections(readSectionsRaw());
}

export type PeekSectionId =
  | "signals"
  | "rank"
  | "prospect"
  | "company"
  | "message"
  | "fit"
  | "crm"
  | "notes";

/** One collapsible peek section. `focus` forces it open (and scrolls to it) on first render —
 *  the `+N` chip and `initialSection` use it; a manual toggle hands control back to the store. */
export function Section({
  id,
  title,
  defaultOpen = true,
  focus = false,
  aside,
  children,
}: {
  id: PeekSectionId;
  title: string;
  defaultOpen?: boolean;
  focus?: boolean;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  const raw = useSyncExternalStore(subscribeSections, readSectionsRaw, () => "");
  const stored = parseSections(raw)[id];
  const [forced, setForced] = useState(focus);
  const open = forced || (stored ?? defaultOpen);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (focus) ref.current?.scrollIntoView({ block: "start" });
  }, [focus]);

  const bodyId = `peek-section-${id}`;
  return (
    <section ref={ref} className="border-t border-[var(--line)] pt-4 first:border-t-0 first:pt-0">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => {
            setForced(false);
            writeSection(id, !open);
          }}
          aria-expanded={open}
          aria-controls={bodyId}
          className="group inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--ink-mid)] transition-colors hover:text-foreground"
        >
          <ChevronDown
            className={cn("size-3.5 transition-transform", !open && "-rotate-90")}
            aria-hidden
          />
          {title}
        </button>
        {aside}
      </div>
      {open && (
        <div id={bodyId} className="mt-3">
          {children}
        </div>
      )}
    </section>
  );
}
