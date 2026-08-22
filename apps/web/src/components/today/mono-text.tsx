import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * `‹…›` fragments in Today strings are numbers/times/counts that must read as data — they
 * render in Geist Mono (tabular) while the surrounding prose stays in the sans. The
 * delimiters themselves never reach the DOM.
 */

export interface MonoPart {
  text: string;
  mono: boolean;
}

/**
 * Split a string on `‹` / `›` into plain and mono parts. Lenient: an unterminated `‹`
 * makes the rest of the string mono; a stray `›` outside a mono span is dropped; empty
 * parts are never emitted.
 */
export function splitMono(text: string): MonoPart[] {
  const parts: MonoPart[] = [];
  let mono = false;
  let buf = "";
  const flush = () => {
    if (buf) parts.push({ text: buf, mono });
    buf = "";
  };
  for (const ch of text) {
    if (ch === "‹" && !mono) {
      flush();
      mono = true;
    } else if (ch === "›" && mono) {
      flush();
      mono = false;
    } else if (ch !== "›") {
      buf += ch;
    }
  }
  flush();
  return parts;
}

export function MonoText({
  text,
  className,
  monoClassName,
}: {
  text: string;
  className?: string;
  /** extra classes on each mono fragment (color/weight); `font-mono` is always applied */
  monoClassName?: string;
}): ReactNode {
  const parts = splitMono(text);
  if (parts.length === 0) return null;
  const nodes = parts.map((p, i) =>
    p.mono ? (
      <span key={i} className={cn("font-mono", monoClassName)}>
        {p.text}
      </span>
    ) : (
      p.text
    ),
  );
  return className ? <span className={className}>{nodes}</span> : <>{nodes}</>;
}
