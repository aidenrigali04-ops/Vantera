import Link from "next/link";
import { ArrowUpRight, BookOpen, FileText, LineChart, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { CARD_INTERACTIVE } from "@/components/landing/surface";
import { LandingHeading } from "@/components/landing/heading";

/**
 * Featured resources — links to Vantera's real content surfaces (playbooks, guides, case
 * studies, the Claude/MCP tools) rather than inventing downloadable assets. Premium cards
 * in the landing's light-card system. Server component.
 */
type Resource = {
  kind: string;
  title: string;
  desc: string;
  href: string;
  icon: typeof BookOpen;
};

const RESOURCES: Resource[] = [
  {
    kind: "Playbooks",
    title: "Outbound playbooks",
    desc: "Step-by-step plays for running LinkedIn outreach that books meetings.",
    href: "/playbooks",
    icon: FileText,
  },
  {
    kind: "Guides",
    title: "In-depth guides",
    desc: "Long-form articles on LinkedIn, sales, AI search, and demand generation.",
    href: "/blog",
    icon: BookOpen,
  },
  {
    kind: "Case studies",
    title: "Real results",
    desc: "How teams swapped volume for quality and filled their calendars.",
    href: "/case-studies",
    icon: LineChart,
  },
  {
    kind: "AI tools",
    title: "Claude & MCP",
    desc: "Drive Vantera from Claude over the Model Context Protocol.",
    href: "/claude-linkedin-mcp",
    icon: Sparkles,
  },
];

export function FeaturedResources() {
  return (
    <section className="relative border-t border-[var(--hairline)] bg-white py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <LandingHeading
          eyebrow="Featured resources"
          title="Go beyond the definitions"
          subtitle="Definitions are the starting point. Turn them into pipeline with playbooks, guides, and tools built for modern growth teams."
        />

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {RESOURCES.map((r) => (
            <Link key={r.kind} href={r.href} className={cn(CARD_INTERACTIVE, "group flex h-full flex-col p-6")}>
              <div className="flex items-center justify-between">
                <span className="grid size-11 place-items-center rounded-xl bg-[var(--cyan-tint)] text-[var(--cyan-strong)] ring-1 ring-inset ring-[var(--cyan-line)] transition-transform duration-300 group-hover:scale-105">
                  <r.icon className="size-5" strokeWidth={1.9} />
                </span>
                <ArrowUpRight className="size-4 text-[var(--ink-4)] transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[var(--cyan-strong)]" />
              </div>
              <span className="mt-5 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-4)]">
                {r.kind}
              </span>
              <h3 className="mt-1.5 text-[16.5px] font-semibold tracking-[-0.01em] text-foreground">{r.title}</h3>
              <p className="mt-1.5 flex-1 text-[13.5px] leading-relaxed text-[var(--ink-3)]">{r.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
