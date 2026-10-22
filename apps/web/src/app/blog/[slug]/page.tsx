import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { MarketingShell } from "@/components/landing/marketing-shell";
import { Band, CELL, CellGrid, GhostLink, LINE, Spacer } from "@/components/landing/frame";
import { FinalCta } from "@/components/landing/final-cta";
import { ArticleBody, ShortAnswer, Takeaways } from "@/components/blog/article-body";
import { ReadingProgress, ShareButtons, TableOfContents } from "@/components/blog/article-chrome";
import { AuthorCard, RailCta } from "@/components/blog/article-aside";
import { CoverArt } from "@/components/blog/cover-art";
import { AuthorMark, PostCard, PostStamp, toPostMeta } from "@/components/blog/post-cards";
import { outlineArticle } from "@/components/blog/outline";
import { getAllPosts, getPost, formatPostDate, BLOG_AUTHOR } from "@/lib/blog";
import { JsonLd, articleLd, breadcrumbLd, SITE_URL } from "@/lib/seo";
import { cn } from "@/lib/utils";

export function generateStaticParams() {
  return getAllPosts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return {};
  return {
    title: `${post.title} | Vantera`,
    description: post.description,
    keywords: post.keywords,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.description,
      url: `/blog/${post.slug}`,
      publishedTime: post.date,
      modifiedTime: post.updated ?? post.date,
      authors: [BLOG_AUTHOR],
    },
    twitter: { card: "summary_large_image", title: post.title, description: post.description },
  };
}

/**
 * A post, after rankbox.xyz's article: in the landing's frame, a header split by a
 * hairline with the cover inset in its own cell; the text column beside a sticky rail
 * that holds the contents and the offer; then more reading in hairline cells, and the
 * landing's closing band. A thin line under the nav tracks how much has been read.
 */
