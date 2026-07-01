"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { LandingHeading } from "./heading";
import { IntentFeed } from "./showcase/intent-feed";
import { Qualification } from "./showcase/qualification";
import { AiDraft } from "./showcase/ai-draft";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

const ROWS = [
  {
    tag: "Intent",
    title: "Tracks user intent & action",
    body: "Our intent engine reads how people engage across LinkedIn — the topics, problems, and company triggers that signal a real need — and finds the buyers your service can genuinely help, right when they're looking. Not only the ones already engaging with you.",
    points: ["Reads overall engagement, not just who viewed you", "Matched to where your product solves a real problem"],
    visual: <IntentFeed />,
  },
  {
    tag: "Qualify",
    title: "Prospect qualification",
    body: "Prospects that don't match your services, or show zero intent, are filtered out automatically — leaving only the leads with the highest close rate. Each one is scored before anyone is pursued.",
    points: ["Fit, seniority & intent scored together", "Below-bar leads removed automatically"],
    visual: <Qualification />,
    flip: true,
  },
  {
    tag: "Personalize",
    title: "Personalized message copy",
    body: "Every message is written from the prospect's real activity — their signals, pain points, and the value you provide — in natural language, never a template. Then it waits for your sign-off.",
    points: ["Grounded in real signals, never a template", "Nothing sends without your approval"],
    visual: <AiDraft />,
  },
];

export function Showcase() {
  return (
    <section id="showcase" className="relative border-y border-[var(--hairline)] bg-[var(--tint)] py-24 sm:py-28 lg:py-32">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <LandingHeading
          eyebrow="The product"
          title={<>You can finally drive revenue with LinkedIn</>}
          subtitle="Our system analyzes your company and builds personalized prospect funneling and outreach tailored to your services and audience."
        />

        <div className="mt-20 flex flex-col gap-24 lg:gap-28">
          {ROWS.map((row) => (
            <div key={row.title} className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
              <motion.div
                initial={{ opacity: 0, x: row.flip ? 24 : -24 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-90px" }}
                transition={{ duration: 0.7, ease: EASE }}
                className={row.flip ? "lg:order-2" : ""}
              >
                <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-[var(--cyan-strong)]">
                  <span className="size-1.5 rounded-full bg-[var(--cyan)] shadow-[0_0_8px_rgba(11, 87, 171,0.7)]" />
                  {row.tag}
                </span>
                <h3 className="mt-4 text-[1.75rem] font-semibold leading-tight tracking-[-0.025em] text-foreground sm:text-[2.25rem]">
                  {row.title}
                </h3>
                <p className="mt-4 max-w-md text-[15px] leading-relaxed text-[var(--ink-3)] sm:text-lg">
                  {row.body}
                </p>
                <ul className="mt-6 flex flex-col gap-3">
                  {row.points.map((p) => (
                    <li key={p} className="flex items-start gap-2.5 text-[14px] text-[var(--ink-2)]">
                      <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-[var(--cyan-strong)] text-white">
                        <Check className="size-3" strokeWidth={3} />
                      </span>
                      {p}
                    </li>
                  ))}
                </ul>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-90px" }}
                transition={{ duration: 0.8, ease: EASE }}
                className={row.flip ? "lg:order-1" : ""}
              >
                {row.visual}
              </motion.div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
