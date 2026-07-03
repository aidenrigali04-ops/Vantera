import type { Metadata } from "next";
import { MarketingShell } from "@/components/landing/marketing-shell";
import { MarketingHeader } from "@/components/landing/marketing-header";
import { SecondaryCta } from "@/components/landing/cta";
import { FAQ_ITEMS } from "@/components/landing/faq-data";
import { JsonLd, faqPageLd } from "@/lib/seo";
import { FaqAccordion } from "./faq-accordion";

export const metadata: Metadata = {
  title: "FAQ — Vantera",
  description:
    "How Vantera's LinkedIn automation works: account safety, message approval, in-market buyer discovery, CRM sync, results timelines, and pricing.",
  alternates: { canonical: "/faq" },
};

export default function FaqPage() {
  return (
    <MarketingShell>
      {/* FAQPage structured data — text matches the visible answers (both read faq-data.ts). */}
      <JsonLd data={faqPageLd(FAQ_ITEMS)} />

      <section className="px-6 pt-36 pb-10 sm:pt-40 lg:px-8">
        <MarketingHeader
          eyebrow="FAQ"
          title="Frequently asked questions"
          subtitle="Everything about how the agents work, how your account stays safe, and what you stay in control of."
        />
      </section>

      <section className="px-6 pb-24 sm:pb-28 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <FaqAccordion />

          <div className="mt-14 flex flex-col items-center gap-4 text-center">
            <p className="text-[14.5px] text-[var(--ink-3)]">
              Didn&apos;t find your answer? We read every message.
            </p>
            <SecondaryCta href="mailto:sales@vanterasystem.com?subject=Vantera%20question">
              Ask us directly
            </SecondaryCta>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
