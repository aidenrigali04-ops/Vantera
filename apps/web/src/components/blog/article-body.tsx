import type { Block } from "@/lib/blog";

/** Renders typed content blocks as semantic, SEO-clean markup with the landing typography. */
export function ArticleBody({ blocks }: { blocks: Block[] }) {
  return (
    <div className="mt-10">
      {blocks.map((b, i) => {
        switch (b.t) {
          case "h2":
            return (
              <h2
                key={i}
                className="mt-12 text-[1.6rem] font-semibold leading-[1.2] tracking-[-0.02em] text-foreground sm:text-[1.9rem]"
              >
                {b.text}
              </h2>
            );
          case "h3":
            return (
              <h3 key={i} className="mt-8 text-[1.2rem] font-semibold tracking-[-0.01em] text-foreground">
                {b.text}
              </h3>
            );
          case "p":
            return (
              <p key={i} className="mt-5 text-[17px] leading-[1.78] text-[var(--ink-3)]">
                {b.text}
              </p>
            );
          case "ul":
            return (
              <ul key={i} className="mt-5 space-y-3">
                {b.items.map((item, j) => (
                  <li key={j} className="flex gap-3 text-[16.5px] leading-relaxed text-[var(--ink-3)]">
                    <span className="mt-[0.6em] size-1.5 shrink-0 rounded-full bg-[var(--cyan)] shadow-[0_0_8px_rgba(11, 87, 171,0.6)]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol key={i} className="mt-5 space-y-3">
                {b.items.map((item, j) => (
                  <li key={j} className="flex gap-3.5 text-[16.5px] leading-relaxed text-[var(--ink-3)]">
                    <span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--cyan-tint)] text-[12px] font-semibold text-[var(--cyan-strong)]">
                      {j + 1}
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ol>
            );
          case "quote":
            return (
              <blockquote
                key={i}
                className="mt-7 rounded-r-2xl border-l-[3px] border-[var(--cyan)] bg-[var(--cyan-tint)]/50 py-4 pl-5 pr-5 text-[18px] font-medium leading-relaxed text-foreground"
              >
                {b.text}
              </blockquote>
            );
        }
      })}
    </div>
  );
}
