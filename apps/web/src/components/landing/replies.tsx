"use client";

import { ArrowRight, Inbox, Zap } from "lucide-react";
import { Reveal, RevealItem } from "./surface";
import { ProductFrame } from "./product-frame";
import { FrameGlow, Mark, SectionIntro } from "./section-intro";
import { cn } from "@/lib/utils";

/**
 * S5 · Replies (05/05) — "What happens when someone replies?" An inbox embed with
 * classification chips and the drafted next move, plus the RULE callout stating the
 * suppression guarantee that's actually guardrail-tested in this codebase (rule 11:
 * "not interested" writes to suppression; suppression is checked before every send).
 * The CRM handoff line lives here — one honest sentence, not a logo marquee.
 */

const THREADS = [
  {
    initials: "MC",
    name: "Maya Chen",
    preview: "Yes — this is timely. How's Thursday?",
    tag: "Interested",
    when: "2m",
    active: true,
  },
  {
    initials: "LR",
    name: "Luis Ramos",
    preview: "What does pricing look like for a team of 3?",
    tag: "Question",
    when: "1h",
    active: false,
  },
  {
    initials: "PB",
    name: "Piotr Novak",
    preview: "Not right now — try me next quarter.",
    tag: "Not now",
    when: "3h",
    active: false,
  },
];

function InboxEmbed() {
  return (
    <div aria-hidden>
      {/* thread list */}
      <div className="flex flex-col gap-1.5">
        {THREADS.map((t) => (
          <div
            key={t.name}
            className={cn(
              "flex items-center gap-2.5 rounded-xl border p-2.5",
              t.active
                ? "border-[var(--cyan-line)] bg-[rgba(24,119,242,0.05)]"
                : "border-[var(--hairline)] bg-[#fbfcfe]",
            )}
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#e2e8f0] to-[#cbd5e1] text-[10px] font-bold text-[#475569]">
              {t.initials}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-[12px] font-semibold text-foreground">{t.name}</span>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-1.5 py-0.5 text-[8.5px] font-bold uppercase tracking-[0.08em]",
                    t.tag === "Interested"
                      ? "bg-[var(--cyan-tint)] text-[var(--cyan-strong)]"
                      : "bg-[#f1f2f4] text-[var(--ink-4)]",
                  )}
                >
                  {t.tag}
                </span>
                <span className="ml-auto shrink-0 text-[10px] tabular-nums text-[var(--ink-4)]">
                  {t.when}
                </span>
              </div>
              <p className="mt-0.5 truncate text-[11px] text-[var(--ink-3)]">{t.preview}</p>
            </div>
          </div>
        ))}
      </div>

      {/* suggested reply for the active thread */}
      <div className="mt-3 rounded-xl border border-[var(--cyan-line)] bg-[#f6faff] p-3.5">
        <div className="flex items-center gap-1.5">
          <Zap className="size-3 text-[var(--cyan-strong)]" strokeWidth={2.4} />
          <span className="text-[9.5px] font-bold uppercase tracking-[0.1em] text-[var(--cyan-strong)]">
            Suggested · Interested
          </span>
        </div>
        <p className="mt-2 text-[12px] leading-relaxed text-[var(--ink-2)]">
          Thursday works. I can do <span className="font-mono font-semibold">10:30</span> or{" "}
          <span className="font-mono font-semibold">2:00</span> — which suits you? I&rsquo;ll send an
          invite as soon as you pick.
        </p>
        <div className="mt-3 flex items-center gap-1.5">
          <span className="rounded-[8px] bg-[var(--fb-strong)] px-3 py-1.5 text-[11px] font-semibold text-white">
            Send
          </span>
          <span className="rounded-[8px] border border-[var(--hairline)] bg-white px-3 py-1.5 text-[11px] font-semibold text-[var(--ink-3)]">
            Edit
          </span>
          <span className="rounded-[8px] border border-[var(--hairline)] bg-white px-3 py-1.5 text-[11px] font-semibold text-[var(--ink-3)]">
            Let agent handle
          </span>
        </div>
      </div>
    </div>
  );
}

export function Replies() {
  return (
    <section id="replies" className="relative bg-white py-10 sm:py-14">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <SectionIntro
          index="05"
          label="Replies"
          title={
            <>
              Replies land in <Mark>one inbox</Mark>, with the next move drafted.
            </>
          }
          lead="Every reply classified, warm ones on top. Reply yourself or let the agent handle it."
        />

        <div className="mt-10 rounded-[28px] bg-[#F6FAFF] px-6 py-10 sm:px-10 sm:py-12 lg:px-14 lg:py-14">
        <div className="grid items-center gap-14 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
          {/* LEFT — the inbox */}
          <Reveal className="order-2 lg:order-1">
            <RevealItem className="relative">
              <FrameGlow />
              <ProductFrame label="Replies · 3 conversations">
                <InboxEmbed />
              </ProductFrame>
            </RevealItem>
          </Reveal>

          {/* RIGHT — the argument */}
          <div className="order-1 lg:order-2">
            <Reveal className="flex flex-col gap-5">
              {[
                {
                  icon: Inbox,
                  head: "Warm first",
                  text: "Interested replies surface immediately, response already drafted.",
                },
                {
                  icon: Zap,
                  head: "Graceful no",
                  text: "“Not interested” goes straight on your suppression list.",
                },
              ].map((b) => (
                <RevealItem key={b.head} className="flex items-start gap-3.5">
                  <span className="grid size-9 shrink-0 place-items-center rounded-[10px] border border-[var(--hairline)] bg-white text-[var(--cyan-strong)] shadow-[0_2px_0_var(--hairline),var(--shadow-sm)]">
                    <b.icon className="size-4" strokeWidth={2.2} />
                  </span>
                  <p className="text-[15px] leading-relaxed text-[var(--ink-3)]">
                    <span className="font-semibold text-foreground">{b.head}.</span> {b.text}
                  </p>
                </RevealItem>
              ))}
            </Reveal>

            {/* the rule — the guardrail-tested guarantee */}
            <RevealItem>
              <div className="mt-8 rounded-xl border border-[var(--cyan-line)] bg-[rgba(24,119,242,0.05)] p-4">
                <span className="inline-flex items-center rounded-[6px] bg-[var(--fb)] px-1.5 py-0.5 font-mono text-[9.5px] font-bold uppercase tracking-[0.14em] text-white">
                  Rule
                </span>
                <p className="mt-2 text-[14.5px] font-medium leading-relaxed text-foreground">
                  Suppression is checked before every send — opt-outs can never be messaged
                  again.
                </p>
              </div>
            </RevealItem>

            <p className="mt-6 flex items-center gap-2 text-[13.5px] text-[var(--ink-4)]">
              <ArrowRight className="size-3.5 text-[var(--cyan-strong)]" strokeWidth={2.2} aria-hidden />
              Won conversations push to HubSpot or Pipedrive in one click.
            </p>
          </div>
        </div>
        </div>
      </div>
    </section>
  );
}
