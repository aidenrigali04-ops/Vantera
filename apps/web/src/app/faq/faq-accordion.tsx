"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus } from "lucide-react";
import { FAQ_ITEMS } from "@/components/landing/faq-data";

/**
 * FAQ accordion for the /faq page — the landing accordion pattern (white card,
 * hairline border, plus-to-close toggle) without a baked-in section heading, so
 * the page's <h1> (MarketingHeader) owns the hierarchy. Answers render the same
 * faq-data.ts text the FAQPage JSON-LD emits, so the two can never drift.
 */
export function FaqAccordion() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="flex flex-col gap-3">
      {FAQ_ITEMS.map((item, i) => {
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
  );
}
