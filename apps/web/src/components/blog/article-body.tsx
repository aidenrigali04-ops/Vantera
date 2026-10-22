import { Check, Link2, Zap } from "lucide-react";
import type { Block } from "@/lib/blog";
import { cn } from "@/lib/utils";
import { TAKEAWAYS_ID } from "./outline";

/**
 * An article's text, after rankbox.xyz's: semantic, SEO-clean markup from typed blocks,
 * set in the landing face — long-measure paragraphs at 80% ink, bold section headings
 * with a hover anchor, blue list markers, and a quote set large. The blog also renders
 * `ShortAnswer` and `Takeaways` above the body; the legal pages render the body alone.
 */

const PARAGRAPH = "mt-6 text-[1.0625rem] leading-[1.8] text-foreground/80 sm:text-[1.125rem]";
const LIST_ITEM = "pl-1.5 text-[1.0625rem] leading-[1.75] text-foreground/80 sm:text-[1.125rem]";

/* A heading with its anchor: a link icon that appears on hover. */
function Heading({ tag, text, id }: { tag: "h2" | "h3"; text: string; id?: string }) {
  const Tag = tag;
  return (
    <Tag
      id={id}
      className={cn(
        "group relative scroll-mt-28 tracking-tight text-foreground",
        tag === "h2"
          ? "mt-16 text-[1.6rem] font-bold leading-tight sm:text-[1.9rem]"
          : "mt-11 text-[1.25rem] font-semibold leading-snug sm:text-[1.35rem]",
      )}
    >
      {text}
      {id && (
        <a
          href={`#${id}`}
          aria-label="Link to this section"
          className="ml-2 inline-flex -translate-y-[0.1em] align-middle text-transparent transition-colors group-hover:text-[var(--ink-3)] hover:!text-[var(--fb)] focus-visible:text-[var(--fb)]"
        >
          <Link2 className="size-[0.7em]" />
        </a>
      )}
    </Tag>
  );
}

export function ArticleBody({
  blocks,
  ids,
  className,
}: {
  blocks: Block[];
  /** Anchors for the headings, one per block (outline.ts). Without them, headings
      render plain — the legal pages have no table of contents. */
  ids?: (string | undefined)[];
  className?: string;
}) {
  return (
    <div className={cn("mt-10", className)}>
      {blocks.map((b, i) => {
        switch (b.t) {
          case "h2":
          case "h3":
            return <Heading key={i} tag={b.t} text={b.text} id={ids?.[i]} />;
          case "p":
            return (
              <p key={i} className={PARAGRAPH}>
                {b.text}
              </p>
            );
          case "ul":
            return (
              <ul key={i} className="mt-5 list-disc space-y-2.5 pl-6 marker:text-[var(--fb)]">
                {b.items.map((item, j) => (
                  <li key={j} className={LIST_ITEM}>
                    {item}
                  </li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol
                key={i}
                className="mt-5 list-decimal space-y-2.5 pl-6 marker:text-[0.95em] marker:font-semibold marker:text-[var(--fb)]"
              >
                {b.items.map((item, j) => (
                  <li key={j} className={LIST_ITEM}>
                    {item}
                  </li>
                ))}
              </ol>
            );
          case "quote":
            return (
              <blockquote
                key={i}
                className="my-10 border-l-[3px] border-[var(--fb)] pl-6 text-[1.3rem] font-medium leading-snug tracking-tight text-foreground sm:text-[1.45rem]"
              >
                {b.text}
              </blockquote>
            );
        }
      })}
    </div>
  );
}

/** "The short answer": the post's answer in two or three sentences, before the body. */
export function ShortAnswer({ text }: { text: string }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-[rgba(22,111,229,0.2)] bg-[color-mix(in_oklab,var(--fb-strong)_4%,white)] p-6 sm:p-7">
      <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-[var(--fb-strong)]" />
      <p className="flex items-center gap-2 text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-[var(--fb-strong)]">
        <Zap className="size-3.5 fill-current" />
        The short answer
      </p>
      <p className="mt-3 text-[1.125rem] font-medium leading-[1.7] text-foreground sm:text-[1.2rem]">
        {text}
      </p>
    </div>
  );
}

/** "Key takeaways": the post's main points as a checklist card. */
export function Takeaways({ items, className }: { items: string[]; className?: string }) {
  return (
    <section
      aria-labelledby={TAKEAWAYS_ID}
      className={cn(
        "relative overflow-hidden rounded-xl border border-[rgba(12,16,26,0.08)] bg-[color-mix(in_oklab,var(--tint)_70%,white)] p-6 sm:p-8",
        className,
      )}
    >
      <h2
        id={TAKEAWAYS_ID}
        className="scroll-mt-28 text-[1.3rem] font-medium tracking-[-0.02em] text-foreground"
      >
        Key takeaways
      </h2>
      <ul className="mt-5 space-y-3.5">
        {items.map((item) => (
          <li key={item} className="flex gap-3">
            <span className="mt-[0.3rem] flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--fb-strong)] text-white">
              <Check className="size-3" strokeWidth={3.5} />
            </span>
            <span className="text-[1rem] leading-relaxed text-foreground/85 sm:text-[1.05rem]">
              {item}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
