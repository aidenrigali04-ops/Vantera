import { Crosshair, Gauge, PenLine, Scale, SlidersHorizontal, Wallet } from "lucide-react";
import { Reveal, RevealItem } from "./surface";
import { Accent, Band, LINE, SectionHead, type Icon } from "./frame";
import { VanteraLogo } from "./vantera-logo";
import { cn } from "@/lib/utils";

/**
 * Why not the alternatives — the comparison every visitor runs in another tab, kept
 * on-page and framed by APPROACH, not brand (brand rows go stale and hand out SEO).
 * After rankbox.xyz's sample-output index: one hairline row per question, read like a
 * published feed — number, the question, Vantera's answer as the headline with the
 * three alternatives as its standfirst, and a Vantera chip. The pricing row's answer
 * is the honest "from $X/mo" shape (the real starter price flows in via prop).
 */

type Approach = "sequencers" | "aiSdrs" | "yourself";

const ALTERNATIVES: { key: Approach; title: string }[] = [
  { key: "sequencers", title: "Sequencers" },
  { key: "aiSdrs", title: "AI SDRs" },
  { key: "yourself", title: "Doing it yourself" },
];

const ROWS: ({
  label: string;
  icon: Icon;
  /** Vantera's answer; null on the pricing row, which takes the real price. */
  vantera: string | null;
} & Record<Approach, string>)[] = [
  {
    label: "Who writes the message",
    icon: PenLine,
    sequencers: "You — templates and variables",
    aiSdrs: "The AI",
    yourself: "You, one at a time",
    vantera: "Agents, from each buyer’s real activity",
  },
  {
    label: "Who picks who gets messaged",
    icon: Crosshair,
    sequencers: "You, from a list",
    aiSdrs: "The AI, unexplained",
    yourself: "You, by gut",
    vantera: "Machine learning, every score explained",
  },
  {
    label: "Who watches account limits",
    icon: Gauge,
    sequencers: "You configure them",
    aiSdrs: "Varies",
    yourself: "You",
    vantera: "Fixed ceilings, warmup, auto-pause",
  },
  {
    label: "What you set up",
    icon: SlidersHorizontal,
    sequencers: "Lists, sequences, conditions",
    aiSdrs: "ICP and a credit card",
    yourself: "Everything",
    vantera: "Website and LinkedIn, about 3 minutes",
  },
  {
    label: "How it’s priced",
    icon: Wallet,
    sequencers: "Per seat, per month",
    aiSdrs: "Often annual, per action",
    yourself: "Your evenings",
    vantera: null,
  },
];

export function Compare({ starterPriceUsd }: { starterPriceUsd?: number }) {
  const priceCell = starterPriceUsd ? `From $${starterPriceUsd}/mo, cancel anytime` : "Monthly, cancel anytime";

  return (
    <section>
      <SectionHead
        id="compare"
        icon={Scale}
        eyebrow="Why Vantera"
        title={
          <>
            Not another sequencer. <Accent>Not a black-box AI SDR.</Accent>
          </>
        }
        subtitle="Sequencers make you build the machine. Black-box AI SDRs won’t show their work. Vantera runs on autopilot and shows you why every prospect made the list."
      />

      <Band>
        <ol className="divide-y divide-[var(--hairline)]">
          {ROWS.map((r, i) => (
            <li key={r.label}>
              {/* Each row reveals as it reaches the screen, not the list at once. */}
              <Reveal>
                <RevealItem style={{ transitionDelay: `${(i % 3) * 0.04}s` }}>
                  <div className="grid gap-3 px-6 py-6 transition-colors duration-300 hover:bg-[color-mix(in_oklab,var(--tint)_40%,white)] sm:px-8 lg:grid-cols-[3rem_15rem_1fr_auto] lg:items-center lg:gap-6 lg:px-10">
                    <span className="hidden font-[family-name:var(--font-geist-mono),ui-monospace,monospace] text-xs tabular-nums text-[var(--ink-3)]/70 lg:block">
                      {String(i + 1).padStart(2, "0")}
                    </span>

                    {/* the question, where rankbox shows the site an article ran on */}
                    <span className="flex items-center gap-2.5 text-[0.8rem] font-medium text-[var(--ink-3)]">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-[rgba(12,16,26,0.08)] bg-white text-foreground shadow-[0_1px_2px_rgba(16,24,40,0.05)]">
                        <r.icon className="size-3.5" strokeWidth={2} />
                      </span>
                      {r.label}
                    </span>

                    <div className="min-w-0">
                      <h3 className="text-[1.02rem] font-semibold leading-snug tracking-tight text-foreground">
                        {r.vantera ?? priceCell}
                      </h3>
                      <dl className="mt-1 max-w-2xl text-sm leading-relaxed text-[var(--ink-3)]">
                        {ALTERNATIVES.map((a, j) => (
                          <div key={a.key} className="inline">
                            <dt className="inline font-medium text-foreground/70">
                              {j > 0 && (
                                <span aria-hidden className="mx-2 font-normal text-foreground/25">
                                  ·
                                </span>
                              )}
                              {a.title}:
                            </dt>{" "}
                            <dd className="inline">{r[a.key]}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>

                    <span
                      className={cn(
                        "inline-flex w-fit items-center gap-1.5 whitespace-nowrap rounded-md border bg-white px-2 py-0.5 text-[0.7rem] font-medium text-[var(--ink-3)]",
                        LINE,
                      )}
                    >
                      <VanteraLogo className="size-3 text-[var(--fb)]" />
                      Vantera
                    </span>
                  </div>
                </RevealItem>
              </Reveal>
            </li>
          ))}
        </ol>
      </Band>

      <Band inner="px-6 py-5 text-center sm:px-8">
        <p className="text-[0.8rem] text-[var(--ink-3)]/80">
          Compared by approach — sequencers like Waalaxy or Expandi, AI SDRs like Artisan.
        </p>
      </Band>
    </section>
  );
}
