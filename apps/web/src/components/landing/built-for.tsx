"use client";

import Link from "next/link";
import { ArrowRight, Check, X } from "lucide-react";
import { Reveal, RevealItem, CARD } from "./surface";
import { SectionIntro } from "./section-intro";
import { CTA_HREF, CTA_LABEL, CTA_REASSURANCE } from "./claims";
import { cn } from "@/lib/utils";

/**
 * S7 · Built for — "Is this for someone like me?" Fit AND anti-fit: saying who
 * Vantera is NOT for is the cheapest trust on the page (blueprint S7 — almost absent
 * in the category). The anti-fit rows are true product boundaries: volume shops
 * (hard ceilings), hands-off buyers (review-first), email-first teams (LinkedIn-only
 * by design). First primary CTA of the page.
 */

const GOOD_FIT = [
  { role: "Solo founders", line: "You are the SDR. Minutes a day, not a second job." },
  { role: "Small B2B teams", line: "One or two people selling a high-ticket product or service." },
  {
    role: "Agencies & consultants",
    line: "Your LinkedIn reputation is the asset, so nothing goes out unread.",
  },
];

const NOT_FIT = [
  {
    role: "Volume shops",
    line: "A thousand invites a week? The ceilings will frustrate you.",
  },
  {
    role: "Hands-off buyers",
    line: "Never want to read a message? This isn't that.",
  },
  {
    role: "Email-first teams",
    line: "LinkedIn-only by design. No cold email.",
  },
];

export function BuiltFor() {
  return (
    <section id="built-for" className="relative border-t border-[var(--hairline)] bg-white py-24 sm:py-28">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <SectionIntro
          align="center"
          label="Who it's for"
          title="Built for people who sell what they build."
          lead="And honestly not for everyone — here's both sides."
        />

        <Reveal className="mx-auto mt-14 grid max-w-4xl gap-5 sm:grid-cols-2">
          {(
            [
              { head: "Good fit", items: GOOD_FIT, icon: Check, fit: true },
              { head: "Not a fit", items: NOT_FIT, icon: X, fit: false },
            ] as const
          ).map((col) => (
            <RevealItem
              key={col.head}
              className={cn(
                CARD,
                "relative overflow-hidden p-7",
                col.fit && "border-[var(--cyan-line)]",
              )}
            >
              {/* fit card gets the brand top rail */}
              {col.fit && (
                <span
                  aria-hidden
                  className="absolute inset-x-0 top-0 h-[3px] [background:linear-gradient(90deg,transparent,var(--fb)_22%,var(--fb)_78%,transparent)]"
                />
              )}
              <p
                className={cn(
                  "font-mono text-[11px] font-semibold uppercase tracking-[0.16em]",
                  col.fit ? "text-[var(--cyan-strong)]" : "text-[var(--ink-4)]",
                )}
              >
                {col.head}
              </p>
              <div className="mt-6 flex flex-col gap-6">
                {col.items.map((it) => (
                  <div key={it.role} className="flex items-start gap-3.5">
                    <span
                      className={cn(
                        "mt-0.5 grid size-6 shrink-0 place-items-center rounded-full",
                        col.fit
                          ? "bg-[var(--cyan-tint)] text-[var(--cyan-strong)] ring-1 ring-inset ring-[var(--cyan-line)]"
                          : "bg-[#f1f2f4] text-[var(--ink-4)]",
                      )}
                    >
                      <col.icon className="size-3.5" strokeWidth={2.4} aria-hidden />
                    </span>
                    <div>
                      <p className="text-[15px] font-semibold text-foreground">{it.role}</p>
                      <p className="mt-1 text-[13.5px] leading-relaxed text-[var(--ink-3)]">
                        {it.line}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </RevealItem>
          ))}
        </Reveal>

        {/* CTA #1 */}
        <Reveal className="mt-14 flex flex-col items-center gap-3.5">
          <RevealItem>
            <Link
              href={CTA_HREF}
              className="group inline-flex items-center gap-2 rounded-full bg-[var(--fb)] px-7 py-3 text-[15px] font-semibold text-white shadow-[0_6px_18px_-8px_rgba(24,119,242,0.4)] transition-all hover:-translate-y-0.5 hover:bg-[var(--fb-strong)] hover:shadow-[0_12px_28px_-12px_rgba(24,119,242,0.45)] active:scale-[0.98]"
            >
              {CTA_LABEL}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </RevealItem>
          <RevealItem>
            <p className="text-[13px] text-[var(--ink-4)]">{CTA_REASSURANCE}</p>
          </RevealItem>
        </Reveal>
      </div>
    </section>
  );
}
