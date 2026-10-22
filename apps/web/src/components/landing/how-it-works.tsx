"use client";

import { useId, type ComponentType, type CSSProperties, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Radar, Workflow } from "lucide-react";
import { cn } from "@/lib/utils";
import { Reveal, RevealItem } from "./surface";
import { Accent, Band, LINE, SectionHead } from "./frame";
import { ClaudeMark, HubSpotMark, LinkedinMark, SalesforceMark, SlackMark } from "./brand-glyphs";

/**
 * How it works, after rankbox.xyz's "Win Google and AI answers at once" block: the two
 * ways agents find buyers as white cards on a grey split band (by fit, by signal),
 * one row of hairline cells for what the user sets and what runs on its own, and a
 * label cell beside the tools wins flow into. The single time claim lives in the
 * title. Every number inside the cards is sample product data.
 */

/* The sample account's last twelve weeks, cumulative, so each series ends on the
   stat above the chart (1,240 found, 312 qualified). */
const FOUND = [42, 97, 160, 234, 320, 415, 523, 640, 771, 913, 1070, 1240];
const QUALIFIED = [9, 21, 36, 54, 75, 98, 125, 155, 189, 226, 267, 312];

const GREEN = "#13a05a";

const ICP_CHIPS = [
  "VP Sales",
  "Head of Growth",
  "Founder",
  "RevOps",
  "B2B SaaS",
  "Agencies",
  "11–200 employees",
  "US & Canada",
  "UK",
  "DACH",
  "Nordics",
];

const PLATFORMS: { name: string; color: string; Mark: ComponentType<{ className?: string }> }[] = [
  { name: "LinkedIn", color: "#0a66c2", Mark: LinkedinMark },
  { name: "HubSpot", color: "#ff5c35", Mark: HubSpotMark },
  { name: "Salesforce", color: "#00a1e0", Mark: SalesforceMark },
  { name: "Slack", color: "#4a154b", Mark: SlackMark },
  { name: "Claude", color: "#d97757", Mark: ClaudeMark },
];

/* The two ways in, as Rankaria shows its tracking tools: white cards on a grey
   panel, each half ruled off by a hairline. */
function PanelCard({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-[28rem] rounded-xl border border-[var(--hairline)] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_12px_32px_-18px_rgba(16,24,40,0.18)] sm:p-6">
      <h3 className="text-[1.15rem] font-medium tracking-tight text-foreground">{title}</h3>
      <p className="mt-1.5 text-[0.85rem] leading-relaxed text-[var(--ink-3)]">{body}</p>
      <div className="mt-5">{children}</div>
    </div>
  );
}

/* A supporting capability, as one cell of a hairline grid. */
function Cell({ title, body, children }: { title: string; body: string; children: ReactNode }) {
  return (
    <div className="flex h-full flex-col p-6 sm:p-8">
      <h3 className="text-[1.05rem] font-semibold tracking-tight text-foreground">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-[var(--ink-3)]">{body}</p>
      <div className="mt-6 flex-1">{children}</div>
    </div>
  );
}

const ROW =
  "flex items-center justify-between rounded-lg border border-[var(--hairline)] bg-white px-3 py-2 shadow-[0_1px_2px_rgba(16,24,40,0.03)]";

/* Inline-SVG area chart, no chart library: both series on one scale from zero, so
   the qualified line sits where it really falls under the found area. The lines
   draw in once the chart scrolls into view; reduced motion shows them at once. */
const W = 320;
const H = 110;
const PAD = 4;

