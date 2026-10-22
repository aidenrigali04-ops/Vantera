import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BLOG_AUTHOR, formatPostDate, type BlogPost } from "@/lib/blog";
import { VanteraLogo } from "@/components/landing/vantera-logo";
import { cn } from "@/lib/utils";
import { CoverArt } from "./cover-art";

/**
 * The blog's cards, after rankbox.xyz's: the byline pieces every surface shares, one
 * cell of the hairline grid, and the lead story that fills a band. Server-safe — the
 * blog's client library renders these too.
 */

/** What a card needs of a post: everything but the body. */
export type PostMeta = Pick<
  BlogPost,
  "slug" | "title" | "description" | "category" | "date" | "updated" | "readingMinutes"
>;

export function toPostMeta(post: BlogPost): PostMeta {
  const { slug, title, description, category, date, updated, readingMinutes } = post;
  return { slug, title, description, category, date, updated, readingMinutes };
}

/* ---------- byline ---------- */

/** The author's avatar: the Vantera mark on a white disc. */
export function AuthorMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-[rgba(12,16,26,0.08)] bg-white",
        className,
      )}
    >
      <VanteraLogo className="size-[55%] text-[var(--fb)]" />
    </span>
  );
}

/** "June 26, 2026 · 6 min read" */
export function PostStamp({ post, className }: { post: PostMeta; className?: string }) {
  return (
    <span className={className}>
      {formatPostDate(post.date)} · {post.readingMinutes} min read
    </span>
  );
}

export function Byline({ post, className }: { post: PostMeta; className?: string }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <AuthorMark className="size-9" />
      <div className="min-w-0 text-sm leading-tight">
        <p className="truncate font-semibold text-foreground">{BLOG_AUTHOR}</p>
        <PostStamp post={post} className="mt-0.5 block truncate text-xs text-[var(--ink-3)]" />
      </div>
    </div>
  );
}

export function TopicLabel({ topic, className }: { topic: string; className?: string }) {
  return (
    <span
      className={cn(
        "text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-[var(--fb-strong)]",
        className,
      )}
    >
      {topic}
    </span>
  );
}

/* ---------- grid card ---------- */

/* One cell of the blog's hairline grid: the cover inset in the cell, then topic, title,
   excerpt and date. The cell lifts to a faint grey on hover rather than casting a
   shadow, as the landing's cells do. */
export function PostCard({ post, className }: { post: PostMeta; className?: string }) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className={cn(
        "group flex h-full flex-col p-4 outline-none transition-colors duration-300 hover:bg-[color-mix(in_oklab,var(--tint)_55%,white)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[rgba(24,119,242,0.4)] sm:p-5",
        className,
      )}
    >
      <div className="overflow-hidden rounded-lg border border-[rgba(12,16,26,0.06)]">
        <CoverArt
          post={post}
          className="aspect-[16/10] transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.03] motion-reduce:transition-none"
        />
      </div>
      <div className="flex flex-1 flex-col px-1 pt-5">
        <div className="flex items-center gap-2 text-xs text-[var(--ink-3)]">
          <TopicLabel topic={post.category} />
          <span aria-hidden className="size-0.5 rounded-full bg-[var(--ink-3)]" />
          <span>{post.readingMinutes} min read</span>
        </div>
        <h3 className="mt-2.5 text-balance text-[1.15rem] font-medium leading-snug tracking-[-0.015em] text-foreground transition-colors group-hover:text-[var(--fb)]">
          {post.title}
        </h3>
        <p className="mt-2 line-clamp-3 text-[0.9rem] leading-relaxed text-[var(--ink-3)]">
          {post.description}
        </p>
        <p className="mt-auto pt-5 text-xs text-[var(--ink-3)]">{formatPostDate(post.date)}</p>
      </div>
    </Link>
  );
}

/* ---------- lead story ---------- */

/* The lead story, filling one band of the blog's frame: the cover flush to the left
   rail with a hairline of white around it, the story beside it. */
export function FeaturedPost({ post }: { post: PostMeta }) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group grid outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[rgba(24,119,242,0.4)] lg:grid-cols-[1.12fr_1fr]"
    >
      <div className="p-3 lg:pr-0">
        <div className="relative h-full overflow-hidden rounded-lg border border-[rgba(12,16,26,0.06)]">
          <CoverArt
            post={post}
            className="aspect-[16/10] h-full w-full transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.02] motion-reduce:transition-none lg:aspect-auto lg:min-h-[24rem]"
          />
        </div>
      </div>
      <div className="flex flex-col px-6 pb-8 pt-4 sm:px-10 lg:py-10 lg:pl-12">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-[var(--cyan-tint)] px-2 py-0.5 text-[0.72rem] font-semibold text-[var(--fb-strong)]">
            <span className="size-1.5 rounded-full bg-[var(--fb-strong)]" />
            Featured
          </span>
          <TopicLabel topic={post.category} className="text-[var(--ink-3)]" />
        </div>
        <h2 className="mt-5 text-balance text-[1.75rem] font-medium leading-[1.12] tracking-[-0.025em] text-foreground transition-colors group-hover:text-[var(--fb)] sm:text-[2.1rem]">
          {post.title}
        </h2>
        <p className="mt-4 text-[0.98rem] leading-relaxed text-[var(--ink-3)] sm:text-[1.02rem]">
          {post.description}
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-between gap-5 lg:mt-auto lg:pt-8">
          <Byline post={post} />
          <span className="inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--fb-strong)] px-4 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_1px_2px_rgba(16,24,40,0.14)] transition-colors group-hover:bg-[#1161cc]">
            Read the article
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
          </span>
        </div>
      </div>
    </Link>
  );
}
