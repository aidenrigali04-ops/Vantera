import type { Block } from "@/lib/blog";

/**
 * The anchors an article's headings get, and the table of contents they make. Pure, so
 * the server-rendered headings and the client-side contents rail agree on every id.
 */

/** A heading the table of contents can jump to. */
export interface TocEntry {
  id: string;
  text: string;
}

/** The "Key takeaways" card's anchor, reserved before any heading claims an id. */
export const TAKEAWAYS_ID = "key-takeaways";

/** A heading's anchor: its words, lowercase, joined by hyphens. */
export function slugify(text: string): string {
  const slug = text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "section";
}

/**
 * Ids for the article's headings (one per block, `undefined` for anything that isn't a
 * heading) and the table of contents: the h2s in order, after "Key takeaways" when the
 * post has them. A repeated heading gets `-2`, `-3`… so every anchor is unique.
 */
export function outlineArticle(
  blocks: Block[],
  { takeaways = false }: { takeaways?: boolean } = {},
): { ids: (string | undefined)[]; toc: TocEntry[] } {
  const used = new Set<string>();
  const claim = (base: string) => {
    let id = base;
    for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
    used.add(id);
    return id;
  };

  const toc: TocEntry[] = [];
  if (takeaways) toc.push({ id: claim(TAKEAWAYS_ID), text: "Key takeaways" });

  const ids = blocks.map((b) => {
    if (b.t !== "h2" && b.t !== "h3") return undefined;
    const id = claim(slugify(b.text));
    if (b.t === "h2") toc.push({ id, text: b.text });
    return id;
  });
  return { ids, toc };
}
