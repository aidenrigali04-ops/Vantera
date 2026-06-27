import { MarketingShell } from "@/components/landing/marketing-shell";
import { ArticleBody } from "@/components/blog/article-body";
import type { LegalDoc } from "@/lib/legal";

/** Shared layout for /privacy and /terms — readable measure, last-updated stamp, prose body. */
export function LegalPage({ doc }: { doc: LegalDoc }) {
  return (
    <MarketingShell>
      <section className="px-6 pt-36 pb-24 sm:pt-40 lg:px-8">
        <div className="mx-auto max-w-2xl">
          <h1 className="text-[2.1rem] font-semibold leading-[1.1] tracking-[-0.03em] text-foreground sm:text-[2.5rem]">
            {doc.title}
          </h1>
          <p className="mt-3 text-[13.5px] text-[var(--ink-4)]">Last updated {doc.lastUpdated}</p>
          <p className="mt-7 text-[17px] leading-[1.78] text-[var(--ink-3)]">{doc.intro}</p>
          <ArticleBody blocks={doc.body} />
        </div>
      </section>
    </MarketingShell>
  );
}
