import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { MarketingShell } from "@/components/landing/marketing-shell";
import { MarketingHeader } from "@/components/landing/marketing-header";
import { Reveal, RevealItem, CARD_INTERACTIVE } from "@/components/landing/surface";
import { JsonLd, breadcrumbLd, SITE_URL } from "@/lib/seo";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Outbound Playbooks — LinkedIn Plays for Your Agents | Vantera",
  description:
    "Proven, quality-first LinkedIn plays you can run with your Vantera agents — warm up cold ICPs with intent, launch multiple senders safely, and turn a follow into a booked meeting.",
  alternates: { canonical: "/playbooks" },
};

type Playbook = {
  category: string;
  title: string;
  teaser: string;
};

/** Placeholder entries — swap in real slugs/hrefs as each playbook is written. */
const PLAYBOOKS: Playbook[] = [
  {
    category: "Intent",
    title: "Warm up a cold ICP with intent signals",
    teaser:
      "Turn a list of strangers into a warm queue by leading with the buying behavior that proves they're in-market.",
  },
  {
    category: "Account safety",
    title: "Multi-sender launch without account risk",
    teaser:
      "Split volume across senders with human-like pacing so you scale reach while every account stays off LinkedIn's radar.",
  },
  {
    category: "Conversion",
    title: "From follow → booked meeting",
    teaser:
      "A four-touch sequence that earns the reply first and asks for time second — engineered for the meeting, not the pitch.",
  },
  {
    category: "Qualification",
    title: "Tighten your ICP so agents skip the noise",
    teaser:
      "Sharpen the fit and intent bar so effort lands only on the accounts most likely to close — fewer, better conversations.",
  },
  {
    category: "Re-engagement",
    title: "Revive a stalled thread the right way",
    teaser:
      "Reopen quiet conversations with a reason to reply that references their activity — never a hollow bump.",
  },
  {
    category: "Handoff",
    title: "Clean handoff from reply to CRM",
    teaser:
      "Move a qualified conversation into your CRM with full context intact, so nothing gets re-typed or lost.",
  },
];

function PlaybookCard({ p }: { p: Playbook }) {
  return (
    <RevealItem>
      <Link
        href="#"
        className={cn(CARD_INTERACTIVE, "group flex h-full flex-col p-7")}
      >
        <span className="inline-flex w-fit items-center rounded-full bg-[var(--cyan-tint)] px-2.5 py-0.5 text-[11.5px] font-semibold text-[var(--cyan-strong)]">
          {p.category}
        </span>

        <h2 className="mt-4 text-[1.2rem] font-semibold leading-snug tracking-[-0.02em] text-foreground">
          {p.title}
        </h2>
        <p className="mt-2.5 flex-1 text-[14.5px] leading-relaxed text-[var(--ink-3)]">
          {p.teaser}
        </p>

        <span className="mt-6 inline-flex items-center gap-1 text-[13px] font-medium text-[var(--ink-4)] transition-colors group-hover:text-[var(--cyan-strong)]">
          Read playbook
          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
        </span>
      </Link>
    </RevealItem>
  );
}

export default function PlaybooksPage() {
  return (
    <MarketingShell>
      <JsonLd
        data={[
          breadcrumbLd([
            { name: "Home", url: SITE_URL },
            { name: "Playbooks", url: `${SITE_URL}/playbooks` },
          ]),
        ]}
      />

      <section className="px-6 pt-36 pb-12 sm:pt-40 lg:px-8">
        <MarketingHeader
          eyebrow="Playbooks"
          title="Outbound playbooks"
          subtitle="Proven LinkedIn plays you can run with your agents."
        />
      </section>

      <section className="relative py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-6 lg:px-8">
          <Reveal className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PLAYBOOKS.map((p) => (
              <PlaybookCard key={p.title} p={p} />
            ))}
          </Reveal>

          <p className="mt-12 text-center text-[13.5px] text-[var(--ink-4)]">
            More playbooks coming soon.
          </p>
        </div>
      </section>
    </MarketingShell>
  );
}
