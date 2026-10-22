import { useSyncExternalStore } from "react";

/* A hydration-safe stand-in for framer-motion's useReducedMotion. Framer's hook reads
   the media query during the client's first render but returns null on the server, so a
   visitor who prefers reduced motion gets a first client render that differs from the
   server HTML and hydration fails. useSyncExternalStore hydrates with the server
   snapshot (false, matching the HTML) and then re-renders with the real preference. */

const QUERY = "(prefers-reduced-motion: reduce)";

export function subscribe(onChange: () => void): () => void {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

export const getSnapshot = (): boolean => window.matchMedia(QUERY).matches;

export const getServerSnapshot = (): boolean => false;

/** True when the visitor prefers reduced motion; false on the server and during hydration. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
