import type { CSSProperties } from "react";
import { BookOpen, Radar, Scale, ShieldCheck } from "lucide-react";
import { Accent, LINE, Pill } from "@/components/landing/frame";
import { MarkDither } from "@/components/landing/hero-dither";
import { LinkedinMark } from "@/components/landing/brand-glyphs";
import { cn } from "@/lib/utils";

/* Staggers the CSS entrance (`landing-rise` in globals.css). */
const rise = (delay: number) => ({ "--rise-delay": `${delay}s` }) as CSSProperties;

/* The subjects the playbooks cover — a legend, not filters (the library below has those). */
const SUBJECTS = [
  { name: "LinkedIn outreach", Icon: LinkedinMark, color: "#0a66c2" },
  { name: "Account safety", Icon: ShieldCheck, color: "#13824a" },
  { name: "Buying intent", Icon: Radar, color: "#1461d1" },
  { name: "Tool comparisons", Icon: Scale, color: "#5b4bd1" },
];

/**
 * The blog's hero, after rankbox.xyz's: the landing hero's frame and dithered mark
 * holding the blog's promise and the subjects its playbooks cover. The headline paints
 * on the server with no opacity gate; only the lines around it rise in.
 */
export function BlogHero() {
  return (
    <section aria-labelledby="blog-title" className="relative bg-white">
      <div className={cn("relative mx-auto max-w-6xl overflow-hidden border-x", LINE)}>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.32] [mask-image:radial-gradient(ellipse_66%_82%_at_50%_50%,#000_50%,transparent_100%)]"
        >
          <MarkDither />
        </div>
        <div className="relative flex flex-col items-center px-5 pb-14 pt-14 text-center sm:px-8 sm:pb-16 sm:pt-16">
          <div className="landing-rise" style={rise(0)}>
            <Pill icon={BookOpen}>The Vantera blog</Pill>
          </div>
          <h1
            id="blog-title"
            className="mt-6 text-balance text-[2.3rem] font-medium leading-[1.08] tracking-[-0.035em] text-foreground sm:text-[3.3rem] lg:text-[3.8rem]"
          >
            Get more meetings <Accent>from LinkedIn</Accent>
          </h1>
          <p
            className="landing-rise mx-auto mt-5 max-w-2xl text-balance text-[1.05rem] leading-relaxed text-[var(--ink-3)] sm:text-[1.12rem]"
            style={rise(0.08)}
          >
            Practical playbooks on account safety, buying intent, and outreach that earns
            replies. Written to be used this week, not bookmarked.
          </p>
          <ul
            aria-label="What the playbooks cover"
            className="landing-rise mt-8 flex flex-wrap items-center justify-center gap-2"
            style={rise(0.16)}
          >
            {SUBJECTS.map(({ name, Icon, color }) => (
              <li
                key={name}
                className="inline-flex items-center gap-2 rounded-lg border border-[rgba(12,16,26,0.08)] bg-white py-1 pl-1 pr-2.5 text-[0.8rem] font-medium text-foreground shadow-[0_1px_2px_rgba(16,24,40,0.04)]"
              >
                <span
                  aria-hidden
                  className="flex size-5 items-center justify-center rounded-md border border-[rgba(12,16,26,0.06)]"
                  style={{ color }}
                >
                  <Icon className="size-3" />
                </span>
                {name}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
