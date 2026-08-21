"use client";

import { Reveal, RevealItem, CARD } from "./surface";
import { SectionIntro } from "./section-intro";
import { cn } from "@/lib/utils";

/**
 * S6 · Why not the alternatives — the comparison every visitor runs in another tab,
 * kept on-page and framed by APPROACH, not brand (brand rows go stale and hand out
 * SEO; blueprint S6). Desktop: a real <table> with the Vantera column emphasized.
 * ≤lg: stacked approach cards, Vantera first. Cells ≤ 7 words; the pricing row uses
 * the honest "from $45/mo" shape (real starter price flows in via prop).
 */

const ROWS = [
  {
    label: "Who writes the message",
    sequencers: "You — templates and variables",
    aiSdrs: "The AI",
    yourself: "You, one at a time",
    vantera: "Agents draft; you approve",
  },
  {
    label: "Who decides what sends",
    sequencers: "You, in bulk",
    aiSdrs: "The AI — review optional",
    yourself: "You",
    vantera: "You, every message",
  },
  {
    label: "Who watches account limits",
    sequencers: "You configure them",
    aiSdrs: "Varies",
    yourself: "You",
    vantera: "Fixed ceilings, warmup, auto-pause",
  },
  {
    label: "What you set up",
    sequencers: "Lists, sequences, conditions",
    aiSdrs: "ICP and a credit card",
    yourself: "Everything",
    vantera: "Website and LinkedIn",
  },
  {
    label: "How it's priced",
    sequencers: "Per seat, per month",
    aiSdrs: "Often annual, per action",
    yourself: "Your evenings",
    vantera: "", // filled from the real starter price
  },
];

const COLS = [
  { key: "sequencers", title: "Sequencers" },
  { key: "aiSdrs", title: "AI SDRs" },
  { key: "yourself", title: "Doing it yourself" },
  { key: "vantera", title: "Vantera" },
] as const;

export function Compare({ starterPriceUsd }: { starterPriceUsd?: number }) {
  const priceCell = starterPriceUsd ? `From $${starterPriceUsd}/mo, cancel anytime` : "Monthly, cancel anytime";
  const rows = ROWS.map((r) => (r.label === "How it's priced" ? { ...r, vantera: priceCell } : r));

  return (
    <section id="compare" className="relative border-t border-[var(--hairline)] bg-white py-24 sm:py-28">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <SectionIntro
          label="Why Vantera"
          title="Not another sequencer. Not a black-box AI SDR."
          lead="Sequencers make you build the machine. AI SDRs run it without you. Vantera runs it with you — a few minutes of review a day."
        />

        {/* Desktop — the table; the Vantera column is set solid brand blue
            (--cyan-strong: white text clears AA at 13.5px) */}
        <Reveal className="mt-12 hidden lg:block">
          <RevealItem>
            <table className="w-full border-separate border-spacing-0">
              <caption className="sr-only">
                Vantera compared with sequencers, AI SDRs, and manual outreach
              </caption>
              <thead>
                <tr>
                  <th scope="col" className="w-[21%] pb-4" aria-label="Dimension" />
                  {COLS.map((c) => (
                    <th
                      key={c.key}
                      scope="col"
                      className={cn(
                        "text-left text-[14px] font-semibold",
                        c.key === "vantera"
                          ? "rounded-t-2xl bg-[var(--cyan-strong)] px-5 pb-4 pt-5 text-white shadow-[0_18px_40px_-18px_rgba(20,97,209,0.6)]"
                          : "px-4 pb-4 text-[var(--ink-3)]",
                      )}
                    >
                      {c.title}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, ri) => (
                  <tr key={r.label}>
                    <th
                      scope="row"
                      className="border-t border-[var(--hairline)] py-4 pr-4 text-left text-[13px] font-semibold text-foreground"
                    >
                      {r.label}
                    </th>
                    {COLS.map((c) => (
                      <td
                        key={c.key}
                        className={cn(
                          "px-4 py-4 text-[13.5px] leading-snug",
                          c.key === "vantera"
                            ? cn(
                                "bg-[var(--cyan-strong)] px-5 font-medium text-white [border-top:1px_solid_rgba(255,255,255,0.16)]",
                                ri === rows.length - 1 && "rounded-b-2xl pb-5",
                              )
                            : "border-t border-[var(--hairline)] text-[var(--ink-3)]",
                        )}
                      >
                        {r[c.key]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </RevealItem>
        </Reveal>

        {/* ≤lg — stacked approach cards, Vantera first */}
        <Reveal className="mt-12 flex flex-col gap-4 lg:hidden">
          {[COLS[3], COLS[0], COLS[1], COLS[2]].map((c) => (
            <RevealItem
              key={c.key}
              className={cn(
                c.key === "vantera"
                  ? "rounded-2xl bg-[var(--cyan-strong)] p-5 shadow-[0_18px_40px_-18px_rgba(20,97,209,0.6)]"
                  : cn(CARD, "p-5"),
              )}
            >
              <p
                className={cn(
                  "text-[15px] font-semibold",
                  c.key === "vantera" ? "text-white" : "text-foreground",
                )}
              >
                {c.title}
              </p>
              <dl className="mt-3 flex flex-col gap-2.5">
                {rows.map((r) => (
                  <div key={r.label}>
                    <dt
                      className={cn(
                        "text-[11px] font-semibold uppercase tracking-[0.06em]",
                        c.key === "vantera" ? "text-white/70" : "text-[var(--ink-4)]",
                      )}
                    >
                      {r.label}
                    </dt>
                    <dd
                      className={cn(
                        "mt-0.5 text-[13.5px]",
                        c.key === "vantera" ? "text-white" : "text-[var(--ink-2)]",
                      )}
                    >
                      {r[c.key]}
                    </dd>
                  </div>
                ))}
              </dl>
            </RevealItem>
          ))}
        </Reveal>

        <p className="mt-6 text-[12.5px] leading-relaxed text-[var(--ink-4)]">
          Compared by approach — sequencers like Waalaxy or Expandi, AI SDRs like Artisan.
        </p>
      </div>
    </section>
  );
}
