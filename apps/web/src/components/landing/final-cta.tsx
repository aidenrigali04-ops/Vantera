"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Band } from "./frame";
import { Reveal, RevealItem } from "./surface";
import { MarkDither } from "./hero-dither";
import { VanteraLogo } from "./vantera-logo";

/**
 * The landing page's last band, after rankbox.xyz's closing CTA (itself after
 * Rankaria's): a blue block inside the rails, the promise in white, one button, and the
 * Vantera inbox rising from the band's lower edge, cropped by it. The hero's dithered
 * mark returns here in white, so the page opens and closes on the same motif.
 *
 * The blue (#1468da, the footer's too) is a step deeper than the brand's #1877f2:
 * white body text on #1877f2 tops out at 4.2:1, and #1468da carries the white/90
 * subtitle at AA (4.5:1). The footer's `framed` closing band (footer.tsx) follows, so
 * this block and the blue footer read as two things rather than one long field.
 */

/* The prospect's reply, typed out once the window is on screen. The middle run is
   the part that lands, underlined the way rankbox underlines a cited brand. */
const REPLY: { text: string; mark?: boolean }[] = [
  { text: "Yes — " },
  { text: "this is exactly what we’re fixing", mark: true },
  { text: ". Free Thursday?" },
];
const REPLY_LENGTH = REPLY.reduce((n, part) => n + part.text.length, 0);
/* Where each part starts in the reply. */
const REPLY_STARTS = REPLY.map((_, i) =>
  REPLY.slice(0, i).reduce((n, part) => n + part.text.length, 0),
);
const TYPE_MS = 34;

const TABS = ["Rachel", "Marcus", "Aisha", "Luis", "Priya"];

/** The reply with only its first `count` characters showing. */
function TypedReply({ count }: { count: number }) {
  return (
    <>
      {REPLY.map((part, i) => {
        const shown = part.text.slice(0, Math.max(0, count - REPLY_STARTS[i]));
        if (!shown) return null;
        return part.mark ? (
          <span
            key={part.text}
            className="font-semibold underline decoration-[var(--fb)] decoration-2 underline-offset-2"
          >
            {shown}
          </span>
        ) : (
          <span key={part.text}>{shown}</span>
        );
      })}
    </>
  );
}

/**
 * The inbox window: chrome, a tab per conversation, then the agent's opener and the
 * prospect's reply arriving. Decorative (aria-hidden), sample data.
 *
 * The server renders the whole reply, so there is never an empty window without JS.
 * Once mounted, a window still off screen is cleared and types itself out when it
 * scrolls in; one already on screen (a reload near the foot of the page) is left
 * whole. Reduced motion leaves it whole and drops the caret.
 */
