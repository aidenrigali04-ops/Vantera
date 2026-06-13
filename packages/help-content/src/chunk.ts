import { createHash } from "node:crypto";
import type { HelpArticle } from "./index";

export interface Chunk {
  slug: string;
  heading: string | null;
  content: string;
  contentHash: string;
}

/** Split an article into heading-scoped chunks; each carries title+heading so a
 *  retrieved chunk is self-describing to the model. */
export function chunkArticle(article: HelpArticle): Chunk[] {
  const sections: { heading: string | null; lines: string[] }[] = [{ heading: null, lines: [] }];
  for (const line of article.body.split("\n")) {
    const h = line.match(/^#{1,3}\s+(.*)$/);
    if (h?.[1]) {
      sections.push({ heading: h[1].trim(), lines: [] });
    } else {
      const lastSection = sections[sections.length - 1];
      if (lastSection) {
        lastSection.lines.push(line);
      }
    }
  }
  return sections
    .map((s) => ({ heading: s.heading, text: s.lines.join("\n").trim() }))
    .filter((s) => s.text.length > 0)
    .map((s) => {
      const content = [article.title, s.heading, s.text].filter(Boolean).join("\n");
      return {
        slug: article.slug,
        heading: s.heading,
        content,
        contentHash: createHash("sha256").update(content).digest("hex"),
      };
    });
}
