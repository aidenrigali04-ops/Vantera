"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus } from "lucide-react";
import { LandingHeading } from "./heading";

const QA = [
  {
    q: "How does Vantera find the right leads?",
    a: "It combines ICP-fit discovery with LinkedIn intent signals — the topics people engage with, the problems they post about, and company triggers that show a real need — then scores every prospect on fit, seniority, and intent. Only the ones that clear the bar are ever pursued.",
  },
  {
    q: "Will this get my LinkedIn account restricted?",
    a: "No. Outreach paces like a human, spreads across your connected senders, and stays under hard safety ceilings you can't override below the safe threshold. Protecting your account is built into the scheduler, not left to chance.",
  },
  {
    q: "Do messages send automatically?",
    a: "Never without you. Agents draft a personal message for each qualified lead and queue it in your review. You approve, edit, or skip — nothing goes out until you sign off.",
  },
  {
    q: "Is it just spammy templates?",
    a: "The opposite. Every message is written from the prospect's real activity and grounded in genuine signals — no {{variables}}, no copy-paste. A humanizer check blocks anything that reads templated before it reaches your queue.",
  },
  {
    q: "Can I change or cancel my plan anytime?",
    a: "Yes. Upgrade, downgrade, or cancel whenever — plans scale with your revenue goal, not a long-term contract, and add-ons adjust per unit from billing.",
  },
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="relative py-24 sm:py-28 lg:py-32">
      <div className="mx-auto max-w-3xl px-6 lg:px-8">
        <LandingHeading eyebrow="FAQ" title="Frequently asked questions" />

        <div className="mt-12 flex flex-col gap-3">
          {QA.map((item, i) => {
            const isOpen = open === i;
            return (
              <motion.div
                key={item.q}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.45, delay: i * 0.05 }}
                className="overflow-hidden rounded-2xl border border-[var(--hairline)] bg-white shadow-[var(--shadow-sm)]"
              >
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                  aria-expanded={isOpen}
                >
                  <span className="text-[15.5px] font-semibold text-foreground">{item.q}</span>
                  <span
                    className={`grid size-7 shrink-0 place-items-center rounded-full transition-colors ${isOpen ? "bg-[#0a0b0d]" : "bg-[#f1f2f4]"}`}
                  >
                    <Plus
                      className={`size-4 transition-transform duration-300 ${isOpen ? "rotate-45 text-white" : "text-[var(--ink-3)]"}`}
                    />
                  </span>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <p className="px-5 pb-5 text-[14.5px] leading-relaxed text-[var(--ink-3)]">{item.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
