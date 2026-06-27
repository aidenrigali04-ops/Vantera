import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { MarketingShell } from "@/components/landing/marketing-shell";
import { MarketingHeader } from "@/components/landing/marketing-header";
import { getAllPosts, formatPostDate } from "@/lib/blog";

export const metadata: Metadata = {
  title: "LinkedIn Outreach Playbook — Vantera Blog",
  description:
    "Quality-first LinkedIn outreach: account safety, buying-intent signals, and the playbooks behind pipeline that actually converts.",
  alternates: { canonical: "/blog" },
};

export default function BlogIndex() {
  const posts = getAllPosts();
  return (
    <MarketingShell>
      <section className="px-6 pt-36 pb-10 sm:pt-40 lg:px-8">
        <MarketingHeader
          eyebrow="Blog"
          title="The LinkedIn outreach playbook"
          subtitle="Quality over volume — account safety, buying intent, and the tactics behind conversations that close."
        />
      </section>

      <section className="px-6 pb-24 sm:pb-28 lg:px-8">
        <div className="mx-auto grid max-w-5xl gap-5 sm:grid-cols-2">
          {posts.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="group flex flex-col rounded-2xl border border-[var(--hairline)] bg-white p-6 shadow-[var(--shadow-sm)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[var(--shadow-card)]"
            >
              <span className="inline-flex w-fit items-center rounded-full bg-[var(--cyan-tint)] px-2.5 py-0.5 text-[11.5px] font-semibold text-[var(--cyan-strong)]">
                {post.category}
              </span>
              <h2 className="mt-4 text-[1.3rem] font-semibold leading-snug tracking-[-0.02em] text-foreground">
                {post.title}
              </h2>
              <p className="mt-3 flex-1 text-[14.5px] leading-relaxed text-[var(--ink-3)]">{post.description}</p>
              <div className="mt-6 flex items-center justify-between">
                <span className="text-[12.5px] text-[var(--ink-4)]">
                  {formatPostDate(post.date)} · {post.readingMinutes} min read
                </span>
                <span className="inline-flex items-center gap-1 text-[13px] font-medium text-[var(--cyan-strong)]">
                  Read
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </MarketingShell>
  );
}
