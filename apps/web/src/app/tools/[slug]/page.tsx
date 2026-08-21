import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, PencilLine, Sparkles, Copy, Check } from "lucide-react";
import { MarketingShell } from "@/components/landing/marketing-shell";
import { MarketingHeader } from "@/components/landing/marketing-header";
import { Reveal, RevealItem } from "@/components/landing/surface";
import { ToolRunner } from "@/components/landing/tools/tool-runner";
import { ToolCard } from "@/components/landing/tools/tool-card";
import { LIVE_TOOLS, getLiveTool, getTool } from "@/lib/tools/registry";
import { JsonLd, breadcrumbLd, faqPageLd, SITE_URL } from "@/lib/seo";

export function generateStaticParams() {
  return LIVE_TOOLS.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const tool = getLiveTool(slug);
  if (!tool) return {};
  return {
    title: tool.metaTitle,
    description: tool.metaDescription,
    alternates: { canonical: `/tools/${tool.slug}` },
    keywords: tool.keywords,
  };
}

const STEPS = [
  { icon: PencilLine, title: "Describe it", body: "Fill in a few quick fields — the more specific you are, the sharper the output." },
  { icon: Sparkles, title: "Generate", body: "AI writes several distinct options in a plain, human voice — no buzzwords, no filler." },
  { icon: Copy, title: "Copy & refine", body: "Grab the best one, tweak it to sound like you, and put it to work. Regenerate anytime." },
] as const;

