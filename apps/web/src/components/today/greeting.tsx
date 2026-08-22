"use client";

import type { TodayView } from "@/lib/today/rows";
import { cn } from "@/lib/utils";

import { InkButton } from "./buttons";
import { MonoText } from "./mono-text";
import type { GlyphName } from "./glyphs";

/**
 * Z2 · greeting (blueprint §6.3): the H1 ("Morning, Aiden." — the page passes the final
 * string), the one-sentence state of play, and the single ink button centered on the
 * sentence's line box. A faded hairline closes the zone 28px below the sentence.
 * Client component only because the inline resume primary needs `onResume`.
 */

export type PrimaryGlyph = "queue" | "inbox" | "reconnect" | "payment" | "resume";

const PRIMARY_GLYPH: Record<PrimaryGlyph, GlyphName> = {
  queue: "check-square",
  inbox: "message-square",
  reconnect: "unplug",
  payment: "credit-card",
  resume: "play",
};

export interface GreetingProps {
  greeting: string;
  sentence: string;
  primary: TodayView["primary"];
  /** glyph for the primary button — chosen by the page, never inferred from the href */
  glyph?: PrimaryGlyph;
  /** called by the inline `resume` primary */
  onResume?: () => void;
  className?: string;
}

export function Greeting({ greeting, sentence, primary, glyph, onResume, className }: GreetingProps) {
  const glyphName: GlyphName | undefined = glyph ? PRIMARY_GLYPH[glyph] : primary?.inline === "resume" ? "play" : undefined;
  return (
    <section className={cn("relative", className)}>
      <div className="grid grid-cols-1 gap-y-2.5 md:grid-cols-[minmax(0,1fr)_auto] md:gap-x-6">
        <h1 className="text-[32px] font-semibold leading-8 tracking-[-0.02em] text-[var(--ink)] md:col-start-1 md:row-start-1">
          {greeting}
        </h1>
        <p className="max-w-[72ch] text-[15px] leading-[22px] text-[var(--ink-mid)] md:col-start-1 md:row-start-2">{sentence}</p>
        {primary ? (
          // ≥768: a zero-height cell centered on the sentence row, so the 40px button sits
          // centered on the sentence's line box without adding height (the hairline stays
          // exactly 28px below the sentence). <768: its own full-width row below.
          <div className="mt-3.5 md:col-start-2 md:row-start-2 md:mt-0 md:flex md:h-0 md:items-center md:self-center md:justify-self-end">
            {primary.inline === "resume" ? (
              <InkButton onClick={onResume} glyph={glyphName} count={primary.count} className="w-full md:w-auto">
                <MonoText text={primary.label} />
              </InkButton>
            ) : (
              <InkButton href={primary.href} glyph={glyphName} count={primary.count} className="w-full md:w-auto">
                <MonoText text={primary.label} />
              </InkButton>
            )}
          </div>
        ) : null}
      </div>
      <FadedHairline className="mt-7" />
    </section>
  );
}

/** A full-width 1px `--line` rule that fades in over its first 25%. */
export function FadedHairline({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("h-px w-full bg-[var(--line)] [mask-image:linear-gradient(90deg,transparent,#000_25%)]", className)}
    />
  );
}
