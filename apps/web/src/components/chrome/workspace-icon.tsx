"use client";

import { useEffect, useRef, useState } from "react";
import { LayoutGrid } from "lucide-react";

/**
 * The brand mark in the workspace pill. It walks the candidate URLs until one actually
 * decodes, then falls back to the generic glyph.
 *
 * Two failure modes that a plain `onError` misses, and both are the common case:
 *
 *  1. The image is SERVER-rendered, so a broken URL fails while the HTML is parsing —
 *     before React hydrates and attaches the handler. The event is gone by the time the
 *     component is alive, leaving a broken-image box forever. The mount check below reads
 *     `complete && naturalWidth === 0`, which is how you ask "did this already fail?".
 *  2. An SPA host answers a missing `/favicon.ico` with **200 and its index HTML**. The
 *     request succeeds, so nothing 404s — but the bytes aren't an image, so decoding fails
 *     and we advance to the next candidate.
 */
export function WorkspaceIcon({ candidates, className }: { candidates: string[]; className?: string }) {
  const [index, setIndex] = useState(0);
  const ref = useRef<HTMLImageElement>(null);
  const src = candidates[index];

  // Catch a failure that happened before hydration (see 1 above).
  useEffect(() => {
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0) setIndex((i) => i + 1);
  }, [src]);

  if (!src) return <LayoutGrid className="size-4" strokeWidth={1.75} aria-hidden="true" />;

  return (
    // The icon lives on the customer's domain, not ours — a plain <img>, no remote-pattern
    // config, and every failure walks to the next candidate.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      key={src}
      src={src}
      alt=""
      className={className}
      onError={() => setIndex((i) => i + 1)}
    />
  );
}
