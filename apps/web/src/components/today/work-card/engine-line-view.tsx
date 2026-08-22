"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import type { EngineLine } from "@/lib/today/engine-line";
import { MonoText } from "./mono-text";

const DOT: Record<EngineLine["dot"], string> = {
  running: "bg-[var(--positive)]",
  attention: "bg-[var(--attention)]",
  stopped: "bg-[var(--danger)]",
  paused: "bg-[var(--ink-dim)]",
};

/**
 * The Engine line (blueprint §6.7): the card's footer sentence — a dot, a status word, and
 * the facts that prove the sending layer is behaving (next send, today's usage, the window).
 * The dot pulses ONLY while running; every other state ends in a repair or resume link.
 */
export function EngineLineView({ line, onResume }: { line: EngineLine; onResume?: () => void }) {
  return (
    <p className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[13px] text-[var(--ink-mid)]">
      <span
        aria-hidden="true"
        className={cn("size-2 shrink-0 rounded-full", DOT[line.dot], line.dot === "running" && "engine-pulse")}
      />
      <span className="font-medium text-[var(--ink)]">
        <MonoText text={line.status} />
      </span>
      {line.facts.map((fact, i) => (
        <span key={i} className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="text-[var(--ink-dim)]">·</span>
          <MonoText text={fact} />
        </span>
      ))}
      {line.link ? (
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="text-[var(--ink-dim)]">·</span>
          {line.link.inline === "resume" ? (
            <button
              type="button"
              onClick={onResume}
              className="font-medium text-[var(--acc)] hover:underline focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
            >
              {line.link.label} →
            </button>
          ) : (
            <Link
              href={line.link.href}
              className="font-medium text-[var(--acc)] hover:underline focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
            >
              {line.link.label} →
            </Link>
          )}
        </span>
      ) : null}
    </p>
  );
}
