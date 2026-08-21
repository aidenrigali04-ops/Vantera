import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { MarketingShell } from "@/components/landing/marketing-shell";
import { MarketingHeader } from "@/components/landing/marketing-header";
import { Reveal, RevealItem } from "@/components/landing/surface";
import { ToolCard } from "@/components/landing/tools/tool-card";
import { TOOLS, TOOL_CATEGORIES, LIVE_TOOLS } from "@/lib/tools/registry";
import { JsonLd, breadcrumbLd, SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Free LinkedIn Tools — Headlines, Outreach, Profile Analysis | Vantera",
  description:
    "A free suite of AI LinkedIn tools: generate headlines, About sections, connection requests, cold outreach, and Boolean searches, or analyze and roast your profile. No signup.",
  alternates: { canonical: "/tools" },
  keywords: [
    "free linkedin tools",
    "linkedin headline generator",
    "linkedin outreach generator",
    "linkedin profile analyzer",
    "ai linkedin tools",
  ],
};

export default function ToolsHubPage() {
  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Free LinkedIn Tools",
    itemListElement: LIVE_TOOLS.map((t, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: t.name,
      url: `${SITE_URL}/tools/${t.slug}`,
    })),
  };

  return (
    <MarketingShell>
      <JsonLd
        data={[
          breadcrumbLd([
            { name: "Home", url: SITE_URL },
            { name: "Free Tools", url: `${SITE_URL}/tools` },
          ]),
          itemList,
        ]}
      />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative px-6 pt-36 pb-12 sm:pt-40 lg:px-8">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[380px]"
          style={{
            background:
              "radial-gradient(44% 40% at 50% 0%, rgba(24,119,242,0.11) 0%, transparent 64%)",
          }}
        />
        <MarketingHeader
          eyebrow="Free Tools"
          title={
            <>
              Free LinkedIn tools that <span className="text-[var(--cyan-strong)]">actually help</span>
            </>
          }
          subtitle="Write headlines, About sections, and outreach that get replies — or analyze and roast your profile. AI-powered, no signup, unlimited within fair use."
        />
      </section>

      {/* ── Tools by category ────────────────────────────────────────────── */}
      <section className="relative pb-20">
        <div className="mx-auto max-w-6xl px-6 lg:px-8">
          {TOOL_CATEGORIES.map((category) => {
            const tools = TOOLS.filter((t) => t.category === category);
            if (tools.length === 0) return null;
            return (
              <div key={category} className="mt-14 first:mt-0">
                <h2 className="mb-6 flex items-center gap-3 text-[13px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-4)]">
                  {category}
                  <span className="h-px flex-1 bg-[var(--hairline)]" />
                </h2>
                <Reveal className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {tools.map((t) => (
                    <RevealItem key={t.slug} className="h-full">
                      <ToolCard tool={t} />
                    </RevealItem>
                  ))}
                </Reveal>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Closing CTA band ─────────────────────────────────────────────── */}
      <section className="relative border-t border-[var(--hairline)] bg-[var(--tint)] py-20 sm:py-24">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-72"
          style={{ background: "radial-gradient(50% 100% at 50% 0%, rgba(24, 119, 242,0.08), transparent 70%)" }}
        />
        <div className="relative mx-auto max-w-2xl px-6 text-center lg:px-8">
          <h2 className="text-[2rem] font-semibold leading-[1.08] tracking-[-0.02em] text-foreground sm:text-[2.5rem]">
            The tools are the free part.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-[16px] leading-relaxed text-[var(--ink-3)] sm:text-[17.5px]">
            Vantera runs the whole motion: find in-market buyers on LinkedIn, qualify them, and draft a
            message for each — you approve every send.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/signup"
              className="inline-flex items-center gap-1.5 rounded-full bg-[var(--fb-strong)] px-7 py-3.5 text-[15px] font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-[#1461d1] hover:shadow-[0_10px_30px_-8px_rgba(24,119,242,0.7)] active:scale-[0.98]"
            >
              Start free
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/#how-it-works"
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--hairline)] bg-white px-7 py-3.5 text-[15px] font-medium text-foreground shadow-[var(--shadow-sm)] transition-all hover:-translate-y-0.5 hover:border-[rgba(12,16,26,0.16)]"
            >
              See how it works
            </Link>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