export default async function ToolPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tool = getLiveTool(slug);
  if (!tool) notFound();

  const related = tool.related.map(getTool).filter((t): t is NonNullable<typeof t> => Boolean(t));

  const webAppLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: tool.name,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: `${SITE_URL}/tools/${tool.slug}`,
    description: tool.metaDescription,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    provider: { "@type": "Organization", name: "Vantera", url: SITE_URL },
  };

  return (
    <MarketingShell>
      <JsonLd
        data={[
          breadcrumbLd([
            { name: "Home", url: SITE_URL },
            { name: "Free Tools", url: `${SITE_URL}/tools` },
            { name: tool.name, url: `${SITE_URL}/tools/${tool.slug}` },
          ]),
          faqPageLd(tool.faqs.map((f) => ({ q: f.q, a: f.a }))),
          webAppLd,
        ]}
      />

      {/* ── Hero + runner ────────────────────────────────────────────────── */}
      <section className="relative px-6 pt-36 pb-14 sm:pt-40 lg:px-8">
        {/* soft blue ambience behind the hero */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px]"
          style={{
            background:
              "radial-gradient(46% 42% at 50% 0%, rgba(24,119,242,0.11) 0%, transparent 64%), radial-gradient(30% 30% at 82% 8%, rgba(24,119,242,0.05) 0%, transparent 60%)",
          }}
        />

        <MarketingHeader eyebrow={tool.eyebrow} title={tool.name} subtitle={tool.tagline} />

        <ul className="mx-auto mt-7 flex max-w-xl flex-wrap items-center justify-center gap-2.5">
          {["Free forever", "No signup", "Written by AI", "Instant"].map((c) => (
            <li
              key={c}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--hairline)] bg-white px-3 py-1.5 text-[12.5px] font-medium text-[var(--ink-2)] shadow-[var(--shadow-sm)]"
            >
              <Check className="size-3.5 text-[var(--cyan-strong)]" strokeWidth={2.6} />
              {c}
            </li>
          ))}
        </ul>

        <div className="mt-11">
          <ToolRunner
            slug={tool.slug}
            cta={tool.cta}
            output={tool.output}
            outputHeading={tool.outputHeading}
            fields={tool.fields}
          />
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section className="relative border-y border-[var(--hairline)] bg-[var(--tint)] py-16 sm:py-20">
        <div className="mx-auto max-w-5xl px-6 lg:px-8">
          <h2 className="text-center text-[1.6rem] font-semibold tracking-[-0.02em] text-foreground sm:text-[1.9rem]">
            How it works
          </h2>
          <Reveal className="mt-12 grid gap-5 sm:grid-cols-3">
            {STEPS.map((s, i) => (
              <RevealItem
                key={s.title}
                className="rounded-2xl border border-[var(--hairline)] bg-white p-6 shadow-[var(--shadow-sm)]"
              >
                <div className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-xl bg-[var(--cyan-tint)] text-[var(--cyan-strong)]">
                    <s.icon className="size-5" />
                  </span>
                  <span className="font-mono text-[12px] font-semibold tracking-[0.14em] text-[var(--ink-4)]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
                <h3 className="mt-4 text-[1.05rem] font-semibold tracking-[-0.01em] text-foreground">{s.title}</h3>
                <p className="mt-2 text-[14.5px] leading-relaxed text-[var(--ink-3)]">{s.body}</p>
              </RevealItem>
            ))}
          </Reveal>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <section className="relative py-16 sm:py-20">
        <div className="mx-auto max-w-3xl px-6 lg:px-8">
          <h2 className="text-center text-[1.6rem] font-semibold tracking-[-0.02em] text-foreground sm:text-[1.9rem]">
            Questions, answered
          </h2>
          <div className="mt-10 space-y-4">
            {tool.faqs.map((f) => (
              <div
                key={f.q}
                className="rounded-2xl border border-[var(--hairline)] bg-white p-6 shadow-[var(--shadow-sm)]"
              >
                <h3 className="text-[1.02rem] font-semibold tracking-[-0.01em] text-foreground">{f.q}</h3>
                <p className="mt-2.5 text-[14.5px] leading-relaxed text-[var(--ink-3)]">{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Related tools ────────────────────────────────────────────────── */}
      {related.length > 0 && (
        <section className="relative border-t border-[var(--hairline)] py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-6 lg:px-8">
            <div className="flex items-end justify-between gap-4">
              <h2 className="text-[1.6rem] font-semibold tracking-[-0.02em] text-foreground sm:text-[1.9rem]">
                More free tools
              </h2>
              <Link
                href="/tools"
                className="inline-flex items-center gap-1 text-[14px] font-medium text-[var(--ink-4)] transition-colors hover:text-[var(--cyan-strong)]"
              >
                See all
                <ArrowRight className="size-3.5" />
              </Link>
            </div>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((t) => (
                <ToolCard key={t.slug} tool={t} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── CTA band ─────────────────────────────────────────────────────── */}
      <section className="relative border-t border-[var(--hairline)] bg-[var(--tint)] py-20 sm:py-24">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-72"
          style={{ background: "radial-gradient(50% 100% at 50% 0%, rgba(24, 119, 242,0.08), transparent 70%)" }}
        />
        <div className="relative mx-auto max-w-2xl px-6 text-center lg:px-8">
          <h2 className="text-[2rem] font-semibold leading-[1.08] tracking-[-0.02em] text-foreground sm:text-[2.4rem]">
            Put your whole LinkedIn motion on autopilot.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-[16px] leading-relaxed text-[var(--ink-3)] sm:text-[17.5px]">
            This tool writes one message at a time. Vantera&rsquo;s agents find in-market buyers and draft a
            personal message for each — you approve every send.
          </p>
          <Link
            href="/signup"
            className="mt-9 inline-flex items-center gap-1.5 rounded-full bg-[var(--fb-strong)] px-7 py-3.5 text-[15px] font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-[#1461d1] hover:shadow-[0_10px_30px_-8px_rgba(24,119,242,0.7)] active:scale-[0.98]"
          >
            Start free
            <ArrowRight className="size-4" />
          </Link>
          <p className="mt-5 text-[13px] text-[var(--ink-4)]">Free 3-day trial · Live in minutes</p>
        </div>
      </section>
    </MarketingShell>
  );
}
