import { Fragment } from "react";
import { cn } from "@/lib/utils";

/**
 * `‹…›` fragments in a Today string (engine facts, tile meta, empty lines) are numbers or
 * times the data layer already formatted — they render in the mono face (blueprint §5.2).
 * `splitMono` is the pure split; `MonoText` is the render. An unmatched `‹` is plain text.
 */

export interface MonoPart {
  text: string;
  mono: boolean;
}

const MONO_RE = /‹([^›]*)›/g;

export function splitMono(text: string): MonoPart[] {
  const parts: MonoPart[] = [];
  let last = 0;
  for (const m of text.matchAll(MONO_RE)) {
    const start = m.index ?? 0;
    if (start > last) parts.push({ text: text.slice(last, start), mono: false });
    if (m[1] && m[1].length > 0) parts.push({ text: m[1], mono: true });
    last = start + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), mono: false });
  return parts;
}

export function MonoText({
  text,
  className,
  monoClassName,
}: {
  text: string;
  className?: string;
  /** extra classes on every mono fragment (e.g. a color) */
  monoClassName?: string;
}) {
  const parts = splitMono(text);
  if (parts.length === 0) return null;
  return (
    <span className={className}>
      {parts.map((p, i) =>
        p.mono ? (
          <span key={i} className={cn("font-mono", monoClassName)}>
            {p.text}
          </span>
        ) : (
          <Fragment key={i}>{p.text}</Fragment>
        ),
      )}
    </span>
  );
}
