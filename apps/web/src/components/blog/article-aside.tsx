import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BLOG_AUTHOR } from "@/lib/blog";
import { CTA_REASSURANCE } from "@/components/landing/claims";
import {
  ClaudeMark,
  HubSpotMark,
  LinkedinMark,
  SalesforceMark,
} from "@/components/landing/brand-glyphs";
import { AuthorMark } from "./post-cards";

/**
 * The static parts beside and under an article, after rankbox.xyz's: the offer card at
 * the foot of the contents rail, and the author card that closes the article.
 */

const MARKS = [
  { name: "LinkedIn", Mark: LinkedinMark, color: "#0a66c2" },
  { name: "HubSpot", Mark: HubSpotMark, color: "#ff5c35" },
  { name: "Salesforce", Mark: SalesforceMark, color: "#00a1e0" },
  { name: "Claude", Mark: ClaudeMark, color: "#d97757" },
];

/** The rail's offer: what Vantera does with the playbook you just read. */
export function RailCta() {
  return (
    <div className="rounded-xl border border-[rgba(12,16,26,0.08)] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_12px_32px_-18px_rgba(16,24,40,0.18)]">
      <div aria-hidden className="flex -space-x-1">
        {MARKS.map(({ name, Mark, color }) => (
          <span
            key={name}
            className="flex size-7 items-center justify-center rounded-md border border-[rgba(12,16,26,0.08)] bg-white"
            style={{ color }}
          >
            <Mark className="size-3.5" />
          </span>
        ))}
      </div>
      <p className="mt-4 text-[1.05rem] font-medium leading-snug tracking-[-0.015em] text-foreground">
        Turn LinkedIn into pipeline, on autopilot
      </p>
      <p className="mt-1.5 text-[0.8rem] leading-relaxed text-[var(--ink-3)]">
        Agents find in-market buyers, write every first message, and book the meetings while
        machine learning sharpens the targeting.
      </p>
      <Link
        href="/signup"
        className="group mt-5 flex h-10 items-center justify-center gap-2 rounded-lg bg-[var(--fb-strong)] px-4 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_1px_2px_rgba(16,24,40,0.14)] transition-colors hover:bg-[#1161cc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(24,119,242,0.4)] focus-visible:ring-offset-2"
      >
        Start free trial
        <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
      </Link>
      <p className="mt-2.5 text-center text-[0.7rem] text-[var(--ink-3)]">{CTA_REASSURANCE}</p>
    </div>
  );
}

/** Who wrote the article, and where to read about them. */
export function AuthorCard() {
  return (
    <div className="flex gap-4 rounded-xl border border-[rgba(12,16,26,0.08)] bg-white p-5 sm:p-6">
      <AuthorMark className="size-12" />
      <div className="min-w-0">
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[var(--ink-3)]">
          Written by
        </p>
        <p className="mt-1 font-semibold text-foreground">{BLOG_AUTHOR}</p>
        <p className="mt-1.5 text-sm leading-relaxed text-[var(--ink-3)]">
          The team behind Vantera. We build the agents that run LinkedIn outreach on autopilot,
          and write up what we learn about safe, high-quality prospecting so you can put it to
          work.
        </p>
        <Link
          href="/about"
          className="group mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--fb-strong)] transition-colors hover:text-[#1161cc]"
        >
          Who we are and how we work
          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
        </Link>
      </div>
    </div>
  );
}
