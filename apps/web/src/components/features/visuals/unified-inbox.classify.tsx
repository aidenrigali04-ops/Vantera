"use client";

import { useEffect, useId, useRef, useState } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { ArrowUp, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { LinkedinMark } from "@/components/landing/brand-glyphs";
import { LiveMeta, ScreenCard, ScreenNote } from "@/components/landing/feature-row";
import { ARRIVALS, Avatar, EASE, LABELS, type Label } from "./unified-inbox.parts";

/* The classifier's walk, from the cold end to the label it settles on. */
const SETTLE_ORDER: Label[] = ["Not interested", "Not now", "Question", "Interested"];

/** Benefit 1: a reply read and labelled the moment it lands, the label settling on
    "Interested" and the reply rising to the top. Replays each time it's scrolled to;
    with reduced motion it shows the settled label. */
export function ClassifyScreen() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.6 });
  const reduce = useReducedMotion();
  const pill = useId();
  const [step, setStep] = useState(SETTLE_ORDER.length - 1);

  // Each time it comes into view, start the walk again from the cold end.
  const [wasInView, setWasInView] = useState(inView);
  if (wasInView !== inView) {
    setWasInView(inView);
    if (inView && !reduce) setStep(0);
  }

  useEffect(() => {
    if (reduce || !inView) return;
    const ids = SETTLE_ORDER.slice(1).map((_, i) =>
      window.setTimeout(() => setStep(i + 1), 380 * (i + 1) + 300),
    );
    return () => ids.forEach((id) => window.clearTimeout(id));
  }, [inView, reduce]);

  const settled = step === SETTLE_ORDER.length - 1;
  const chosen = SETTLE_ORDER[step];

  return (
    <div ref={ref}>
      <ScreenCard
        title="New reply"
        meta={
          settled ? (
            <span className="inline-flex items-center gap-1 text-[0.68rem] font-medium text-[#13824a]">
              <Check className="size-3" strokeWidth={3} />
              Classified
            </span>
          ) : (
            <LiveMeta>Classifying</LiveMeta>
          )
        }
      >
        <div className="flex items-start gap-2.5 rounded-lg border border-[var(--hairline)] bg-white px-3 py-2.5">
          <Avatar t={ARRIVALS[0]} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-xs font-medium text-foreground">
              {ARRIVALS[0].name}
              <span className="inline-flex items-center gap-1 text-[0.62rem] font-normal text-[var(--ink-4)]">
                via <LinkedinMark className="size-2.5 text-[var(--fb)]" /> {ARRIVALS[0].via}
              </span>
            </p>
            <p className="mt-1 text-[0.72rem] leading-relaxed text-[var(--ink-2)]">“{ARRIVALS[0].reply}”</p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {LABELS.map((l) => {
            const on = l === chosen;
            return (
              <span
                key={l}
                className={cn(
                  "relative inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[0.68rem] font-medium transition-colors duration-200",
                  on ? "border-transparent text-[var(--fb-strong)]" : "border-[var(--hairline)] bg-white text-[var(--ink-3)]",
                )}
              >
                {on && (
                  <motion.span
                    layoutId={pill}
                    transition={{ type: "spring", stiffness: 420, damping: 32 }}
                    className="absolute inset-0 rounded-md bg-[var(--cyan-tint)] shadow-[inset_0_0_0_1px_rgba(22,111,229,0.22)]"
                  />
                )}
                <span className="relative inline-flex items-center gap-1">
                  {on && settled && <Check className="size-3" strokeWidth={3} />}
                  {l}
                </span>
              </span>
            );
          })}
        </div>

        <motion.div
          initial={false}
          animate={{ opacity: settled ? 1 : 0, y: settled ? 0 : 4 }}
          transition={{ duration: 0.35, ease: EASE }}
        >
          <ScreenNote>
            <span className="inline-flex items-center gap-1.5">
              <ArrowUp className="size-3 text-[var(--fb-strong)]" strokeWidth={2.6} />
              Interested · moved to the top of your inbox
            </span>
          </ScreenNote>
        </motion.div>
      </ScreenCard>
    </div>
  );
}