function InboxWindow() {
  const ref = useRef<HTMLDivElement>(null);
  const [typed, setTyped] = useState(REPLY_LENGTH);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let timer = 0;
    let first = true;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (first) {
          first = false;
          if (entry.isIntersecting) {
            observer.disconnect();
            return;
          }
          setTyped(0);
          return;
        }
        if (!entry.isIntersecting) return;
        observer.disconnect();
        let n = 0;
        // A beat after the window has risen into place.
        timer = window.setTimeout(function tick() {
          n += 1;
          setTyped(n);
          if (n < REPLY_LENGTH) timer = window.setTimeout(tick, TYPE_MS);
        }, 600);
      },
      { rootMargin: "0px 0px -60px 0px" },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      className="flex flex-col overflow-hidden rounded-xl rounded-b-none border border-[rgba(12,16,26,0.08)] bg-white text-left shadow-[0_-12px_48px_-16px_rgba(4,24,72,0.55)] ring-1 ring-[rgba(12,16,26,0.05)]"
    >
      {/* Window chrome — the title is absolutely centred so it stays centred
          regardless of what sits beside it. */}
      <div className="relative flex items-center gap-2 border-b border-[rgba(12,16,26,0.08)] bg-[var(--tint)]/70 px-4 py-2.5">
        <span className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <span key={i} className="size-2.5 rounded-full bg-[#e1e4ea]" />
          ))}
        </span>
        <span className="absolute left-1/2 flex -translate-x-1/2 items-center gap-1.5 text-[0.7rem] font-medium text-[var(--ink-3)]">
          <VanteraLogo className="size-3.5 text-[var(--fb)]" />
          Inbox
        </span>
      </div>

      {/* One tab per conversation; the open one lifts. */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-[rgba(12,16,26,0.08)] bg-[var(--tint)]/70 px-2.5 py-2">
        {TABS.map((name, i) => (
          <span
            key={name}
            className={
              i === 0
                ? "flex shrink-0 -translate-y-px items-center gap-1.5 rounded-md bg-white px-2.5 py-1 text-xs font-medium text-foreground shadow-sm ring-1 ring-[rgba(12,16,26,0.08)]"
                : "flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-[var(--ink-3)]/70"
            }
          >
            <span className="grid size-3.5 place-items-center rounded-full bg-[#0a66c2] text-[0.5rem] font-bold leading-none text-white">
              {name[0]}
            </span>
            <span className="hidden sm:inline">{name}</span>
          </span>
        ))}
      </div>

      <div className="flex flex-col gap-4 p-5 sm:p-6">
        {/* The agent's opener, sent from your account. */}
        <div className="flex justify-end">
          <div className="max-w-[88%] rounded-lg rounded-br-sm bg-foreground px-4 py-2.5 text-sm leading-relaxed text-white">
            Your post on rebuilding pipeline after the reorg stuck with me. Worth comparing notes?
          </div>
        </div>

        <div className="flex gap-3">
          <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-[#0a66c2] text-[0.6rem] font-semibold text-white">
            RN
          </span>
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex items-center gap-2 text-[0.7rem] font-medium text-[var(--ink-3)]">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-[var(--fb)]/70 motion-reduce:animate-none" />
                <span className="relative inline-flex size-1.5 rounded-full bg-[var(--fb)]" />
              </span>
              Replied 2m ago · agent answering
            </div>
            <p className="text-[0.95rem] leading-relaxed text-foreground">
              <TypedReply count={typed} />
              <span className="ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[0.18em] animate-pulse rounded-full bg-[var(--fb)] align-middle motion-reduce:hidden" />
            </p>
            {/* The agent's answer, being written. */}
            <div className="h-2.5 w-2/5 rounded-full bg-[linear-gradient(90deg,#eef1f6,#e2e7ef,#eef1f6)]" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function FinalCta() {
  return (
    <section aria-labelledby="final-cta-title">
      <Band inner="overflow-hidden bg-[#1468da]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.16] [mask-image:radial-gradient(ellipse_70%_80%_at_50%_45%,#000_40%,transparent_100%)]"
        >
          <MarkDither className="text-white" />
        </div>

        <Reveal className="relative px-5 pt-16 text-center sm:px-8 sm:pt-20">
          <RevealItem>
            <h2
              id="final-cta-title"
              className="mx-auto max-w-2xl text-balance text-[2rem] font-medium leading-[1.1] tracking-[-0.03em] text-white sm:text-[2.75rem]"
            >
              <span className="sm:block">See who&rsquo;s waiting</span> in your pipeline
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-balance text-[1rem] leading-relaxed text-white/90 sm:text-[1.05rem]">
              Put LinkedIn outreach on autopilot. Agents find in-market buyers, write every first
              message, and book the meetings, while machine learning sharpens who they target.
            </p>
            <Link
              href="/signup"
              className="group mt-8 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-white px-5 text-[0.95rem] font-semibold text-[var(--fb-strong)] shadow-[0_1px_2px_rgba(4,24,72,0.2),0_8px_24px_-12px_rgba(4,24,72,0.5)] transition-[transform,background-color] duration-200 hover:-translate-y-0.5 hover:bg-white/95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/40 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
            >
              Start free
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </RevealItem>

          {/* The window rises from the band's foot and is cut off by it. */}
          <RevealItem className="mx-auto mt-12 h-[13.5rem] max-w-xl overflow-hidden sm:mt-14 sm:h-[15.5rem]">
            <InboxWindow />
          </RevealItem>
        </Reveal>
      </Band>
    </section>
  );
}
