"use client";

import { motion } from "framer-motion";
import { RevealItem } from "./surface";
import {
  HubSpotLogo,
  IntuitLogo,
  NaverLogo,
  OktaLogo,
  ScribdLogo,
  ZendeskLogo,
} from "./brand-logos";

/**
 * "Powering revenue for modern teams" — a social-proof logo cloud. The marks sit in
 * one cohesive monochrome grey so the row reads as a calm set (the label never
 * competes with the brands), and each lights to its own colour on hover. Sizes are
 * optically balanced per-mark rather than set to a single height.
 */
const LOGOS = [
  { name: "HubSpot", color: "#ff5c35", node: <HubSpotLogo className="h-[27px] w-auto" /> },
  { name: "Intuit", color: "#236cff", node: <IntuitLogo className="h-[19px] w-auto" /> },
  { name: "NAVER", color: "#03c75a", node: <NaverLogo className="text-[22px]" /> },
  { name: "Okta", color: "#0a0c12", node: <OktaLogo className="h-[26px] w-auto" /> },
  { name: "Scribd", color: "#0a0c12", node: <ScribdLogo className="h-[22px] w-auto" /> },
  { name: "Zendesk", color: "#0a0c12", node: <ZendeskLogo className="h-[19px] w-auto" /> },
];

export function TrustStrip() {
  return (
    <section className="relative border-t border-[var(--hairline)] bg-[var(--tint)] py-12 lg:py-9">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        {/* Above the fold on lg, so reveal on load rather than on scroll-into-view. */}
        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-center font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--ink-4)]"
        >
          Powering revenue for modern teams
        </motion.p>

        <motion.div
          initial="hidden"
          animate="show"
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08, delayChildren: 0.18 } } }}
          className="mt-10 flex flex-wrap items-center justify-center gap-x-10 gap-y-8 sm:gap-x-12 lg:mt-7 lg:gap-x-16"
        >
          {LOGOS.map((l) => (
            <RevealItem
              key={l.name}
              style={{ "--logo": l.color } as React.CSSProperties}
              className="flex items-center text-[#8e96a1] transition-colors duration-300 hover:text-[var(--logo)]"
            >
              {l.node}
            </RevealItem>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
