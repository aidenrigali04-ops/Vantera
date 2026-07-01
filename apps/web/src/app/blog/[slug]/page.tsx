import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { MarketingShell } from "@/components/landing/marketing-shell";
import { ArticleBody } from "@/components/blog/article-body";
import { getAllPosts, getPost, formatPostDate, BLOG_AUTHOR } from "@/lib/blog";
import { JsonLd, articleLd, breadcrumbLd, SITE_URL } from "@/lib/seo";

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

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  const url = `${SITE_URL}/blog/${post.slug}`;

  return (
    <MarketingShell>
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
      <article className="px-6 pt-36 pb-24 sm:pt-40 lg:px-8">
        <div className="mx-auto max-w-2xl">
          <Link
            href="/blog"
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--ink-3)] transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            All articles
          </Link>

          <header className="mt-6">
            <span className="inline-flex w-fit items-center rounded-full bg-[var(--cyan-tint)] px-2.5 py-0.5 text-[11.5px] font-semibold text-[var(--cyan-strong)]">
              {post.category}
            </span>
            <h1 className="mt-4 text-[2.1rem] font-semibold leading-[1.1] tracking-[-0.03em] text-foreground sm:text-[2.55rem]">
              {post.title}
            </h1>
            <p className="mt-4 text-[14.5px] text-[var(--ink-4)]">
              {formatPostDate(post.date)} · {post.readingMinutes} min read · {BLOG_AUTHOR}
            </p>
          </header>

          <ArticleBody blocks={post.body} />

          <aside className="mt-16 rounded-3xl border border-[var(--hairline)] bg-[var(--tint)] p-8 text-center">
            <h2 className="text-[1.4rem] font-semibold tracking-[-0.02em] text-foreground">Put this into practice</h2>
            <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-[var(--ink-3)]">
              Vantera finds in-market buyers, qualifies them against your ICP, and drafts every
              message from their real activity — you approve each send.
            </p>
            <Link
              href="/signup"
              className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-[#0a0c12] px-5 py-2.5 text-[14px] font-medium text-white transition-all hover:shadow-[0_8px_24px_-8px_rgba(11, 87, 171,0.6)]"
            >
              Start free
              <ArrowRight className="size-4" />
            </Link>
          </aside>
        </div>
      </article>
    </MarketingShell>
  );
}
