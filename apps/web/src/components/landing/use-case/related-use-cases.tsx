import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { CARD, CARD_INTERACTIVE } from "@/components/landing/surface";
import { USE_CASES } from "./registry";
import { UseCaseGlyph } from "./icons";
import type { UseCaseSummary } from "./types";

/**
 * Sibling cross-links — internal linking between the persona pages (SEO topical clustering)
 * and a way for a visitor on the wrong page to find theirs. Live pages link; unshipped ones
 * read "Coming soon" and don't link. Pass `currentSlug` to omit the current page. Server
 * component; also reused by the /use-cases hub (pass no `currentSlug`).
 */
export function RelatedUseCases({
  currentSlug,
  heading = "Built for your team, too",
  tint = true,
}: {
  currentSlug?: string;
  heading?: string;
  tint?: boolean;
}) {
  const items = USE_CASES.filter((u) => u.slug !== currentSlug);
  if (items.length === 0) return null;

  return (
    <section className={cn("relative border-t border-[var(--hairline)] py-20 sm:py-24", tint && "bg-[var(--tint)]")}>
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-[1.5rem] font-semibold tracking-[-0.02em] text-foreground sm:text-[1.8rem]">
            {heading}
          </h2>
          <Link
            href="/use-cases"
            className="hidden shrink-0 items-center gap-1 text-[13.5px] font-semibold text-[var(--cyan-strong)] hover:text-[var(--fb-strong)] sm:inline-flex"
          >
            All use cases
            <ArrowRight className="size-3.5" />
          </Link>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((u) => (
            <UseCaseCard key={u.slug} item={u} />
          ))}
        </div>
      </div>
    </section>
  );
}

export function UseCaseCard({ item }: { item: UseCaseSummary }) {
  const inner = (
    <>
      <div className="flex items-center justify-between">
        <span className="grid size-11 place-items-center rounded-xl bg-[var(--cyan-tint)] text-[var(--cyan-strong)] ring-1 ring-inset ring-[var(--cyan-line)] transition-transform duration-300 group-hover:scale-105">
          <UseCaseGlyph name={item.icon} className="size-5" />
        </span>
        {item.live ? (
          <span className="inline-flex items-baseline gap-1.5 text-right">
            <span className="text-[1.1rem] font-semibold leading-none tracking-[-0.02em] text-foreground">
              {item.metric.value}
            </span>
            <span className="text-[11px] font-medium text-[var(--ink-4)]">{item.metric.label}</span>
          </span>
        ) : (
          <span className="rounded-full bg-[rgba(12,16,26,0.05)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--ink-4)]">
            Coming soon
          </span>
        )}
      </div>

      <h3 className="mt-5 text-[16px] font-semibold tracking-[-0.01em] text-foreground">{item.persona}</h3>
      <p className="mt-1.5 flex-1 text-[13.5px] leading-relaxed text-[var(--ink-3)]">{item.blurb}</p>

      {item.live && (
        <span className="mt-5 inline-flex items-center gap-1 text-[13px] font-semibold text-[var(--cyan-strong)]">
          Explore
          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
        </span>
      )}
    </>
  );

  if (item.live) {
    return (
      <Link href={`/use-cases/${item.slug}`} className={cn(CARD_INTERACTIVE, "group flex h-full flex-col p-6")}>
        {inner}
      </Link>
    );
  }
  return <div className={cn(CARD, "group flex h-full flex-col p-6 opacity-90")}>{inner}</div>;
}
