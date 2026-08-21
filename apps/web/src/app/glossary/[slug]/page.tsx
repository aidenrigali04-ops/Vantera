import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, BookOpen, Check, ChevronRight, Clock, Lightbulb, Wrench, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { MarketingShell } from "@/components/landing/marketing-shell";
import { CARD_INTERACTIVE } from "@/components/landing/surface";
import { FaqAccordion } from "@/app/faq/faq-accordion";
import {
  CategoryBadge,
  CategoryIcon,
  DifficultyBadge,
} from "@/components/glossary/glossary-ui";
import { ReadingProgress, TermActions, TermToc } from "@/components/glossary/term-detail-client";
import { GlossaryCta } from "@/components/glossary/glossary-cta";
import { JsonLd, breadcrumbLd, faqPageLd, SITE_URL } from "@/lib/seo";
import {
  categoryLabel,
  getAllTerms,
  getTermBySlug,
  resolveRelated,
  type GlossaryTerm,
} from "@/lib/glossary";

export function generateStaticParams() {
  return getAllTerms().map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const term = getTermBySlug(slug);
  if (!term) return {};
  const url = `${SITE_URL}/glossary/${slug}`;
  const title = `${term.term} — Definition & Guide | Vantera Glossary`;
  return {
    title,
    description: term.summary,
    alternates: { canonical: `/glossary/${slug}` },
    openGraph: { title, description: term.summary, url, type: "article" },
    keywords: [term.term, ...(term.aka ?? []), categoryLabel(term.category)],
  };
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[Number(m) - 1] ?? ""} ${Number(d)}, ${y}`;
}

export default async function TermPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const term = getTermBySlug(slug);
  if (!term) notFound();

  const related = resolveRelated(term);
  const url = `${SITE_URL}/glossary/${slug}`;

  const sections: { id: string; label: string }[] = [
    { id: "definition", label: "Definition" },
    ...(term.whyItMatters ? [{ id: "why", label: "Why it matters" }] : []),
    ...(term.howItWorks ? [{ id: "how", label: "How it works" }] : []),
    ...(term.mistakes ? [{ id: "mistakes", label: "Common mistakes" }] : []),
    ...(term.bestPractices ? [{ id: "best-practices", label: "Best practices" }] : []),
    ...(term.tools ? [{ id: "tools", label: "Tools" }] : []),
    ...(term.faqs ? [{ id: "faqs", label: "FAQs" }] : []),
    ...(related.length ? [{ id: "related", label: "Related terms" }] : []),
  ];

  const definedTermLd = {
    "@context": "https://schema.org",
    "@type": "DefinedTerm",
    name: term.term,
    description: term.definition,
    url,
    inDefinedTermSet: { "@type": "DefinedTermSet", name: "Vantera Glossary", url: `${SITE_URL}/glossary` },
  };
  const articleLd = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: `${term.term}: definition, why it matters, and how it works`,
    description: term.summary,
    datePublished: term.updated,
    dateModified: term.updated,
    author: { "@type": "Organization", name: "Vantera", url: SITE_URL },
    publisher: {
      "@type": "Organization",
      name: "Vantera",
      logo: { "@type": "ImageObject", url: `${SITE_URL}/icon.svg` },
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    about: { "@type": "DefinedTerm", name: term.term },
    keywords: [term.term, ...(term.aka ?? []), categoryLabel(term.category)].join(", "),
    timeRequired: `PT${term.readingTime}M`,
  };

  return (
    <MarketingShell>
      <ReadingProgress />
      <JsonLd
        data={[
          breadcrumbLd([
            { name: "Home", url: SITE_URL },
            { name: "Glossary", url: `${SITE_URL}/glossary` },
            { name: term.term, url },
          ]),
          definedTermLd,
          articleLd,
          ...(term.faqs ? [faqPageLd(term.faqs)] : []),
        ]}
      />

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden px-6 pt-32 pb-10 sm:pt-36 lg:px-8">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{ background: "radial-gradient(46% 40% at 50% -6%, rgba(24,119,242,0.12) 0%, transparent 60%)" }}
        />
        <div className="mx-auto max-w-3xl">
          {/* breadcrumbs */}
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-[12.5px] text-[var(--ink-4)]">
            <Link href="/glossary" className="transition-colors hover:text-foreground">
              Glossary
            </Link>
            <ChevronRight className="size-3.5" />
            <Link href="/glossary" className="transition-colors hover:text-foreground">
              {categoryLabel(term.category)}
            </Link>
            <ChevronRight className="size-3.5" />
            <span className="text-[var(--ink-2)]">{term.term}</span>
          </nav>

          <div className="mt-6 flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-lg bg-[var(--cyan-tint)] text-[var(--cyan-strong)] ring-1 ring-inset ring-[var(--cyan-line)]">
              <CategoryIcon category={term.category} className="size-4" />
            </span>
            <CategoryBadge label={categoryLabel(term.category)} />
            <DifficultyBadge difficulty={term.difficulty} />
          </div>

          <h1 className="mt-4 text-[2.4rem] font-semibold leading-[1.08] tracking-[-0.035em] text-foreground sm:text-[3rem]">
            {term.term}
          </h1>
          {term.aka && term.aka.length > 0 && (
            <p className="mt-2 text-[14px] text-[var(--ink-4)]">Also known as: {term.aka.join(", ")}</p>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-[var(--ink-4)]">
            <span className="inline-flex items-center gap-1.5">
              <span className="grid size-5 place-items-center rounded-full bg-foreground text-[9px] font-bold text-white">V</span>
              Vantera Editorial
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="size-3.5" strokeWidth={2.2} />
              {term.readingTime} min read
            </span>
            <span>Updated {fmtDate(term.updated)}</span>
          </div>

          <div className="mt-6">
            <TermActions term={term.term} />
          </div>
        </div>
      </section>

      {/* ── Body: article + sticky TOC ───────────────────────────────── */}
      <section className="px-6 pb-8 lg:px-8">
        <div className="mx-auto max-w-3xl lg:grid lg:max-w-5xl lg:grid-cols-[minmax(0,1fr)_196px] lg:gap-12">
          <article className="min-w-0">
            {/* Definition — the concise, quotable answer up top (AEO) */}
            <Block id="definition" title="Definition">
              <div className="rounded-2xl border border-[var(--cyan-line)] bg-[var(--cyan-tint)]/40 p-5 sm:p-6">
                <p className="text-[16.5px] leading-relaxed text-[var(--ink-2)] sm:text-[17.5px]">{term.definition}</p>
              </div>
            </Block>

            {term.whyItMatters && (
              <Block id="why" title="Why it matters">
                <p className="text-[15.5px] leading-relaxed text-[var(--ink-3)]">{term.whyItMatters}</p>
              </Block>
            )}

            {term.howItWorks && (
              <Block id="how" title="How it works">
                <ol className="flex flex-col gap-3">
                  {term.howItWorks.map((step, i) => (
                    <li key={i} className="flex gap-3.5">
                      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[var(--fb-tint)] text-[12px] font-bold tabular-nums text-[var(--cyan-strong)] ring-1 ring-inset ring-[var(--cyan-line)]">
                        {i + 1}
                      </span>
                      <span className="pt-0.5 text-[15px] leading-relaxed text-[var(--ink-3)]">{step}</span>
                    </li>
                  ))}
                </ol>
              </Block>
            )}

            {term.mistakes && (
              <Block id="mistakes" title="Common mistakes">
                <ul className="flex flex-col gap-2.5">
                  {term.mistakes.map((m, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-[rgba(12,16,26,0.05)] text-[var(--ink-4)]">
                        <X className="size-3.5" strokeWidth={2.4} />
                      </span>
                      <span className="text-[15px] leading-relaxed text-[var(--ink-3)]">{m}</span>
                    </li>
                  ))}
                </ul>
              </Block>
            )}

            {term.bestPractices && (
              <Block id="best-practices" title="Best practices">
                <ul className="flex flex-col gap-2.5">
                  {term.bestPractices.map((b, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-[#eafaf0] text-[#1a9e4b]">
                        <Check className="size-3.5" strokeWidth={2.8} />
                      </span>
                      <span className="text-[15px] leading-relaxed text-[var(--ink-3)]">{b}</span>
                    </li>
                  ))}
                </ul>
              </Block>
            )}

            {term.tools && (
              <Block id="tools" title="Tools">
                <div className="flex flex-wrap gap-2">
                  {term.tools.map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[var(--hairline)] bg-white px-3 py-1.5 text-[13px] font-medium text-[var(--ink-2)] shadow-[var(--shadow-sm)]"
                    >
                      <Wrench className="size-3.5 text-[var(--ink-4)]" />
                      {t}
                    </span>
                  ))}
                </div>
              </Block>
            )}

            {term.faqs && (
              <Block id="faqs" title="Frequently asked questions">
                <FaqAccordion items={term.faqs} />
              </Block>
            )}

            {related.length > 0 && (
              <Block id="related" title="Related terms">
                <div className="grid gap-4 sm:grid-cols-2">
                  {related.map((r) => (
                    <RelatedCard key={r.slug} term={r} />
                  ))}
                </div>
              </Block>
            )}

            {term.furtherReading && term.furtherReading.length > 0 && (
              <Block id="further" title="Further reading">
                <ul className="flex flex-col gap-2">
                  {term.furtherReading.map((f) => (
                    <li key={f.href}>
                      <Link href={f.href} className="inline-flex items-center gap-1.5 text-[14.5px] font-medium text-[var(--cyan-strong)] hover:text-[var(--fb-strong)]">
                        <BookOpen className="size-4" />
                        {f.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </Block>
            )}

            {/* inline learning-to-action nudge */}
            <div className="mt-10 flex items-start gap-3 rounded-2xl border border-[var(--hairline)] bg-[var(--tint)] p-5">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--cyan-tint)] text-[var(--cyan-strong)] ring-1 ring-inset ring-[var(--cyan-line)]">
                <Lightbulb className="size-5" strokeWidth={1.9} />
              </span>
              <p className="text-[14px] leading-relaxed text-[var(--ink-2)]">
                <span className="font-semibold text-foreground">See it in practice.</span> Vantera puts concepts like
                this to work — qualifying in-market buyers and drafting outreach from real activity, on your approval.{" "}
                <Link href="/signup" className="font-semibold text-[var(--cyan-strong)] hover:text-[var(--fb-strong)]">
                  Start free →
                </Link>
              </p>
            </div>
          </article>

          {/* sticky TOC */}
          <aside className="hidden self-start lg:sticky lg:top-28 lg:block">
            <TermToc sections={sections} />
          </aside>
        </div>
      </section>

      <GlossaryCta />
    </MarketingShell>
  );
}

function Block({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-28 border-t border-[var(--hairline)] py-8 first:border-t-0 first:pt-0">
      <h2 className="mb-4 text-[20px] font-semibold tracking-[-0.02em] text-foreground sm:text-[22px]">{title}</h2>
      {children}
    </section>
  );
}

function RelatedCard({ term }: { term: GlossaryTerm }) {
  return (
    <Link href={`/glossary/${term.slug}`} className={cn(CARD_INTERACTIVE, "group flex flex-col p-4")}>
      <div className="flex items-center justify-between">
        <CategoryBadge label={categoryLabel(term.category)} />
        <ArrowUpRight className="size-4 text-[var(--ink-4)] transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[var(--cyan-strong)]" />
      </div>
      <h3 className="mt-3 text-[15px] font-semibold tracking-[-0.01em] text-foreground">{term.term}</h3>
      <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-[var(--ink-4)]">{term.summary}</p>
    </Link>
  );
}