export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  const url = `${SITE_URL}/blog/${post.slug}`;
  const meta = toPostMeta(post);
  const takeaways = post.takeaways ?? [];
  const { ids, toc } = outlineArticle(post.body, { takeaways: takeaways.length > 0 });
  const related = getAllPosts()
    .filter((p) => p.slug !== post.slug)
    .slice(0, 3)
    .map(toPostMeta);
  const topicHref = `/blog?topic=${encodeURIComponent(post.category)}`;
  const leadsWithCallout = !!post.shortAnswer || takeaways.length > 0;

  return (
    <MarketingShell framed>
      <JsonLd
        data={[
          articleLd(post, url),
          breadcrumbLd([
            { name: "Home", url: SITE_URL },
            { name: "Blog", url: `${SITE_URL}/blog` },
            { name: post.title, url },
          ]),
        ]}
      />
      <ReadingProgress targetId="article-body" />

      <article>
        {/* ---------- header ---------- */}
        <header className="relative bg-white">
          <div
            className={cn(
              "relative mx-auto grid max-w-6xl border-x lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]",
              LINE,
            )}
          >
            {/* The headline is the LCP element: no entrance on this column, only on the
                cover beside it. */}
            <div className="flex flex-col justify-center px-5 pb-10 pt-8 sm:px-10 lg:py-14 lg:pl-12 lg:pr-10">
              <nav aria-label="Breadcrumb">
                <ol className="flex items-center gap-1.5 text-[0.8rem] text-[var(--ink-3)]">
                  <li>
                    <Link href="/blog" className="py-2 transition-colors hover:text-foreground">
                      Blog
                    </Link>
                  </li>
                  <li aria-hidden>
                    <ChevronRight className="size-3.5 text-foreground/25" />
                  </li>
                  <li>
                    <Link
                      href={topicHref}
                      className="py-2 font-medium text-[var(--fb-strong)] transition-colors hover:text-[#1161cc]"
                    >
                      {post.category}
                    </Link>
                  </li>
                </ol>
              </nav>
              <h1 className="mt-5 text-balance text-[2.05rem] font-medium leading-[1.1] tracking-[-0.03em] text-foreground sm:text-[2.7rem] lg:text-[2.9rem]">
                {post.title}
              </h1>
              <p className="mt-5 max-w-2xl text-[1.05rem] leading-relaxed text-[var(--ink-3)] sm:text-[1.15rem]">
                {post.description}
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-between gap-5">
                <div className="flex items-center gap-3">
                  <AuthorMark className="size-10" />
                  <div className="text-sm leading-tight">
                    <Link
                      href="/about"
                      className="font-semibold text-foreground underline decoration-foreground/20 underline-offset-4 transition-colors hover:decoration-foreground"
                    >
                      {BLOG_AUTHOR}
                    </Link>
                    <p className="mt-1 text-xs text-[var(--ink-3)]">
                      <PostStamp post={meta} />
                      {post.updated && <> · Updated {formatPostDate(post.updated)}</>}
                    </p>
                  </div>
                </div>
                <ShareButtons url={url} title={post.title} />
              </div>
            </div>
            {/* The cover, inset in its own cell with a hairline of white around it. */}
            <div
              className={cn("landing-rise border-t p-3 lg:border-l lg:border-t-0", LINE)}
              style={{ "--rise-delay": "0.08s" } as CSSProperties}
            >
              <div className="h-full overflow-hidden rounded-lg border border-[rgba(12,16,26,0.06)]">
                <CoverArt
                  post={post}
                  className="aspect-[16/11] h-full w-full lg:aspect-auto lg:min-h-[22rem]"
                />
              </div>
            </div>
          </div>
        </header>

        {/* ---------- body + rail ---------- */}
        <Band inner="grid lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div id="article-body" className="min-w-0 px-5 py-10 sm:px-10 lg:py-14 lg:pl-12 lg:pr-14">
            <div className="max-w-[43rem]">
              <TableOfContents entries={toc} variant="inline" className="mb-10 lg:hidden" />
              {post.shortAnswer && <ShortAnswer text={post.shortAnswer} />}
              {takeaways.length > 0 && (
                <Takeaways items={takeaways} className={post.shortAnswer ? "mt-12" : undefined} />
              )}
              <ArticleBody
                blocks={post.body}
                ids={ids}
                className={leadsWithCallout ? "mt-4" : "mt-0 [&>:first-child]:mt-0"}
              />

              <footer className={cn("mt-14 space-y-8 border-t pt-10", LINE)}>
                <div className="flex flex-wrap items-center justify-between gap-5">
                  <ul aria-label="Topics" className="flex flex-wrap gap-2">
                    <li>
                      <Link
                        href={topicHref}
                        className="inline-flex h-8 items-center rounded-lg border border-[rgba(12,16,26,0.08)] bg-white px-3 text-[0.8rem] font-medium text-foreground/75 transition-colors hover:border-[rgba(22,111,229,0.3)] hover:text-[var(--fb-strong)]"
                      >
                        {post.category}
                      </Link>
                    </li>
                  </ul>
                  <ShareButtons url={url} title={post.title} />
                </div>
                <AuthorCard />
              </footer>
            </div>
          </div>

          <aside className={cn("hidden border-l lg:block", LINE)}>
            <div className="sticky top-24 max-h-[calc(100dvh-7rem)] space-y-8 overflow-y-auto px-6 py-14 [scrollbar-width:none]">
              <TableOfContents entries={toc} variant="rail" />
              <RailCta />
            </div>
          </aside>
        </Band>
      </article>

      {/* ---------- keep reading ---------- */}
      {related.length > 0 && (
        <section aria-labelledby="related-title">
          <Spacer />
          <Band inner="flex items-end justify-between gap-4 px-6 py-8 sm:px-10 lg:px-12">
            <h2
              id="related-title"
              className="text-[1.6rem] font-medium leading-tight tracking-[-0.025em] text-foreground sm:text-[1.9rem]"
            >
              Keep reading
            </h2>
            <div className="shrink-0">
              <GhostLink href="/blog">All articles</GhostLink>
            </div>
          </Band>
          <Band>
            <CellGrid className="sm:grid-cols-2 lg:grid-cols-3">
              {related.map((p) => (
                <li key={p.slug} className={CELL}>
                  <PostCard post={p} />
                </li>
              ))}
            </CellGrid>
          </Band>
        </section>
      )}

      <Spacer />
      <FinalCta />
    </MarketingShell>
  );
}
