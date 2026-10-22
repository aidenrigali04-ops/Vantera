import { HelpCircle, Plus } from "lucide-react";
import { Band, GhostLink, LINE, Pill, TITLE } from "./frame";
import { Reveal, RevealItem } from "./surface";
import { FAQ_ITEMS, type FaqItem } from "./faq-data";
import { cn } from "@/lib/utils";

/**
 * The homepage FAQ, after rankbox.xyz's (itself after Rankaria's): the title on the
 * left, the questions down the right, each on a hairline with a plus that turns into a
 * blue cross when open.
 *
 * Renders the SAME FAQ_ITEMS the /faq page and the FAQPage JSON-LD use (they must stay
 * identical — see faq-data.ts). Native <details>/<summary>: every answer is in the DOM
 * for crawlers and answer engines, keyboard-accessible with no JS. The shared `name`
 * makes them one accordion where the browser supports it (one answer open at a time,
 * like rankbox's); elsewhere each opens on its own.
 *
 * Feature pages pass their own questions and heading; the defaults are the homepage's.
 * Whoever passes `items` must emit the matching FAQPage JSON-LD.
 */
export function FaqHome({
  items = FAQ_ITEMS,
  title = "Frequently asked questions",
  subtitle = "Everything you need to know about safety, pricing, and how Vantera books meetings on LinkedIn.",
}: {
  items?: FaqItem[];
  title?: string;
  subtitle?: string;
} = {}) {
  return (
    <Band id="faq">
      <Reveal className="grid lg:grid-cols-[0.8fr_1.2fr]">
        <RevealItem
          className={cn(
            "flex flex-col items-start justify-center border-b px-6 py-10 sm:px-10 lg:border-b-0 lg:border-r lg:px-12 lg:py-14",
            LINE,
          )}
        >
          <Pill icon={HelpCircle}>FAQ</Pill>
          <h2 className={cn(TITLE, "mt-5")}>{title}</h2>
          <p className="mt-4 max-w-sm text-[0.98rem] leading-relaxed text-[var(--ink-3)]">
            {subtitle}
          </p>
          <div className="mt-6">
            <GhostLink href="/faq">All questions</GhostLink>
          </div>
        </RevealItem>

        <RevealItem className="px-6 py-4 sm:px-10 lg:px-12 lg:py-8">
          <div className="divide-y divide-[var(--hairline)]">
            {items.map((item, i) => (
              <details key={item.q} id={`faq-${i + 1}`} name="faq" className="group/item">
                <summary className="group/q flex cursor-pointer list-none items-center justify-between gap-6 rounded-sm py-5 text-left text-[0.98rem] font-medium text-foreground transition-colors hover:text-[var(--fb)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fb)]/40 focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <span
                    aria-hidden
                    className="grid size-6 shrink-0 place-items-center rounded-md border border-[rgba(12,16,26,0.08)] bg-white text-foreground transition-[transform,background-color,color,border-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover/q:border-[var(--fb)]/30 group-open/item:rotate-45 group-open/item:border-[var(--fb)] group-open/item:bg-[var(--fb)] group-open/item:text-white"
                  >
                    <Plus className="size-3.5" />
                  </span>
                </summary>
                {/* Plays each time the answer is shown: an opened <details> renders
                    its content afresh. */}
                <p className="max-w-2xl pb-5 pr-10 text-sm leading-relaxed text-[var(--ink-3)] animate-in fade-in-0 slide-in-from-top-1 duration-300 motion-reduce:animate-none">
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </RevealItem>
      </Reveal>
    </Band>
  );
}
