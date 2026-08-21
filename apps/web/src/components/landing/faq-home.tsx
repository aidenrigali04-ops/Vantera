"use client";

import Link from "next/link";
import { ArrowRight, ChevronDown } from "lucide-react";
import { Reveal, RevealItem } from "./surface";
import { SectionIntro } from "./section-intro";
import { FAQ_ITEMS } from "./faq-data";

/**
 * S9 · FAQ on the homepage — "What's the catch?" plus the long tail for search and AI
 * answer engines. Renders the SAME FAQ_ITEMS the /faq page and the FAQPage JSON-LD use
 * (they must stay identical — see faq-data.ts). Native <details>/<summary>: content is
 * in the DOM for crawlers, zero JS state, keyboard-accessible for free.
 */
export function FaqHome() {
  return (
    <section id="faq" className="relative border-t border-[var(--hairline)] bg-white py-24 sm:py-28">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.6fr] lg:gap-20">
          {/* LEFT — sticky intro */}
          <div className="lg:sticky lg:top-32 lg:self-start">
            <SectionIntro
              label="FAQ"
              title="Questions people ask before they connect."
              lead="Safety first, then everything else — the same answers our team gives one-to-one."
            />
            <Link
              href="/faq"
              className="group mt-7 inline-flex items-center gap-1.5 text-[14px] font-semibold text-[var(--cyan-strong)]"
            >
              All questions
              <ArrowRight
                className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5"
                strokeWidth={2.4}
              />
            </Link>
          </div>

          {/* RIGHT — the answers (native details: crawlable, keyboard-free) */}
          <Reveal className="-mt-2">
            {FAQ_ITEMS.map((item, i) => (
              <RevealItem key={item.q}>
                <details id={`faq-${i + 1}`} className="group border-b border-[var(--hairline)]">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-[16px] font-medium text-foreground transition-colors hover:text-[var(--cyan-strong)] [&::-webkit-details-marker]:hidden">
                    {item.q}
                    <span className="grid size-7 shrink-0 place-items-center rounded-full border border-[var(--hairline)] bg-white text-[var(--ink-4)] transition-all duration-200 group-open:rotate-180 group-open:border-[var(--cyan-line)] group-open:text-[var(--cyan-strong)]">
                      <ChevronDown className="size-3.5" strokeWidth={2.2} aria-hidden />
                    </span>
                  </summary>
                  <p className="max-w-[64ch] pb-6 text-[14.5px] leading-relaxed text-[var(--ink-3)]">
                    {item.a}
                  </p>
                </details>
              </RevealItem>
            ))}
          </Reveal>
        </div>
      </div>
    </section>
  );
}
