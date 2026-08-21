import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { MarketingShell } from "@/components/landing/marketing-shell";
import { MarketingHeader } from "@/components/landing/marketing-header";
import { FAQ_ITEMS } from "@/components/landing/faq-data";
import { JsonLd, breadcrumbLd, faqPageLd } from "@/lib/seo";
import { FaqAccordion } from "./faq-accordion";

export const metadata: Metadata = {
  title: "FAQ — Vantera LinkedIn Automation",
  description:
    "Answers on how Vantera works: account safety, message approval, in-market buyer detection, multi-sender distribution, CRM sync, timelines, and pricing.",
  alternates: { canonical: "/faq" },
};

export default function FaqPage() {
  return (
    <MarketingShell>
      <JsonLd
        data={[
          breadcrumbLd([
            { name: "Home", url: "/" },
            { name: "FAQ", url: "/faq" },
          ]),
          faqPageLd(FAQ_ITEMS),
        ]}
      />

      <section className="px-6 pt-36 pb-10 sm:pt-40 lg:px-8">
        <MarketingHeader
          eyebrow="FAQ"
          title="Frequently asked questions"
          subtitle="Everything you need to know about how Vantera runs your LinkedIn — safely, on your approval."
        />
      </section>

      <section className="relative px-6 pb-16 sm:pb-20 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <FaqAccordion items={FAQ_ITEMS} />

          <div className="mt-14 flex flex-col items-center gap-3 text-center">
            <p className="text-[14.5px] text-[var(--ink-3)]">Still have a question?</p>
            <Link
              href="/signup"
              className="inline-flex items-center gap-1.5 rounded-full bg-[#0a0c12] px-5 py-2.5 text-[14px] font-medium text-white transition-all hover:shadow-[0_8px_24px_-8px_rgba(24, 119, 242,0.6)]"
            >
              Start free
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
