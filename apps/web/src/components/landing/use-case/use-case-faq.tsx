import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { LandingHeading } from "@/components/landing/heading";
import { FaqAccordion } from "@/app/faq/faq-accordion";
import type { FaqContent } from "./types";

/**
 * Use-case FAQ — the shared accordion (also emitted as FAQPage JSON-LD by the page, so the
 * visible text must match). Question-shaped headings and concise, extractable answers make
 * the section friendly to featured snippets and AI answer engines. Server component.
 */
export function UseCaseFaq({ content }: { content: FaqContent }) {
  return (
    <section id="faq" className="relative border-t border-[var(--hairline)] bg-white py-24 sm:py-28">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <LandingHeading eyebrow={content.eyebrow} title={content.title} subtitle={content.subtitle} />

        <div className="mx-auto mt-12 max-w-3xl">
          <FaqAccordion items={content.items} />

          <div className="mt-12 flex flex-col items-center gap-3 text-center">
            <p className="text-[14.5px] text-[var(--ink-3)]">Still weighing it up?</p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/signup"
                className="inline-flex items-center gap-1.5 rounded-full bg-[var(--fb-strong)] px-5 py-2.5 text-[14px] font-semibold text-white transition-all hover:bg-[#1461d1] hover:shadow-[0_8px_24px_-8px_rgba(24,119,242,0.5)]"
              >
                Start free
                <ArrowRight className="size-4" />
              </Link>
              <Link
                href="/faq"
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--hairline)] bg-white px-5 py-2.5 text-[14px] font-semibold text-[var(--ink-2)] transition-colors hover:text-foreground"
              >
                All FAQs
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
