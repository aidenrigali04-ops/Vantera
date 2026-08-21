"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import type { FaqItem } from "@/components/landing/faq-data";

/**
 * Self-contained FAQ accordion for the /faq page. The page owns the <h1> (MarketingHeader),
 * so this renders only the interactive list. First item opens by default; chevron rotates,
 * body expands/collapses via AnimatePresence, rows split by a hairline divider on white cards.
 */
export function FaqAccordion({ items }: { items: FaqItem[] }) {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="flex flex-col gap-3">
      {items.map((item, i) => {
        const isOpen = open === i;
        return (
          <motion.div
            key={item.q}
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.45, delay: i * 0.04 }}
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
                <ChevronDown
                  className={`size-4 transition-transform duration-300 ${isOpen ? "rotate-180 text-white" : "text-[var(--ink-3)]"}`}
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
                  <div className="mx-5 border-t border-[var(--hairline)]" />
                  <p className="px-5 pt-4 pb-5 text-[14.5px] leading-relaxed text-[var(--ink-3)]">{item.a}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}
    </div>
  );
}
