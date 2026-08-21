"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { CTA_REASSURANCE } from "./claims";
import { MarkOnBlue, PixelField } from "./section-intro";

/**
 * S10 · Final CTA — "Fine. Show me." The concept's closing band: a rounded brand-blue
 * panel inside the container (not full-bleed), bookending the hero — same gradient,
 * same pixels, same URL-capture form, so the page closes exactly the way it opened.
 * No fabricated stats; the claims are the ones the page already made.
 */
export function FinalCta() {
  const router = useRouter();
  const [url, setUrl] = useState("");

  return (
    <section className="relative bg-white py-10 sm:py-14">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="relative overflow-hidden rounded-[28px] px-6 py-16 sm:px-10 sm:py-20 lg:py-24 [background:linear-gradient(180deg,#1877f2_0%,#1468da_74%,#1163d2_100%)]"
        >
          <PixelField />
          <div className="relative mx-auto flex max-w-2xl flex-col items-center text-center">
            <h2 className="text-[2.2rem] font-semibold leading-[1.12] tracking-[-0.035em] text-white sm:text-[2.9rem]">
              See who&rsquo;s waiting in <MarkOnBlue>your pipeline</MarkOnBlue>.
            </h2>
            <p className="mt-5 text-[16.5px] leading-relaxed text-white/80 sm:text-[18px]">
              15 minutes to deploy. Nothing sends without you.
            </p>

            {/* the hero's URL form, verbatim styling — one conversion pattern site-wide */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const site = url.trim();
                router.push(site ? `/signup?site=${encodeURIComponent(site)}` : "/signup");
              }}
              className="mt-9 flex w-full max-w-md items-center gap-2 rounded-full bg-white py-1.5 pl-5 pr-1.5 shadow-[0_16px_40px_-16px_rgba(3,22,58,0.55)] transition-shadow focus-within:shadow-[0_0_0_3px_rgba(255,255,255,0.35),0_16px_40px_-16px_rgba(3,22,58,0.55)]"
            >
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Enter your website URL"
                aria-label="Your website URL"
                className="min-w-0 flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-[var(--ink-4)]"
              />
              <button
                type="submit"
                className="group inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--fb-strong)] px-5 py-2.5 text-[14px] font-semibold text-white transition-all hover:bg-[#1461d1] active:scale-[0.98]"
              >
                Get started free
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </button>
            </form>

            <p className="mt-4 text-[13px] font-medium text-white/70">{CTA_REASSURANCE}</p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
