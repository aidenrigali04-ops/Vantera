"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus } from "lucide-react";
import { LandingHeading } from "./heading";
import { FAQ_ITEMS as QA } from "./faq-data";

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="relative py-24 sm:py-28 lg:py-32">
      <div className="mx-auto max-w-3xl px-6 lg:px-8">
        <LandingHeading
          eyebrow="FAQ"
          title="Questions, answered"
          subtitle="The questions people ask before they start — straight answers, no asterisks."
        />

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
