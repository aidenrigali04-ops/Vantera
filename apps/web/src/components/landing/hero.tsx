"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Accent } from "./heading";
import { HeroDeck } from "./hero-deck";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

function rise(delay: number) {
  return {
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.7, delay, ease: EASE },
  };
}

export function Hero() {
  const router = useRouter();
  const [url, setUrl] = useState("");

  return (
    <section id="top" className="relative overflow-hidden pt-36 pb-20 sm:pt-40 lg:pb-28">
      {/* subtle cyan ambience — a single soft wash, top-right, masked so it never reads as a glow blob */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(48% 42% at 78% 6%, rgba(11, 87, 171,0.16) 0%, transparent 62%), radial-gradient(40% 36% at 12% 0%, rgba(11, 87, 171,0.06) 0%, transparent 60%)",
        }}
      />

      <div className="mx-auto w-full max-w-6xl px-6 lg:px-8">
        <div className="grid items-center gap-14 lg:grid-cols-[1.04fr_1fr] lg:gap-12">
          {/* LEFT — content */}
          <div className="max-w-xl">
            <motion.div {...rise(0)}>
              <span className="inline-flex items-center gap-2 rounded-full border border-[var(--hairline)] bg-white py-1 pl-1.5 pr-3 text-[12.5px] font-medium text-[var(--ink-2)] shadow-[var(--shadow-sm)]">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--cyan-tint)] px-2 py-0.5 text-[11px] font-semibold text-[var(--cyan-strong)]">
                  <span className="size-1.5 rounded-full bg-[var(--cyan)] shadow-[0_0_8px_rgba(11, 87, 171,0.9)]" />
                  Live
                </span>
                Event in San Francisco
              </span>
            </motion.div>

            <motion.h1
              {...rise(0.07)}
              className="mt-6 text-[2.9rem] font-semibold leading-[1.02] tracking-[-0.04em] text-foreground sm:text-[3.6rem] lg:text-[4rem]"
            >
              Turn intent into <Accent>revenue</Accent> on LinkedIn
            </motion.h1>

            <motion.p
              {...rise(0.15)}
              className="mt-6 max-w-lg text-[17px] font-normal leading-relaxed text-[var(--ink-3)] sm:text-[19px]"
            >
              The smartest LinkedIn outreach automation — agents that find in-market buyers, qualify
              them, and write every message from real activity. You approve every send.
            </motion.p>

            <motion.form
              {...rise(0.23)}
              onSubmit={(e) => {
                e.preventDefault();
                router.push("/signup");
              }}
              className="mt-8 flex w-full max-w-md items-center gap-2 rounded-full border border-[var(--hairline)] bg-white py-1.5 pl-5 pr-1.5 shadow-[var(--shadow-card)]"
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
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#0a0c12] px-5 py-2.5 text-[14px] font-medium text-white transition-all hover:shadow-[0_8px_24px_-8px_rgba(11, 87, 171,0.6)]"
              >
                Start free
                <ArrowRight className="size-4" />
              </button>
            </motion.form>

            <motion.p {...rise(0.31)} className="mt-3.5 text-[13px] text-[var(--ink-4)]">
              No credit card required · Free 3-day trial · You approve every message
            </motion.p>
          </div>

          {/* RIGHT — sleek dark product panel (ready to swap for a generated hero image) */}
          <motion.div
            initial={{ opacity: 0, y: 22, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.9, delay: 0.2, ease: EASE }}
          >
            <HeroDeck />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
