"use client";

import { motion } from "framer-motion";
import { X } from "lucide-react";
import { SectionHeading } from "./section-heading";

/**
 * Personalization, shown not told. These are real entries from the outreach
 * humanizer's banned-phrase list — proof, not a claim. A draft that uses one (or
 * makes an ungrounded claim) is flagged before it ever reaches the review queue.
 */
const BANNED = [
  "I hope this finds you well",
  "I came across your…",
  "just checking in",
  "game-changer",
  "supercharge",
  "big fan of",
];

export function NoVariables() {
  return (
    <section className="relative px-4 py-24">
      <SectionHeading
        eyebrow="No variables"
        title="The opposite of mail-merge."
        subtitle="Vantera writes from what's true about each prospect — then refuses to sound like a bot."
      />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.6 }}
        className="mx-auto mt-14 max-w-3xl rounded-2xl border border-white/[0.16] bg-white/[0.06] shadow-lg shadow-black/25 p-6 sm:p-8"
      >
        <p className="text-sm text-muted-foreground">These never make it out the door:</p>
        <div className="mt-4 flex flex-wrap gap-2.5">
          {BANNED.map((phrase) => (
            <span
              key={phrase}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-muted-foreground/70"
            >
              <X className="size-3.5 shrink-0 text-muted-foreground/50" />
              <span className="line-through decoration-muted-foreground/30">{phrase}</span>
            </span>
          ))}
        </div>
        <p className="mt-6 border-t border-white/5 pt-5 text-sm text-foreground/80">
          And if a message can&apos;t ground a claim in real data, it&apos;s flagged before you ever
          see it — let alone send it.
        </p>
      </motion.div>
    </section>
  );
}