function linePath(points: number[], max: number) {
  const step = (W - PAD * 2) / (points.length - 1);
  return points
    .map((p, i) => {
      const x = PAD + i * step;
      const y = H - PAD - (p / max) * (H - PAD * 2);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function FitChart() {
  const reduce = useReducedMotion();
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const max = Math.max(...FOUND);
  const series = [
    { key: "found", points: FOUND, color: "var(--fb)", fill: 0.25 },
    { key: "qualified", points: QUALIFIED, color: GREEN, fill: 0.14 },
  ];
  const view = { once: true, margin: "-80px" } as const;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-28 w-full" preserveAspectRatio="none" aria-hidden>
      <defs>
        {series.map((s) => (
          <linearGradient key={s.key} id={`${id}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={s.color} stopOpacity={s.fill} />
            <stop offset="100%" stopColor={s.color} stopOpacity="0" />
          </linearGradient>
        ))}
      </defs>
      {series.map((s) => {
        const line = linePath(s.points, max);
        return (
          <g key={s.key}>
            <motion.path
              d={`${line} L${W - PAD},${H - PAD} L${PAD},${H - PAD} Z`}
              fill={`url(#${id}-${s.key})`}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={view}
              transition={{ duration: reduce ? 0 : 0.8, delay: reduce ? 0 : 0.5 }}
            />
            <motion.path
              d={line}
              fill="none"
              stroke={s.color}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              initial={{ pathLength: 0 }}
              whileInView={{ pathLength: 1 }}
              viewport={view}
              transition={{ duration: reduce ? 0 : 1.2, ease: [0.22, 1, 0.36, 1] }}
            />
          </g>
        );
      })}
    </svg>
  );
}

/* A status dot; `pulse` rings it like a live process. */
function Dot({ color, pulse = false }: { color: string; pulse?: boolean }) {
  return (
    <span className="relative flex size-1.5">
      {pulse && (
        <span
          className="absolute inline-flex size-full rounded-full opacity-60 motion-safe:animate-ping"
          style={{ background: color }}
        />
      )}
      <span className="relative inline-flex size-1.5 rounded-full" style={{ background: color }} />
    </span>
  );
}

/* Hairlines stay put while the content inside rises in, so a delay is set inline
   (the reveal's own stagger only reaches direct children). */
const delay = (s: number) => ({ transitionDelay: `${s}s` }) as CSSProperties;

export function HowItWorks() {
  return (
    <section>
      <SectionHead
        id="how-it-works"
        icon={Workflow}
        eyebrow="How it works"
        title={
          <>
            3 minutes from your website{" "}
            <span className="sm:block">
              <Accent>to agents at work</Accent>
            </span>
          </>
        }
        subtitle="Paste your website and connect LinkedIn. Agents find buyers by fit and by what they’re doing right now, then run your outreach on autopilot while machine learning sharpens the targeting."
      />

      {/* The two ways in, side by side on the grey panel. */}
      <Band inner="bg-[var(--tint)]">
        <Reveal className="grid lg:grid-cols-2">
          <div className="flex items-center px-5 py-10 sm:px-10 sm:py-14">
            <RevealItem className="w-full">
              <PanelCard
                title="Find buyers by fit"
                body="Every day, agents search your ideal customer profile, and machine learning learns which profiles reply, so targeting gets sharper every week."
              >
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
                  {[
                    ["Prospects found", "1,240"],
                    ["Qualified", "312"],
                    ["Avg. fit", "87"],
                    ["Messages sent", "298"],
                  ].map(([l, v]) => (
                    <div key={l}>
                      <p className="text-[0.68rem] text-[var(--ink-3)]">{l}</p>
                      <p className="text-lg font-semibold tabular-nums tracking-tight text-foreground">
                        {v}
                      </p>
                    </div>
                  ))}
                </div>
                <div className={cn("mt-4 rounded-lg border px-2 pt-2", LINE)}>
                  <FitChart />
                </div>
                <div className="mt-3 flex gap-4 text-[0.7rem] text-[var(--ink-3)]">
                  <span className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-[var(--fb)]" /> Found
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full" style={{ background: GREEN }} /> Qualified
                  </span>
                </div>
              </PanelCard>
            </RevealItem>
          </div>

          <div
            className={cn(
              "flex items-center border-t px-5 py-10 sm:px-10 sm:py-14 lg:border-l lg:border-t-0",
              LINE,
            )}
          >
            <RevealItem className="w-full" style={delay(0.08)}>
              <PanelCard
                title="Reach them when they’re in-market"
                body="A post, a new hire, a fresh round. Signals lift a prospect’s score, and the agent writes the opener from that moment."
              >
                <div className="flex items-center gap-2">
                  <span className="grid size-6 place-items-center rounded-md border border-[rgba(12,16,26,0.08)] bg-white">
                    <LinkedinMark className="size-3.5 text-[#0a66c2]" />
                  </span>
                  <span className="text-sm font-semibold text-foreground">LinkedIn</span>
                </div>
                <div className="ml-auto mt-3 w-fit max-w-[85%] rounded-lg border border-[var(--hairline)] bg-white px-3 py-2 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
                  <p className="text-[0.68rem] text-[var(--ink-3)]">
                    Rachel Nguyen · VP Sales, Northwind · 3d
                  </p>
                  <p className="mt-0.5 text-[0.8rem] text-foreground">
                    We’re rebuilding outbound after the reorg. What’s actually working for small
                    teams?
                  </p>
                </div>
                <div className="mt-3 flex gap-2.5">
                  <Radar className="mt-0.5 size-4 shrink-0 text-[var(--fb)]" strokeWidth={2} />
                  <p className="text-[0.8rem] leading-relaxed text-[var(--ink-3)]">
                    Signal: <span className="font-semibold text-foreground">pipeline pain</span> ·{" "}
                    <span className="font-semibold" style={{ color: GREEN }}>
                      +30 to fit
                    </span>
                  </p>
                </div>
                {/* Rankaria marks the winner as a highlighted #1 row. */}
                <div className="mt-4 flex items-center gap-2.5 rounded-lg border border-[rgba(24,119,242,0.4)] bg-[var(--cyan-tint)] px-3 py-2">
                  <span className="text-[0.7rem] font-semibold text-[var(--ink-3)]">#1</span>
                  <span className="grid size-5 place-items-center rounded-full bg-white text-[0.6rem] font-bold text-[var(--fb)] ring-1 ring-[rgba(24,119,242,0.2)]">
                    RN
                  </span>
                  <span className="text-[0.8rem] font-semibold text-foreground">Rachel Nguyen</span>
                  <span className="ml-auto text-[0.68rem] font-semibold text-[var(--fb)]">
                    Opener drafted
                  </span>
                </div>
              </PanelCard>
            </RevealItem>
          </div>
        </Reveal>
      </Band>

      {/* What you set and what runs on its own: one row of hairline cells. White sits
          on still wrappers so a rising cell never shows the fill behind it. */}
      <Band>
        <Reveal className="grid gap-px bg-[var(--hairline)] lg:grid-cols-3">
          <div className="bg-white">
            <RevealItem className="h-full">
              <Cell
                title="Your goal, your voice"
                body="Set the call to action and add your own content. Every message reads like you wrote it."
              >
                <div className="space-y-2">
                  <div className={ROW}>
                    <span className="text-xs text-[var(--ink-3)]">Call to action</span>
                    <span className="rounded-md bg-[var(--cyan-tint)] px-2 py-0.5 text-xs font-medium text-[var(--fb)]">
                      Book a 20-min call
                    </span>
                  </div>
                  <div className={cn(ROW, "block")}>
                    <span className="text-xs text-[var(--ink-3)]">Your content</span>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {["case-study.pdf", "pricing page"].map((c) => (
                        <span
                          key={c}
                          className="rounded-md border border-[rgba(12,16,26,0.08)] bg-white px-2 py-1 text-xs font-medium text-foreground"
                        >
                          {c}
                        </span>
                      ))}
                      <span className="rounded-md bg-[var(--fb-strong)] px-2 py-1 text-xs font-medium text-white">
                        + link
                      </span>
                    </div>
                  </div>
                </div>
              </Cell>
            </RevealItem>
          </div>

          <div className="bg-white">
            <RevealItem className="h-full" style={delay(0.06)}>
              <Cell
                title="Runs on autopilot"
                body="Agents run daily or weekly on your schedule and send at a safe, human pace. No approvals needed."
              >
                <div className="space-y-1.5">
                  {(
                    [
                      ["Rachel Nguyen", "VP Sales", "Replied", "var(--fb)", false],
                      ["Marcus Feld", "Head of Growth", "Sent", GREEN, false],
                      ["Aisha Okafor", "Founder", "Sending", "var(--fb)", true],
                      ["Luis Ramos", "Head of Sales", "Queued", "var(--ink-3)", false],
                    ] as const
                  ).map(([name, role, status, color, pulse]) => (
                    <div key={name} className={cn(ROW, "py-1.5")}>
                      <span className="truncate pr-2 text-[0.72rem] font-medium text-foreground">
                        {name} <span className="font-normal text-[var(--ink-3)]">· {role}</span>
                      </span>
                      <span
                        className="flex shrink-0 items-center gap-1 text-[0.6rem] font-semibold uppercase tracking-wide"
                        style={{ color }}
                      >
                        <Dot color={color} pulse={pulse} /> {status}
                      </span>
                    </div>
                  ))}
                </div>
              </Cell>
            </RevealItem>
          </div>

          <div className="bg-white">
            <RevealItem className="h-full" style={delay(0.12)}>
              <Cell
                title="Up to three ICPs"
                body="Target up to three ideal customer profiles per agent, by title, industry, size, and region."
              >
                <div className="flex flex-wrap gap-1.5">
                  {ICP_CHIPS.map((c) => (
                    <span
                      key={c}
                      className="rounded-md border border-[var(--hairline)] bg-white px-2 py-1 text-[0.7rem] text-[var(--ink-3)]"
                    >
                      {c}
                    </span>
                  ))}
                  <span className="rounded-md bg-[var(--fb-strong)] px-2 py-1 text-[0.7rem] font-medium text-white">
                    + any title
                  </span>
                </div>
              </Cell>
            </RevealItem>
          </div>
        </Reveal>
      </Band>

      {/* Where wins go: a label cell, then one cell per tool, the way Rankaria lists
          the engines it tracks. */}
      <Band>
        <div className="grid grid-cols-5 lg:grid-cols-[1.6fr_repeat(5,1fr)]">
          <div
            className={cn(
              "col-span-5 flex flex-col justify-center border-b px-6 py-6 sm:px-8 lg:col-span-1 lg:border-b-0 lg:border-r",
              LINE,
            )}
          >
            <h3 className="text-[1.05rem] font-semibold tracking-tight text-foreground">
              Wins go to your CRM
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-[var(--ink-3)]">
              Every win lands in HubSpot, Salesforce, or GoHighLevel automatically, with an alert in
              Slack, and you can run Vantera from Claude.
            </p>
          </div>
          {PLATFORMS.map(({ name, color, Mark }) => (
            <div
              key={name}
              className={cn(
                "group flex flex-col items-center justify-center gap-2.5 border-r py-6 last:border-r-0 sm:py-8",
                LINE,
              )}
            >
              <span
                aria-hidden
                className="grid size-9 place-items-center rounded-lg text-white shadow-sm transition-transform duration-300 group-hover:-translate-y-0.5"
                style={{ backgroundColor: color }}
              >
                <Mark className="size-[55%]" />
              </span>
              <span className="text-[0.8rem] font-medium text-foreground/80">{name}</span>
            </div>
          ))}
        </div>
      </Band>
    </section>
  );
}
